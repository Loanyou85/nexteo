import { sessionOuNull } from '@/server/auth';
import { etatConsole, evenementsDepuis, workerVivant } from '@/server/console';
import { db } from '@/server/db';
import { avancer } from '@/server/orchestrateur/boucle';

/**
 * Flux SSE de la console (section 25).
 *
 * Reprise par `Last-Event-ID` : une reconnexion ne rejoue ni ne perd rien.
 * Les générations SIMULÉES avancent aussi depuis ce flux quand aucun worker
 * ne tourne (DECISIONS n° 10) : sur Vercel, il n'y a pas de processus
 * permanent, et une construction simulée ne doit pas rester figée faute de
 * worker. Le bail sur le projet empêche tout chevauchement avec un worker.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PAUSE_MS = 400;
const TRANCHE_MS = 2_500;
const DUREE_FLUX_MS = 240_000;

export async function GET(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const auth = await sessionOuNull();
  if (!auth?.user?.id) return new Response('Non connecté', { status: 401 });

  const session = await db.agentSession.findFirst({
    where: { id: sessionId, project: { userId: auth.user.id } },
    select: { id: true, provider: true },
  });
  if (!session) return new Response('Introuvable', { status: 404 });

  const depart = req.headers.get('last-event-id') ?? new URL(req.url).searchParams.get('depuis') ?? '0';
  let curseur = /^\d+$/.test(depart) ? BigInt(depart) : 0n;
  const encodeur = new TextEncoder();
  const fin = Date.now() + DUREE_FLUX_MS;

  const flux = new ReadableStream({
    async start(controle) {
      const envoyer = (texte: string) => controle.enqueue(encodeur.encode(texte));
      let empreinte = '';
      let ouvert = true;
      req.signal.addEventListener('abort', () => (ouvert = false));

      envoyer('retry: 1500\n\n');
      while (ouvert && Date.now() < fin) {
        const evts = await evenementsDepuis(sessionId, curseur);
        for (const e of evts) {
          envoyer(`id: ${e.seq}\nevent: evenement\ndata: ${JSON.stringify(e)}\n\n`);
          curseur = BigInt(e.seq);
        }

        const etat = await etatConsole(sessionId);
        if (!etat) break;
        const nouvelle = JSON.stringify([etat.session, etat.tier, etat.etapes.map((x) => [x.statut, x.taches.map((t) => t.status)])]);
        if (nouvelle !== empreinte) {
          empreinte = nouvelle;
          envoyer(`event: etat\ndata: ${JSON.stringify(etat)}\n\n`);
        }

        const active = ['queued', 'running', 'stopping'].includes(etat.session.status);
        if (!active && evts.length === 0) {
          envoyer('event: fin\ndata: {}\n\n');
          break;
        }

        if (active && session.provider === 'mock' && !(await workerVivant())) {
          await avancer(sessionId, TRANCHE_MS);
        } else {
          await new Promise((r) => setTimeout(r, PAUSE_MS));
        }
        // Commentaire de maintien : certains proxys coupent un flux silencieux.
        envoyer(': ping\n\n');
      }
      controle.close();
    },
  });

  return new Response(flux, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
