import Link from 'next/link';
import { TopBar } from '@/components/shell/top-bar';
import { NavMobile } from '@/components/shell/nav-mobile';
import { Button } from '@/components/ui/button';
import { CarteAnnonceur } from '@/components/annonce/carte-annonceur';
import { RechercheAccueil } from '@/components/landing/recherche';
import { Faq } from '@/components/landing/faq';
import { MENTION_SOURCE } from '@/lib/guardrails';
import { rechercherAnnonceurs } from '@/server/annonceurs';
import { sessionOuNull } from '@/server/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nexteo — Arrête de chercher des idées. Regarde qui paie déjà pour vendre.',
  description:
    'Découvre les SaaS et applications qui dépensent en publicité depuis des mois, lis leurs ' +
    'annonces, leurs accroches et leurs pages de vente, et comprends ce qui fonctionne avant de construire.',
};

/** Trois arguments, dans l'ordre où la question se pose au visiteur. */
const EXPLICATIONS = [
  {
    titre: 'Une campagne se paie tous les jours.',
    texte:
      'Personne ne finance une publicité perdante pendant huit mois. Quand une entreprise diffuse ' +
      'la même annonce sans interruption depuis des mois, elle a décidé chaque jour de continuer à payer.',
  },
  {
    titre: 'Ce que Nexteo mesure est vérifiable.',
    texte:
      'Pas une estimation, pas une déduction : la durée de diffusion, les interruptions, le nombre ' +
      'd’annonces simultanées, le rythme de production de créations. Chaque annonce renvoie vers son ' +
      'instantané officiel chez Meta.',
  },
  {
    titre: 'L’archive Meta oublie. Pas Nexteo.',
    texte:
      'Meta retire une annonce commerciale environ douze mois après sa dernière impression. Nexteo ' +
      'ingère tous les jours et ne supprime jamais — les annonces déjà effacées de chez Meta ne sont ' +
      'plus trouvables ailleurs.',
  },
];

const COMPARAISON: { quoi: string; aLaMain: string; avecNexteo: string }[] = [
  {
    quoi: 'Trouver les annonceurs d’un secteur',
    aLaMain: 'Une recherche par mot-clé à la fois, pays par pays',
    avecNexteo: 'Une recherche, tous les pays ingérés, triés par signal',
  },
  {
    quoi: 'Savoir depuis quand ça tourne',
    aLaMain: 'Ouvrir chaque annonce et lire sa date de début',
    avecNexteo: 'Affiché sur la fiche, avec les interruptions',
  },
  {
    quoi: 'Voir les annonces arrêtées',
    aLaMain: 'Impossible : Meta les a effacées',
    avecNexteo: 'Conservées et signalées comme supprimées',
  },
  {
    quoi: 'Suivre un annonceur dans le temps',
    aLaMain: 'Refaire la recherche et comparer de tête',
    avecNexteo: 'Alerte à chaque nouvelle création',
  },
];

export default async function AccueilPage() {
  const [{ lignes }, session] = await Promise.all([
    rechercherAnnonceurs({ tri: 'signal', enDiffusion: true }, undefined, 6),
    sessionOuNull(),
  ]);

  return (
    <div className="min-h-dvh">
      <TopBar connecte={Boolean(session)} />

      <main className="pb-20 md:pb-0">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="halo-neo pointer-events-none absolute -top-40 left-1/2 h-[min(560px,100vw)] w-[min(560px,100vw)] -translate-x-1/2"
          />
          <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-12 sm:pt-20">
            <h1 className="display text-2xl sm:text-3xl">
              Arrête de chercher des idées.
              <br />
              Regarde qui paie déjà pour vendre.
            </h1>

            <p className="mt-5 max-w-2xl text-md text-encre-2">
              Découvre les SaaS et applications qui dépensent en publicité depuis des mois, lis leurs
              annonces, leurs accroches et leurs pages de vente, et comprends ce qui fonctionne avant
              de construire.
            </p>

            <div className="mt-8 max-w-2xl">
              <RechercheAccueil />
              {/* Mention permanente (section 6.1). Elle ne se replie pas. */}
              <p className="mt-4 text-xs text-encre-2">{MENTION_SOURCE}</p>
            </div>

            <p className="mt-6">
              <Link
                href="#comment"
                className="text-sm text-encre-2 underline underline-offset-4 hover:text-encre"
              >
                Comment ça marche
              </Link>
            </p>
          </div>
        </section>

        {/* Signal fort */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg">Ils diffusent depuis le plus longtemps</h2>
            <Link
              href="/explore"
              className="shrink-0 text-sm text-encre-2 underline underline-offset-4 hover:text-encre"
            >
              Tout explorer
            </Link>
          </div>

          {lignes.length === 0 ? (
            <p className="mt-6 text-sm text-encre-2">
              L’ingestion n’a pas encore tourné sur cette base. Les annonceurs apparaîtront ici dès
              la première exécution du pipeline.
            </p>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lignes.map((a) => (
                <CarteAnnonceur key={a.id} a={a} />
              ))}
            </div>
          )}
        </section>

        {/* Explication */}
        <section id="comment" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
          <h2 className="text-lg">Pourquoi la durée de diffusion, et pas le chiffre d’affaires</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {EXPLICATIONS.map((e) => (
              <div key={e.titre}>
                <h3 className="text-base font-semibold text-encre">{e.titre}</h3>
                <p className="mt-2 text-sm text-encre-2">{e.texte}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Comparaison */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-lg">À la main, ou avec Nexteo</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-bordure text-2xs uppercase tracking-wide text-encre-2">
                  <th className="py-2 pr-4 font-medium">Ce que tu veux savoir</th>
                  <th className="py-2 pr-4 font-medium">Dans la bibliothèque Meta</th>
                  <th className="py-2 font-medium">Avec Nexteo</th>
                </tr>
              </thead>
              <tbody>
                {COMPARAISON.map((l) => (
                  <tr key={l.quoi} className="border-b border-bordure">
                    <td className="py-3 pr-4 align-top text-encre">{l.quoi}</td>
                    <td className="py-3 pr-4 align-top text-encre-2">{l.aLaMain}</td>
                    <td className="py-3 align-top text-encre">{l.avecNexteo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="text-lg">Questions</h2>
          <div className="mt-6">
            <Faq />
          </div>
        </section>

        {/* Appel final */}
        <section className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="display text-xl">Regarde qui paie déjà, dans ton secteur.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-encre-2">
            La recherche et la liste des annonceurs sont ouvertes, sans compte.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild taille="capsule">
              <Link href="/explore">Explorer les annonceurs</Link>
            </Button>
            <Button asChild taille="capsule" variant="secondaire">
              <Link href="/tarifs">Voir les tarifs</Link>
            </Button>
          </div>
        </section>

        <footer className="border-t border-bordure">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-encre-2 sm:flex-row sm:items-center sm:justify-between">
            <p>{MENTION_SOURCE}</p>
            <nav className="flex gap-4">
              <Link href="/legal/mentions" className="hover:text-encre">
                Mentions légales
              </Link>
              <Link href="/legal/confidentialite" className="hover:text-encre">
                Confidentialité
              </Link>
              <Link href="/legal/cgv" className="hover:text-encre">
                CGV
              </Link>
            </nav>
          </div>
        </footer>
      </main>

      <NavMobile />
    </div>
  );
}
