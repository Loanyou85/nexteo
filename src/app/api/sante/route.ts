import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { lotsEnSouffrance } from '@/server/ingestion/pipeline';

export const dynamic = 'force-dynamic';

/**
 * État de santé, lisible par une sonde externe.
 *
 * Il ne se contente pas de répondre « en vie » : il dit si l'ingestion tourne.
 * Un site parfaitement debout qui n'ingère plus depuis trois jours est le seul
 * incident qui coûte quelque chose d'irrécupérable.
 */
export async function GET() {
  const debut = Date.now();

  try {
    const [annonceurs, annonces, observations, derniere] = await Promise.all([
      db.advertiser.count(),
      db.ad.count(),
      db.adObservation.count(),
      db.ingestJob.findFirst({
        where: { status: 'succeeded' },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
    ]);

    const souffrance = await lotsEnSouffrance(db);
    const heuresDepuisIngestion = derniere?.finishedAt
      ? Math.round((Date.now() - derniere.finishedAt.getTime()) / 3_600_000)
      : null;

    // Plus de 48 h sans ingestion réussie : deux jours de données perdues.
    const enRetard = heuresDepuisIngestion === null || heuresDepuisIngestion > 48;
    const ok = !enRetard && souffrance.length === 0;

    return NextResponse.json(
      {
        etat: ok ? 'ok' : 'degrade',
        base: { annonceurs, annonces, observations, msLecture: Date.now() - debut },
        ingestion: {
          derniereReussite: derniere?.finishedAt?.toISOString() ?? null,
          heuresDepuis: heuresDepuisIngestion,
          lotsEnSouffrance: souffrance.length,
        },
      },
      { status: ok ? 200 : 503 },
    );
  } catch (e) {
    return NextResponse.json(
      { etat: 'hors-service', erreur: (e as Error).message.slice(0, 200) },
      { status: 503 },
    );
  }
}
