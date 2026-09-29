import 'server-only';
import { AnthropicProvider } from '@/lib/ai/anthropic';
import { IASimulee } from '@/lib/ai/simule';
import { coutEurMicros } from '@/lib/ai/tarifs';
import type { AIProvider, Resultat, Usage } from '@/lib/ai/types';
import { configEntier } from '@/server/config';
import { db } from '@/server/db';
import { modeIa } from '@/server/mode';

/**
 * Point d'accès unique à l'IA. Chaque appel écrit un UsageEvent avec son coût
 * estimé, rattaché à l'utilisateur, au projet et au build — sans cette mesure,
 * impossible de savoir si les prix couvrent les coûts (section 26).
 */

let instance: AIProvider | null = null;

export function fournisseurIA(): AIProvider {
  if (!instance) instance = modeIa() === 'anthropic' ? new AnthropicProvider() : new IASimulee();
  return instance;
}

export type ContexteAppel = {
  userId: string;
  projectId?: string;
  buildId?: string;
  type: 'plan' | 'verse' | 'analyse' | 'correctif';
};

export async function appelIA<T>(
  ctx: ContexteAppel,
  appel: (ia: AIProvider) => Promise<Resultat<T>>,
): Promise<{ valeur: T; usage: Usage; coutEurMicros: number; simule: boolean }> {
  const ia = fournisseurIA();
  const r = await appel(ia);
  const taux = await configEntier('USD_EUR_RATE_PPM');
  const cout = coutEurMicros(r.usage, taux);
  const simule = ia.nom === 'simule';

  await db.usageEvent.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId ?? null,
      buildId: ctx.buildId ?? null,
      type: ctx.type,
      provider: ia.nom,
      model: r.usage.model,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
      cacheReadTokens: r.usage.cacheReadTokens,
      cacheWriteTokens: r.usage.cacheWriteTokens,
      costEurMicros: cout,
      simulated: simule,
    },
  });

  if (ctx.buildId) {
    await db.agentSession.update({
      where: { id: ctx.buildId },
      data: {
        tokensUsed: { increment: r.usage.inputTokens + r.usage.outputTokens },
        costEurMicros: { increment: cout },
      },
    });
  }

  return { valeur: r.valeur, usage: r.usage, coutEurMicros: cout, simule };
}
