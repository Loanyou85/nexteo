import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Stockage objet des visuels.
 *
 * Les URL rendues par Meta expirent : ce qui n'est pas copié à l'ingestion est
 * perdu, comme l'annonce elle-même quand l'archive la retire. C'est le même
 * principe que l'historique d'observations — ce qu'on ne prend pas aujourd'hui,
 * personne ne pourra le reprendre.
 *
 * Deux implémentations. Quand rien n'est configuré, on n'échoue pas : le
 * pipeline continue et note que le visuel reste à copier. Une ingestion qui
 * s'arrête parce qu'un bucket manque perdrait une journée de données pour une
 * raison qui n'a rien à voir.
 */

export type ResultatCopie =
  | { copie: true; storageKey: string; checksum: string; octets: number }
  | { copie: false; checksum: string | null; raison: string };

export interface StockageObjet {
  readonly configure: boolean;
  /** Copie le fichier s'il n'est pas déjà présent. Idempotent par somme de contrôle. */
  copier(url: string, prefixe: string): Promise<ResultatCopie>;
  /** URL publique d'un objet copié, quand le stockage en expose une. */
  urlPublique(storageKey: string): string | null;
}

function extension(typeMime: string | undefined, url: string): string {
  const parType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
  };
  const connu = typeMime ? parType[typeMime] : undefined;
  if (connu) return connu;
  const m = /\.([a-z0-9]{2,4})(?:\?|$)/i.exec(url);
  return m?.[1]?.toLowerCase() ?? 'bin';
}

/** Stockage absent ou mal configuré. Ne fait rien, et le dit. */
export class StockageAbsent implements StockageObjet {
  readonly configure = false;
  constructor(private readonly raison: string) {}

  async copier(): Promise<ResultatCopie> {
    return { copie: false, checksum: null, raison: this.raison };
  }

  urlPublique(): string | null {
    return null;
  }
}

export class StockageS3 implements StockageObjet {
  readonly configure = true;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly basePublique: string | null,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async copier(url: string, prefixe: string): Promise<ResultatCopie> {
    let corps: ArrayBuffer;
    let typeMime: string | undefined;

    try {
      const r = await this.fetcher(url);
      if (!r.ok) return { copie: false, checksum: null, raison: `téléchargement HTTP ${r.status}` };
      typeMime = r.headers.get('content-type') ?? undefined;
      corps = await r.arrayBuffer();
    } catch (e) {
      return { copie: false, checksum: null, raison: `téléchargement impossible : ${(e as Error).message}` };
    }

    const octets = new Uint8Array(corps);
    if (octets.byteLength === 0) return { copie: false, checksum: null, raison: 'fichier vide' };

    const checksum = createHash('sha256').update(octets).digest('hex');
    // La clé dérive de la somme de contrôle : deux annonces qui réutilisent le
    // même visuel partagent le même objet, et une reprise après interruption
    // réécrit au même endroit au lieu de dupliquer.
    const storageKey = `${prefixe}/${checksum.slice(0, 2)}/${checksum}.${extension(typeMime, url)}`;

    try {
      await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      return { copie: true, storageKey, checksum, octets: octets.byteLength };
    } catch {
      // Absent : on écrit.
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: octets,
          ContentType: typeMime,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (e) {
      return { copie: false, checksum, raison: `écriture refusée : ${(e as Error).message}` };
    }

    return { copie: true, storageKey, checksum, octets: octets.byteLength };
  }

  urlPublique(storageKey: string): string | null {
    if (!this.basePublique) return null;
    return `${this.basePublique.replace(/\/+$/, '')}/${storageKey}`;
  }
}

export function stockageObjet(): StockageObjet {
  const bucket = process.env.S3_BUCKET?.trim();
  const cle = process.env.S3_ACCESS_KEY_ID?.trim();
  const secret = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !cle || !secret) {
    return new StockageAbsent(
      'stockage objet non configuré (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)',
    );
  }

  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || 'eu-west-3',
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    // Nécessaire pour les hébergeurs compatibles S3 qui n'exposent pas de
    // sous-domaine par bucket.
    forcePathStyle: Boolean(process.env.S3_ENDPOINT?.trim()),
    credentials: { accessKeyId: cle, secretAccessKey: secret },
  });

  return new StockageS3(client, bucket, process.env.S3_PUBLIC_BASE_URL?.trim() || null);
}
