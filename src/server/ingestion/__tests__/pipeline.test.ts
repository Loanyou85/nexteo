import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { executerIngestion, lotsEnSouffrance } from '../pipeline';
import { StockageAbsent } from '@/server/stockage';
import {
  ErreurDebit,
  type AdSource,
  type AnnonceBrute,
  type PageAnnonces,
  type RequeteAnnonces,
} from '@/server/source';

/**
 * Tests d'intégration du pipeline, sur une vraie base.
 *
 * Les propriétés vérifiées ici sont celles qui décident si une journée
 * d'ingestion est perdue ou non : reprise exacte au curseur, temporisation
 * sur dépassement de débit, et refus de laisser une annonce illisible faire
 * tomber le lot. Elles ne se testent pas sans base — une transaction
 * partielle et un curseur persisté ne s'imitent pas.
 *
 * La suite se saute d'elle-même quand TEST_DATABASE_URL n'est pas joignable,
 * pour ne pas rendre `npm test` dépendant d'un Postgres local.
 */

const URL_TEST = process.env.TEST_DATABASE_URL?.trim();
const db = URL_TEST
  ? new PrismaClient({ datasources: { db: { url: URL_TEST } } })
  : (null as unknown as PrismaClient);

const joignable = await (async () => {
  if (!db) return false;
  try {
    await db.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
})();

const suite = joignable ? describe : describe.skip;

const MAINTENANT = new Date('2026-09-26T12:00:00Z');
const JOUR = 86_400_000;

function annonce(id: string, p: Partial<AnnonceBrute> = {}): AnnonceBrute {
  return {
    id,
    page_id: 'page-1',
    page_name: 'Facturio',
    ad_snapshot_url: `https://www.facebook.com/ads/library/?id=${id}`,
    ad_delivery_start_time: new Date(MAINTENANT.getTime() - 200 * JOUR).toISOString(),
    ad_creative_bodies: [`Accroche ${id}`],
    ad_creative_link_captions: ['facturio.fr'],
    ad_reached_countries: ['FR'],
    publisher_platforms: ['facebook'],
    ...p,
  };
}

/** Source scriptée : on lui dicte page par page ce qu'elle rend ou lève. */
class SourceScriptee implements AdSource {
  readonly nom = 'scriptee';
  readonly appels: RequeteAnnonces[] = [];

  constructor(
    private readonly etapes: (PageAnnonces | Error)[],
    readonly estDemo = false,
  ) {}

  async recuperer(r: RequeteAnnonces): Promise<PageAnnonces> {
    this.appels.push({ ...r });
    const etape = this.etapes.shift();
    if (!etape) return { annonces: [], curseurSuivant: null };
    if (etape instanceof Error) throw etape;
    return etape;
  }
}

async function vider(): Promise<void> {
  // L'ordre suit les clés étrangères ; AdObservation part avec ses annonces.
  await db.adObservation.deleteMany({});
  await db.adCreative.deleteMany({});
  await db.ad.deleteMany({});
  await db.advertiser.deleteMany({});
  await db.ingestJob.deleteMany({});
}

function lancer(source: AdSource, extra: Parameters<typeof executerIngestion>[0] = {}) {
  return executerIngestion({
    db,
    source,
    stockage: new StockageAbsent('test'),
    pays: ['FR'],
    termes: ['facturation'],
    maintenant: MAINTENANT,
    attendre: async () => {},
    journal: () => {},
    ...extra,
  });
}

suite('pipeline d’ingestion', () => {
  beforeEach(vider);
  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it('écrit annonceur, annonce et observation en un passage', async () => {
    const r = await lancer(
      new SourceScriptee([{ annonces: [annonce('a1'), annonce('a2')], curseurSuivant: null }]),
    );

    expect(r.annoncesVues).toBe(2);
    expect(r.annoncesNouvelles).toBe(2);
    expect(r.annonceursCrees).toBe(1);
    expect(await db.ad.count()).toBe(2);
    expect(await db.adObservation.count()).toBe(2);
  });

  it('empile les observations sans dupliquer les annonces', async () => {
    const page = () => ({ annonces: [annonce('a1')], curseurSuivant: null });
    await lancer(new SourceScriptee([page()]));
    await lancer(new SourceScriptee([page()]));

    // Une observation par exécution, même si rien n'a changé : c'est cet
    // empilement qui permet de calculer la continuité.
    expect(await db.ad.count()).toBe(1);
    expect(await db.adObservation.count()).toBe(2);
  });

  it('marque la donnée comme démonstration quand la source le déclare', async () => {
    await lancer(new SourceScriptee([{ annonces: [annonce('a1')], curseurSuivant: null }], true));
    const [a] = await db.advertiser.findMany();
    const [pub] = await db.ad.findMany();
    expect(a?.isDemo).toBe(true);
    expect(pub?.isDemo).toBe(true);
  });

  it('saute une annonce illisible sans perdre le reste du lot', async () => {
    const r = await lancer(
      new SourceScriptee([
        {
          annonces: [
            annonce('bon1'),
            // Sans instantané officiel : inaffichable, donc non stockée.
            annonce('sansLien', { ad_snapshot_url: '' }),
            annonce('dateFolle', { ad_delivery_start_time: 'la semaine prochaine' }),
            annonce('bon2'),
          ],
          curseurSuivant: null,
        },
      ]),
    );

    expect(r.annoncesIgnorees).toBe(2);
    expect(r.annoncesNouvelles).toBe(2);
    expect((await db.ad.findMany({ select: { metaAdId: true } })).map((a) => a.metaAdId).sort())
      .toEqual(['bon1', 'bon2']);
  });

  it('temporise sur dépassement de débit puis reprend', async () => {
    const attentes: number[] = [];
    const source = new SourceScriptee([
      new ErreurDebit('quota atteint'),
      new ErreurDebit('quota atteint'),
      { annonces: [annonce('a1')], curseurSuivant: null },
    ]);

    const r = await lancer(source, { attendre: async (ms) => void attentes.push(ms) });

    expect(r.echecs).toHaveLength(0);
    expect(r.annoncesNouvelles).toBe(1);
    expect(attentes).toHaveLength(2);
    // Repli exponentiel : la seconde attente est plus longue que la première.
    expect(attentes[1]).toBeGreaterThan(attentes[0]!);
  });

  it('respecte le délai que l’API réclame quand elle en donne un', async () => {
    const attentes: number[] = [];
    await lancer(
      new SourceScriptee([
        new ErreurDebit('patiente', 7777),
        { annonces: [annonce('a1')], curseurSuivant: null },
      ]),
      { attendre: async (ms) => void attentes.push(ms) },
    );
    expect(attentes).toEqual([7777]);
  });

  it('abandonne le lot après trop de tentatives, en conservant le curseur', async () => {
    const r = await lancer(
      new SourceScriptee([
        { annonces: [annonce('a1')], curseurSuivant: 'CURSEUR-2' },
        new ErreurDebit('quota'),
        new ErreurDebit('quota'),
        new ErreurDebit('quota'),
      ]),
      { tentativesMax: 2 },
    );

    expect(r.echecs).toHaveLength(1);
    const job = await db.ingestJob.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(job?.status).toBe('failed');
    // Le curseur survit : c'est lui qui évite de repayer les pages déjà lues.
    expect(job?.cursor).toBe('CURSEUR-2');
  });

  it('reprend exactement au curseur laissé par une exécution interrompue', async () => {
    await lancer(
      new SourceScriptee([
        { annonces: [annonce('a1')], curseurSuivant: 'PAGE-2' },
        new Error('coupure réseau'),
      ]),
    );

    const apresPanne = await db.ingestJob.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(apresPanne?.status).toBe('failed');
    expect(apresPanne?.cursor).toBe('PAGE-2');

    const reprise = new SourceScriptee([{ annonces: [annonce('a2')], curseurSuivant: null }]);
    const r = await lancer(reprise);

    // La reprise redemande la page 2, pas la première : sans ça, une coupure
    // à la page 180 ferait repayer 180 pages de quota.
    expect(reprise.appels[0]?.curseur).toBe('PAGE-2');
    expect(r.annoncesNouvelles).toBe(1);
    expect(await db.ad.count()).toBe(2);
  });

  it('remet le curseur à zéro une fois le lot terminé', async () => {
    await lancer(new SourceScriptee([{ annonces: [annonce('a1')], curseurSuivant: null }]));
    const job = await db.ingestJob.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(job?.status).toBe('succeeded');
    expect(job?.cursor).toBeNull();
  });

  it('s’arrête au plafond de pages plutôt que de boucler indéfiniment', async () => {
    // Une source qui rend toujours un curseur, comme le ferait une API qui se
    // comporte mal.
    const sansFin: AdSource = {
      nom: 'sansFin',
      estDemo: false,
      recuperer: async () => ({ annonces: [annonce(`x${Math.random()}`)], curseurSuivant: 'encore' }),
    };
    const r = await lancer(sansFin, { pagesMax: 5 });
    expect(r.annoncesVues).toBe(5);
    expect(r.echecs).toHaveLength(0);
  });

  it('marque retirées les annonces qu’on ne revoit plus depuis un mois', async () => {
    await lancer(new SourceScriptee([{ annonces: [annonce('vieille')], curseurSuivant: null }]));
    await db.ad.updateMany({ data: { lastSeenAt: new Date(MAINTENANT.getTime() - 40 * JOUR) } });

    const r = await lancer(new SourceScriptee([{ annonces: [], curseurSuivant: null }]));

    expect(r.marqueesDisparues).toBe(1);
    const [a] = await db.ad.findMany();
    expect(a?.goneFromMeta).toBe(true);
    expect(a?.isActive).toBe(false);
    // Elle reste en base : c'est précisément ce qu'aucun concurrent ne pourra
    // reconstituer.
    expect(await db.ad.count()).toBe(1);
  });

  it('calcule et enregistre le signal des annonceurs touchés', async () => {
    await lancer(new SourceScriptee([{ annonces: [annonce('a1')], curseurSuivant: null }]));
    const [a] = await db.advertiser.findMany();

    expect(a?.signalComputedAt).toBeInstanceOf(Date);
    expect(a?.signalScore).toBeGreaterThan(0);
    const detail = (a?.signalBreakdown as { detail?: unknown[] })?.detail;
    expect(Array.isArray(detail)).toBe(true);
    expect(detail).toHaveLength(6);
  });

  it('classe l’annonceur par règles et le marque à revoir', async () => {
    await lancer(new SourceScriptee([{ annonces: [annonce('a1')], curseurSuivant: null }]));
    const a = await db.advertiser.findFirst({ include: { category: true } });
    expect(a?.category?.slug).toBe('devis-et-facturation');
    // Un rattachement par règle n'est pas un fait : il attend confirmation.
    expect(a?.needsReview).toBe(true);
  });

  it('signale les lots échoués deux fois de suite', async () => {
    const casse = () => new SourceScriptee([new Error('base indisponible')]);
    await lancer(casse());
    await lancer(casse());

    const souffrance = await lotsEnSouffrance(db);
    expect(souffrance).toHaveLength(1);
    expect(souffrance[0]?.pays).toBe('FR');
    expect(souffrance[0]?.echecs).toBeGreaterThanOrEqual(2);
  });

  it('ne signale rien quand le lot a fini par passer', async () => {
    await lancer(new SourceScriptee([new Error('coupure')]));
    await lancer(new SourceScriptee([{ annonces: [annonce('a1')], curseurSuivant: null }]));
    expect(await lotsEnSouffrance(db)).toHaveLength(0);
  });

  it('continue sans stockage objet configuré', async () => {
    const r = await lancer(new SourceScriptee([{ annonces: [annonce('a1')], curseurSuivant: null }]));
    // Perdre une journée d'annonces parce qu'un bucket manque coûterait
    // infiniment plus cher que de ne pas copier les visuels.
    expect(r.echecs).toHaveLength(0);
    expect(r.visuelsCopies).toBe(0);
    expect(await db.ad.count()).toBe(1);
  });
});
