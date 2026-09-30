import 'server-only';
import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * Jetons et codes d'appairage de l'agent local.
 *
 * Rien de ce qui permet de se faire passer pour un agent n'est stocké en
 * clair : la base ne garde que des empreintes SHA-256. Une fuite de la base
 * ne donne donc ni jeton ni code utilisable.
 */

/** Sans I, L, O, 0, 1 : un code recopié à la main ne doit pas prêter à confusion. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const DUREE_CODE_MS = 10 * 60_000;
const PREFIXE_JETON = 'nxa_';

export function empreinte(valeur: string): string {
  return createHash('sha256').update(valeur).digest('hex');
}

/** 8 caractères sur 31 : environ 40 bits, valables 10 minutes et une seule fois. */
export function genererCode(): string {
  let brut = '';
  for (let i = 0; i < 8; i++) brut += ALPHABET[randomInt(ALPHABET.length)];
  return `${brut.slice(0, 4)}-${brut.slice(4)}`;
}

/** Tolère minuscules, espaces et tirets : on saisit le code comme on peut. */
export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function genererJeton(): string {
  return PREFIXE_JETON + randomBytes(32).toString('base64url');
}

export function jetonValide(jeton: string): boolean {
  return jeton.startsWith(PREFIXE_JETON) && jeton.length >= PREFIXE_JETON.length + 40;
}
