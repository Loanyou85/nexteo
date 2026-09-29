/**
 * Adaptateur de coordonnées (sections 2.3 et 15) — SEUL fichier du dépôt
 * autorisé à convertir entre les repères.
 *
 * Le MCP expose les positions en XYZ (repère Unreal : X avant, Y droite,
 * Z haut, en centimètres). UEFN raisonne en Left-Up-Forward. Une conversion
 * naïve place les objets au mauvais endroit sans erreur ni avertissement :
 * c'est le bug le plus coûteux du projet parce qu'il est silencieux.
 *
 * Les deux repères ont des types MARQUÉS. Un `XYZVector` passé là où un
 * `LUFVector` est attendu est une erreur de compilation, même si les deux
 * portaient des champs de même nom. Aucune position brute ne circule ailleurs.
 *
 * HYPOTHÈSE À CONFIRMER contre le vrai MCP (DECISIONS n° 14) :
 *   left = −y   up = z   forward = x
 * Toute la conversion découle de la matrice `M` ci-dessous. Si le vrai MCP la
 * contredit, c'est la seule chose à changer — les tests de cohérence
 * (aller-retour, rotations, transforms imbriqués) resteront valables.
 */

declare const marqueXYZ: unique symbol;
declare const marqueLUF: unique symbol;

export type XYZVector = { readonly x: number; readonly y: number; readonly z: number; readonly [marqueXYZ]: true };
export type LUFVector = { readonly left: number; readonly up: number; readonly forward: number; readonly [marqueLUF]: true };

export type XYZQuat = { readonly x: number; readonly y: number; readonly z: number; readonly w: number; readonly [marqueXYZ]: true };
export type LUFQuat = { readonly left: number; readonly up: number; readonly forward: number; readonly w: number; readonly [marqueLUF]: true };

export type XYZTransform = { readonly position: XYZVector; readonly rotation: XYZQuat; readonly scale: XYZVector };
export type LUFTransform = { readonly position: LUFVector; readonly rotation: LUFQuat; readonly scale: LUFVector };

export const xyz = (x: number, y: number, z: number) => ({ x, y, z }) as XYZVector;
export const luf = (left: number, up: number, forward: number) => ({ left, up, forward }) as LUFVector;
export const xyzQuat = (x: number, y: number, z: number, w: number) => ({ x, y, z, w }) as XYZQuat;
export const lufQuat = (left: number, up: number, forward: number, w: number) => ({ left, up, forward, w }) as LUFQuat;

type V3 = [number, number, number];

/** Matrice de changement de base : [left, up, forward] = M · [x, y, z]. */
const M: [V3, V3, V3] = [
  [0, -1, 0],
  [0, 0, 1],
  [1, 0, 0],
];

const MT: [V3, V3, V3] = [
  [M[0][0], M[1][0], M[2][0]],
  [M[0][1], M[1][1], M[2][1]],
  [M[0][2], M[1][2], M[2][2]],
];

