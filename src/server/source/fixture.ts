import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AdSource, AnnonceBrute, PageAnnonces, RequeteAnnonces } from './types';

/**
 * Source de développement (section 8.3).
 *
 * Elle lit le même chemin de code que la source réelle : mêmes champs, même
 * pagination par curseur, même obligation de préciser un pays. C'est tout
 * l'intérêt — le jour où l'accès Meta s'ouvre, seule la variable
 * d'environnement change, pas le pipeline.
 *
 * `estDemo` vaut vrai : tout ce qui entre par ici est marqué et signalé.
 */

type AnnonceFixture = AnnonceBrute & {
  _joursDebut: number;
  _joursFin: number | null;
};

type Fichier = {
  avertissement: string;
  genereLe: string;
  annonces: AnnonceFixture[];
};

const JOUR_MS = 86_400_000;

/** Supprime les accents et la casse, pour que « resume » trouve « résumé ». */
function aplatir(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function isoIlYA(jours: number, maintenant: Date): string {
  return new Date(maintenant.getTime() - jours * JOUR_MS).toISOString();
}

export class FixtureSource implements AdSource {
  readonly nom = 'fixture';
  readonly estDemo = true;

  private cache: Fichier | null = null;

  constructor(
    private readonly chemin = join(process.cwd(), 'fixtures', 'annonces.json'),
    /** Injectable pour que les tests ne dépendent pas de l'heure qu'il est. */
    private readonly horloge: () => Date = () => new Date(),
  ) {}

  private charger(): Fichier {
    if (!this.cache) {
      this.cache = JSON.parse(readFileSync(this.chemin, 'utf8')) as Fichier;
    }
    return this.cache;
  }

  /**
   * Transforme les décalages en jours en vraies dates. Les fixtures sont
   * stockées en relatif pour ne pas vieillir : un fichier figé finirait par
   * ne décrire que des campagnes arrêtées depuis longtemps.
   */
  private materialiser(a: AnnonceFixture, maintenant: Date): AnnonceBrute {
    const { _joursDebut, _joursFin, ...reste } = a;
    return {
      ...reste,
      ad_delivery_start_time: isoIlYA(_joursDebut, maintenant),
      ad_delivery_stop_time: _joursFin === null ? null : isoIlYA(_joursFin, maintenant),
    };
  }

  async recuperer(requete: RequeteAnnonces): Promise<PageAnnonces> {
    const maintenant = this.horloge();
    const taille = Math.min(Math.max(requete.taille ?? 50, 1), 500);
    const pays = requete.pays.trim().toUpperCase();
    const terme = aplatir(requete.terme.trim());

    const correspond = (a: AnnonceFixture): boolean => {
      if (!a.ad_reached_countries?.some((p) => p.toUpperCase() === pays)) return false;
      if (!terme) return true;
      const champs = [
        a.page_name ?? '',
        ...(a.ad_creative_bodies ?? []),
        ...(a.ad_creative_link_titles ?? []),
        ...(a.ad_creative_link_descriptions ?? []),
        ...(a.ad_creative_link_captions ?? []),
      ];
      return champs.some((c) => aplatir(c).includes(terme));
    };

    const retenues = this.charger().annonces.filter(correspond);

    // Curseur = position dans la liste filtrée. Opaque côté appelant, comme
    // celui de Meta : le pipeline le persiste sans jamais l'interpréter.
    const depart = Number.parseInt(requete.curseur ?? '0', 10);
    const debut = Number.isFinite(depart) && depart > 0 ? depart : 0;
    const page = retenues.slice(debut, debut + taille);
    const suivant = debut + taille;

    return {
      annonces: page.map((a) => this.materialiser(a, maintenant)),
      curseurSuivant: suivant < retenues.length ? String(suivant) : null,
    };
  }
}
