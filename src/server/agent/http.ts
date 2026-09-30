import 'server-only';
import type { z } from 'zod';

/** Corps JSON borné : un agent (ou quiconque) ne peut pas nous envoyer un fichier de 500 Mo. */
export const MAX_CORPS_OCTETS = 1_200_000;

export async function lireJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; reponse: Response }> {
  const annonce = Number(req.headers.get('content-length') ?? '0');
  if (annonce > MAX_CORPS_OCTETS) return { ok: false, reponse: json({ erreur: 'Corps trop gros.' }, 413) };
  let brut: string;
  try {
    brut = await req.text();
  } catch {
    return { ok: false, reponse: json({ erreur: 'Corps illisible.' }, 400) };
  }
  if (Buffer.byteLength(brut) > MAX_CORPS_OCTETS) return { ok: false, reponse: json({ erreur: 'Corps trop gros.' }, 413) };
  let valeur: unknown;
  try {
    valeur = JSON.parse(brut);
  } catch {
    return { ok: false, reponse: json({ erreur: 'JSON invalide.' }, 400) };
  }
  const r = schema.safeParse(valeur);
  if (!r.success) return { ok: false, reponse: json({ erreur: 'Requête invalide.', details: r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`) }, 400) };
  return { ok: true, data: r.data };
}

export function json(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export const NON_AUTORISE = () => json({ erreur: 'Jeton absent, invalide ou révoqué.' }, 401);
