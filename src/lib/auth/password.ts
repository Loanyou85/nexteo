import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** `promisify` perd la surcharge avec options : on enveloppe à la main. */
function derive(password: string, salt: Buffer, length: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/**
 * Empreintes de mots de passe avec scrypt, présent dans Node.
 *
 * scrypt est une fonction de dérivation coûteuse en mémoire : une attaque par
 * force brute ne peut pas être massivement parallélisée sur carte graphique,
 * ce qui est précisément la menace contre une base de mots de passe volée.
 * Choisir scrypt plutôt qu'une dépendance native évite aussi les ennuis de
 * compilation sur les plateformes serverless.
 *
 * Les paramètres sont stockés dans l'empreinte : ils pourront être durcis plus
 * tard sans invalider les comptes existants.
 */
const KEY_LENGTH = 64;
const PARAMS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derive(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(rawSalt ?? '', 'base64');
  const expected = Buffer.from(rawHash ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await derive(password.normalize('NFKC'), salt, expected.length, {
    N,
    r,
    p,
    maxmem: PARAMS.maxmem,
  });

  // Comparaison à temps constant : une comparaison naïve laisse fuir, par sa
  // durée, le nombre d'octets corrects.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