function mul(m: [V3, V3, V3], v: V3): V3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function det(m: [V3, V3, V3]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/**
 * Le changement de base est IMPROPRE (déterminant −1) : il inverse la
 * chiralité. Une rotation d'angle θ autour de l'axe a devient une rotation
 * d'angle θ autour de det(M)·M·a. Pour un quaternion : la partie vectorielle
 * est multipliée par det(M)·M, la partie scalaire ne change pas. Oublier ce
 * signe fait tourner les devices dans le mauvais sens — sans erreur.
 */
const DET = det(M);

/** Évite les −0, qui rendent les comparaisons et les affichages trompeurs. */
const n = (x: number) => (Object.is(x, -0) ? 0 : x);

export function versLUF(v: XYZVector): LUFVector {
  const [l, u, f] = mul(M, [v.x, v.y, v.z]);
  return luf(n(l), n(u), n(f));
}

export function versXYZ(v: LUFVector): XYZVector {
  const [x, y, z] = mul(MT, [v.left, v.up, v.forward]);
  return xyz(n(x), n(y), n(z));
}

export function quatVersLUF(q: XYZQuat): LUFQuat {
  const [l, u, f] = mul(M, [q.x, q.y, q.z]);
  return lufQuat(n(DET * l), n(DET * u), n(DET * f), n(q.w));
}

export function quatVersXYZ(q: LUFQuat): XYZQuat {
  const [x, y, z] = mul(MT, [q.left, q.up, q.forward]);
  return xyzQuat(n(DET * x), n(DET * y), n(DET * z), n(q.w));
}

/** L'échelle est une grandeur par axe, sans signe de direction : elle est permutée, jamais négative. */
function echelleVersLUF(s: XYZVector): LUFVector {
  const [l, u, f] = mul(M, [s.x, s.y, s.z]);
  return luf(Math.abs(l), Math.abs(u), Math.abs(f));
}

function echelleVersXYZ(s: LUFVector): XYZVector {
  const [x, y, z] = mul(MT, [s.left, s.up, s.forward]);
  return xyz(Math.abs(x), Math.abs(y), Math.abs(z));
}

export function transformVersLUF(t: XYZTransform): LUFTransform {
  return { position: versLUF(t.position), rotation: quatVersLUF(t.rotation), scale: echelleVersLUF(t.scale) };
}

export function transformVersXYZ(t: LUFTransform): XYZTransform {
  return { position: versXYZ(t.position), rotation: quatVersXYZ(t.rotation), scale: echelleVersXYZ(t.scale) };
}

// ─── Opérations dans le repère LUF, pour le reste du code ─────────────────

/**
 * Rotation autour de l'axe vertical, en degrés, EN LUF. Positif : l'avant
 * pivote vers la gauche (sens de la main droite autour de « up » dans ce
 * repère). C'est l'orientation qu'on donne à un device posé au sol.
 */
export function lacetLUF(degres: number): LUFQuat {
  const a = (degres * Math.PI) / 180 / 2;
  return lufQuat(0, n(Math.sin(a)), 0, n(Math.cos(a)));
}

export const IDENTITE_LUF = lufQuat(0, 0, 0, 1);
export const ECHELLE_UNITE_LUF = luf(1, 1, 1);

type Q = { a: number; b: number; c: number; w: number };

function qmul(p: Q, q: Q): Q {
  return {
    w: p.w * q.w - p.a * q.a - p.b * q.b - p.c * q.c,
    a: p.w * q.a + p.a * q.w + p.b * q.c - p.c * q.b,
    b: p.w * q.b - p.a * q.c + p.b * q.w + p.c * q.a,
    c: p.w * q.c + p.a * q.b - p.b * q.a + p.c * q.w,
  };
}

function tourner(q: Q, v: V3): V3 {
  const r = qmul(qmul(q, { a: v[0], b: v[1], c: v[2], w: 0 }), { a: -q.a, b: -q.b, c: -q.c, w: q.w });
  return [r.a, r.b, r.c];
}

export function tournerLUF(q: LUFQuat, v: LUFVector): LUFVector {
  const [l, u, f] = tourner({ a: q.left, b: q.up, c: q.forward, w: q.w }, [v.left, v.up, v.forward]);
  return luf(n(l), n(u), n(f));
}

/** Pour les tests uniquement : la même rotation, calculée dans le repère du MCP. */
export function tournerXYZ(q: XYZQuat, v: XYZVector): XYZVector {
  const [x, y, z] = tourner({ a: q.x, b: q.y, c: q.z, w: q.w }, [v.x, v.y, v.z]);
  return xyz(n(x), n(y), n(z));
}

/** Compose parent ∘ enfant (enfant exprimé dans le repère local du parent). */
export function composerLUF(parent: LUFTransform, enfant: LUFTransform): LUFTransform {
  const ech = luf(
    parent.scale.left * enfant.position.left,
    parent.scale.up * enfant.position.up,
    parent.scale.forward * enfant.position.forward,
  );
  const r = tournerLUF(parent.rotation, ech);
  const pq = parent.rotation;
  const eq = enfant.rotation;
  const q = qmul({ a: pq.left, b: pq.up, c: pq.forward, w: pq.w }, { a: eq.left, b: eq.up, c: eq.forward, w: eq.w });
  return {
    position: luf(parent.position.left + r.left, parent.position.up + r.up, parent.position.forward + r.forward),
    rotation: lufQuat(q.a, q.b, q.c, q.w),
    scale: luf(
      parent.scale.left * enfant.scale.left,
      parent.scale.up * enfant.scale.up,
      parent.scale.forward * enfant.scale.forward,
    ),
  };
}

/** Même composition dans le repère du MCP, pour vérifier que les deux chemins concordent. */
export function composerXYZ(parent: XYZTransform, enfant: XYZTransform): XYZTransform {
  const ech = xyz(parent.scale.x * enfant.position.x, parent.scale.y * enfant.position.y, parent.scale.z * enfant.position.z);
  const r = tournerXYZ(parent.rotation, ech);
  const q = qmul(
    { a: parent.rotation.x, b: parent.rotation.y, c: parent.rotation.z, w: parent.rotation.w },
    { a: enfant.rotation.x, b: enfant.rotation.y, c: enfant.rotation.z, w: enfant.rotation.w },
  );
  return {
    position: xyz(parent.position.x + r.x, parent.position.y + r.y, parent.position.z + r.z),
    rotation: xyzQuat(q.a, q.b, q.c, q.w),
    scale: xyz(parent.scale.x * enfant.scale.x, parent.scale.y * enfant.scale.y, parent.scale.z * enfant.scale.z),
  };
}

/**
 * Translation en LUF. Les positions ne s'additionnent qu'ici : toute
 * arithmétique de position hors de ce fichier est interdite (section 2.3).
 */
export function translaterLUF(v: LUFVector, gauche: number, haut: number, avant: number): LUFVector {
  return luf(n(v.left + gauche), n(v.up + haut), n(v.forward + avant));
}
