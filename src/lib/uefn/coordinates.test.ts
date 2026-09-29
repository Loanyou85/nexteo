import { describe, expect, it } from 'vitest';
import {
  composerLUF,
  composerXYZ,
  ECHELLE_UNITE_LUF,
  IDENTITE_LUF,
  lacetLUF,
  luf,
  quatVersLUF,
  quatVersXYZ,
  tournerLUF,
  tournerXYZ,
  transformVersLUF,
  transformVersXYZ,
  versLUF,
  versXYZ,
  xyz,
  xyzQuat,
  type LUFVector,
  type XYZTransform,
} from '@/lib/uefn/coordinates';

const proche = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);
function vecProche(a: LUFVector, b: LUFVector) {
  proche(a.left, b.left);
  proche(a.up, b.up);
  proche(a.forward, b.forward);
}

/** Quaternion d'angle `deg` autour d'un axe unitaire, dans le repère du MCP. */
function quatAxe(ax: number, ay: number, az: number, deg: number) {
  const n = Math.hypot(ax, ay, az);
  const s = Math.sin((deg * Math.PI) / 360);
  return xyzQuat((ax / n) * s, (ay / n) * s, (az / n) * s, Math.cos((deg * Math.PI) / 360));
}

describe('cas connus', () => {
  it('l’avant Unreal (+X) est l’avant UEFN', () => {
    expect(versLUF(xyz(100, 0, 0))).toEqual(luf(0, 0, 100));
  });
  it('la droite Unreal (+Y) est la gauche négative', () => {
    expect(versLUF(xyz(0, 100, 0))).toEqual(luf(-100, 0, 0));
  });
  it('le haut reste le haut', () => {
    expect(versLUF(xyz(0, 0, 50))).toEqual(luf(0, 50, 0));
  });
  it('un point quelconque', () => {
    expect(versLUF(xyz(1200, -350, 80))).toEqual(luf(350, 80, 1200));
  });
});

describe('aller-retour', () => {
  it('XYZ → LUF → XYZ rend le vecteur d’origine', () => {
    const v = xyz(12.5, -7, 3.25);
    expect(versXYZ(versLUF(v))).toEqual(v);
  });
  it('un quaternion revient identique', () => {
    const q = quatAxe(0.3, -0.5, 0.8, 73);
    const r = quatVersXYZ(quatVersLUF(q));
    proche(r.x, q.x);
    proche(r.y, q.y);
    proche(r.z, q.z);
    proche(r.w, q.w);
  });
});

describe('rotations', () => {
  it('un lacet Unreal de +90° envoie l’avant vers la droite, soit left = −1', () => {
    const q = quatAxe(0, 0, 1, 90);
    vecProche(tournerLUF(quatVersLUF(q), luf(0, 0, 1)), luf(-1, 0, 0));
  });

  it.each([
    [1, 0, 0, 90],
    [0, 1, 0, 45],
    [0, 0, 1, -120],
    [1, 1, 1, 200],
    [0.2, -0.7, 0.4, 33],
  ])('tourner puis convertir = convertir puis tourner (axe %d,%d,%d, %d°)', (ax, ay, az, deg) => {
    const q = quatAxe(ax, ay, az, deg);
    const v = xyz(120, -45, 60);
    vecProche(versLUF(tournerXYZ(q, v)), tournerLUF(quatVersLUF(q), versLUF(v)));
  });

  it('le lacet LUF tourne dans le sens annoncé : +90° envoie l’avant vers la gauche', () => {
    vecProche(tournerLUF(lacetLUF(90), luf(0, 0, 1)), luf(1, 0, 0));
  });
});

describe('transforms imbriqués', () => {
  const parent: XYZTransform = {
    position: xyz(1000, 200, 0),
    rotation: quatAxe(0, 0, 1, 90),
    scale: xyz(2, 2, 2),
  };
  const enfant: XYZTransform = {
    position: xyz(100, 0, 50),
    rotation: quatAxe(1, 0, 0, 30),
    scale: xyz(1, 1, 1),
  };

  it('composer en XYZ puis convertir = convertir puis composer en LUF', () => {
    const viaXYZ = transformVersLUF(composerXYZ(parent, enfant));
    const viaLUF = composerLUF(transformVersLUF(parent), transformVersLUF(enfant));
    vecProche(viaXYZ.position, viaLUF.position);
    proche(viaXYZ.rotation.left, viaLUF.rotation.left);
    proche(viaXYZ.rotation.up, viaLUF.rotation.up);
    proche(viaXYZ.rotation.forward, viaLUF.rotation.forward);
    proche(viaXYZ.rotation.w, viaLUF.rotation.w);
  });

  it('trois niveaux d’imbrication restent cohérents', () => {
    const petit: XYZTransform = { position: xyz(0, 30, 0), rotation: quatAxe(0, 1, 0, -60), scale: xyz(1, 1, 1) };
    const viaXYZ = transformVersLUF(composerXYZ(composerXYZ(parent, enfant), petit));
    const viaLUF = composerLUF(composerLUF(transformVersLUF(parent), transformVersLUF(enfant)), transformVersLUF(petit));
    vecProche(viaXYZ.position, viaLUF.position);
  });

  it('une échelle ne devient jamais négative en changeant de repère', () => {
    const t = transformVersLUF({ position: xyz(0, 0, 0), rotation: quatAxe(0, 0, 1, 0), scale: xyz(1, 3, 2) });
    expect(t.scale).toEqual(luf(3, 2, 1));
    expect(transformVersXYZ(t).scale).toEqual(xyz(1, 3, 2));
  });

  it('l’identité ne déplace rien', () => {
    const t = composerLUF({ position: luf(0, 0, 0), rotation: IDENTITE_LUF, scale: ECHELLE_UNITE_LUF }, {
      position: luf(5, 6, 7),
      rotation: IDENTITE_LUF,
      scale: ECHELLE_UNITE_LUF,
    });
    expect(t.position).toEqual(luf(5, 6, 7));
  });
});

describe('le compilateur refuse de mélanger les repères', () => {
  it('XYZ là où LUF est attendu ne compile pas', () => {
    const attendLUF = (v: LUFVector) => v;
    // @ts-expect-error — un XYZVector n'est pas un LUFVector.
    attendLUF(xyz(1, 2, 3));
    // @ts-expect-error — un objet littéral ne passe pas non plus : il faut passer par luf().
    attendLUF({ left: 1, up: 2, forward: 3 });
    expect(true).toBe(true);
  });
});
