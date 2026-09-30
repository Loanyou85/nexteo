import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { authentifierAgent } from '@/server/agent/canal';
import { json, lireJson, NON_AUTORISE } from '@/server/agent/http';
import { db } from '@/server/db';

export const dynamic = 'force-dynamic';

const schema = z.object({
  version: z.string().max(40).optional(),
  /** Ce que l'agent a MESURÉ ; ce qu'il ne sait pas mesurer, il ne l'envoie pas. */
  diagnostics: z
    .object({
      mcp: z.object({ connecte: z.boolean(), endpoint: z.string().max(200).optional(), erreur: z.string().max(300).optional(), outils: z.number().int().min(0).optional() }).optional(),
      os: z.string().max(60).optional(),
      uefn: z.object({ installe: z.boolean(), version: z.string().max(40).optional() }).optional(),
      fortnite: z.object({ installe: z.boolean() }).optional(),
      pythonScripting: z.boolean().optional(),
      mcpToolsets: z.boolean().optional(),
      projet: z.object({ nom: z.string().max(120), mcpJson: z.boolean() }).nullable().optional(),
    })
    .strict(),
});

export async function POST(req: Request) {
  const agent = await authentifierAgent(req);
  if (!agent) return NON_AUTORISE();
  const c = await lireJson(req, schema);
  if (!c.ok) return c.reponse;
  await db.localAgent.update({
    where: { id: agent.id },
    data: { version: c.data.version ?? agent.version, diagnostics: c.data.diagnostics as Prisma.InputJsonValue, lastSeenAt: new Date() },
  });
  return json({ ok: true });
}
