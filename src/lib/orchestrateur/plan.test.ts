import { describe, expect, it } from 'vitest';
import { specZombie } from '@/lib/gamespec/modeles';
import { construirePlan, prochaineTache } from '@/lib/orchestrateur/plan';

const env = {
  zones: ['hall', 'urgences', 'bloc_operatoire', 'parking', 'morgue'],
  anchors: { hall: { left: 0, up: 0, forward: 0 }, urgences: { left: 2400, up: 0, forward: 0 } },
};

describe('construirePlan', () => {
  const plan = construirePlan(specZombie({ gameId: 'g' }), env);
  const cles = plan.map((t) => t.key);

  it('produit des clés uniques et stables', () => {
    expect(new Set(cles).size).toBe(cles.length);
    expect(construirePlan(specZombie({ gameId: 'g' }), env).map((t) => t.key)).toEqual(cles);
  });

  it('ne dépend que de tâches qui existent', () => {
    const set = new Set(cles);
    for (const t of plan) for (const d of t.dependsOn) expect(set.has(d)).toBe(true);
  });

  it('place un device pour chaque besoin du plan, puis le configure', () => {
    const s = specZombie({ gameId: 'g' });
    for (const d of s.devices) {
      expect(cles).toContain(`device:${d.stableId}`);
      expect(cles).toContain(`config:${d.stableId}`);
    }
  });

  it('ne compile qu’une fois le Verse écrit et les devices configurés', () => {
    const compile = plan.find((t) => t.key === 'compile')!;
    expect(compile.dependsOn).toContain('verse:zombie_spawner');
    expect(compile.dependsOn).toContain('config:minuteur_manche');
  });

  it('enchaîne les tâches dans un ordre exécutable jusqu’au bout', () => {
    const etat = plan.map((t) => ({ ...t, status: 'pending' }));
    let n = 0;
    for (let t = prochaineTache(etat); t; t = prochaineTache(etat)) {
      t.status = 'done';
      n++;
    }
    expect(n).toBe(plan.length);
  });
});
