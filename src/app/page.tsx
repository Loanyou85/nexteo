import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Phone } from '@/components/landing/phone';
import { Marquee } from '@/components/landing/marquee';
import { Reveal } from '@/components/landing/reveal';
import { Counters } from '@/components/landing/counters';
import { Scrollytelling } from '@/components/landing/scrollytelling';
import { Comparison } from '@/components/landing/comparison';
import { Faq } from '@/components/landing/faq';
import { db } from '@/server/db';
import { GUARANTEE_DAYS } from '@/lib/guarantee';

export const dynamic = 'force-dynamic';

const PROMESSES = [
  {
    titre: 'Trouve ton idée',
    texte:
      'Un diagnostic qui part de ce que tu connais de l’intérieur. Trois idées, et pour chacune, les réponses qui l’ont produite.',
    large: true,
  },
  {
    titre: 'Construis-le sans coder',
    texte: 'Treize phases, de la page blanche au paiement encaissé. Les prompts sont écrits pour toi.',
  },
  {
    titre: 'Vends-le',
    texte: 'Trente scripts de vidéos, un par jour, générés pour ton produit et ton public.',
  },
];

export default async function AccueilPage() {
  // Garde-fou n° 3 : aucun chiffre inventé. Ceux-ci sont lus en base.
  const [phases, etapes, prompts, aventures] = await Promise.all([
    db.phase.count(),
    db.step.count(),
    db.promptTemplate.count({ where: { isRepair: false } }),
    db.adventure.findMany({
      where: { isPublic: true },
      take: 6,
      orderBy: { startedAt: 'desc' },
      select: { slug: true, story: true, isDemo: true },
    }),
  ]);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-gris-700/60 bg-nuit-900/85 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between gap-3 px-4">
          <Logo />
          {/* Section 2.2 : aucun menu sur mobile. Un logo, un bouton — et ce
              bouton sert à revenir, pas à commencer : commencer, c'est le
              grand bouton du hero et celui de la barre du bas. */}
          <Button asChild taille="md">
            <Link href="/connexion">Se connecter</Link>
          </Button>
        </div>
      </header>

      <main className="pb-28">
        <section className="relative mx-auto max-w-5xl px-4 pt-8 md:pt-16">
          <div aria-hidden className="halo-neo pointer-events-none absolute left-1/2 top-0 -z-10 h-[min(520px,100vw)] w-[min(520px,100vw)] -translate-x-1/2" />

          <div className="md:grid md:grid-cols-2 md:items-center md:gap-12">
            <div>
              <p className="lever inline-flex rounded-full border border-neo-500/30 bg-neo-500/10 px-4 py-1.5 text-xs text-neo-100" style={{ ['--rang' as string]: 0 }}>
                Sans coder · 7 jours
              </p>

              <h1
                className="lever mt-6 font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.03em] text-white md:text-[64px]"
                style={{ ['--rang' as string]: 1 }}
              >
                Crée ton SaaS de A à Z, étape par étape.
              </h1>

              <p className="lever mt-5 text-sm text-gris-300 md:text-base" style={{ ['--rang' as string]: 2 }}>
                Trouve ton idée, mets ton site en ligne, encaisse tes premiers paiements.
              </p>

              <div className="lever mt-7" style={{ ['--rang' as string]: 3 }}>
                <Button asChild taille="lg" className="w-full md:w-auto">
                  <Link href="/diagnostic">
                    Trouver mon idée
                    <span aria-hidden>→</span>
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lever mt-12 md:mt-0" style={{ ['--rang' as string]: 4 }}>
              <Phone />
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-gris-300">
            Sans code · Sans équipe · Sans budget de départ
          </p>
        </section>

        <div className="mt-12">
          <Marquee />
        </div>

        <section className="mx-auto mt-16 max-w-5xl px-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PROMESSES.map((promesse, index) => (
              <Reveal key={promesse.titre} delay={index * 60} className={promesse.large ? 'md:col-span-2' : ''}>
                <article
                  className={`h-full rounded-card border border-gris-700 bg-nuit-800 p-6 ${
                    promesse.large ? 'md:p-8' : ''
                  }`}
                >
                  <h2 className={`font-extrabold text-white ${promesse.large ? 'text-xl' : 'text-lg'}`}>
                    {promesse.titre}
                  </h2>
                  <p className="mt-2 text-sm text-gris-300">{promesse.texte}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-5xl px-4">
          <h2 className="text-xl font-extrabold text-white md:text-2xl">Ce que tu obtiens, dans l’ordre.</h2>
          <div className="mt-10">
            <Scrollytelling />
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-5xl px-4">
          <h2 className="text-xl font-extrabold text-white md:text-2xl">Ce qu’il y a dedans.</h2>
          <p className="mt-2 text-sm text-gris-300">
            Des chiffres sur le produit, pas sur ses utilisateurs.
          </p>
          <div className="mt-6">
            <Counters
              items={[
                { value: phases, label: 'phases' },
                { value: etapes, label: 'étapes détaillées' },
                { value: prompts, label: 'prompts dans le pack' },
                { value: 30, label: 'scripts vidéo' },
              ]}
            />
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-5xl px-4">
          <h2 className="text-xl font-extrabold text-white md:text-2xl">Avec, ou sans.</h2>
          <div className="mt-6">
            <Comparison />
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-5xl px-4">
          <h2 className="text-xl font-extrabold text-white md:text-2xl">Les aventures</h2>
          {aventures.length === 0 ? (
            <EmptyState
              className="mt-6"
              title="Personne n’a encore partagé la sienne."
              description="On n’invente pas de témoignages pour remplir. Cette section restera vide jusqu’à ce que quelqu’un partage son parcours — ce sera peut-être toi."
              action={
                <Button asChild variant="secondaire">
                  <Link href="/diagnostic">Commencer la mienne</Link>
                </Button>
              }
            />
          ) : (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {aventures.map((aventure) => (
                <li key={aventure.slug} className="rounded-card border border-gris-700 bg-nuit-800 p-5">
                  {aventure.isDemo ? (
                    <span className="mb-2 inline-block rounded-full border border-gris-700 px-3 py-1 text-xs text-gris-300">
                      Exemple
                    </span>
                  ) : null}
                  <p className="text-sm text-gris-300">{aventure.story}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mx-auto mt-24 max-w-3xl px-4">
          <h2 className="text-xl font-extrabold text-white md:text-2xl">Les questions qu’on nous pose.</h2>
          <div className="mt-6">
            <Faq />
          </div>
        </section>

        <section className="relative mx-auto mt-24 max-w-3xl px-4 text-center">
          <div aria-hidden className="halo-neo pointer-events-none absolute left-1/2 top-0 -z-10 h-[min(420px,100vw)] w-[min(420px,100vw)] -translate-x-1/2" />
          <h2 className="font-display text-2xl font-extrabold leading-tight text-white">
            Dans dix minutes, tu auras une idée qui te ressemble.
          </h2>
          <p className="mt-3 text-sm text-gris-300">
            Le diagnostic est gratuit et ne demande aucune inscription.
          </p>
          <Button asChild taille="lg" className="mt-7 w-full md:w-auto">
            <Link href="/diagnostic">
              Trouver mon idée
              <span aria-hidden>→</span>
            </Link>
          </Button>
          {/* Un lien dans une phrase ne peut pas faire 48 px de haut sans casser
              le paragraphe : sur la landing, une action est un bouton. */}
          <Button asChild taille="lg" variant="secondaire" className="mt-3 w-full md:w-auto">
            <Link href="/inscription">Créer mon compte</Link>
          </Button>
          <ul className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-gris-300">
            <li className="rounded-full border border-gris-700 px-3 py-1.5">Sans inscription</li>
            <li className="rounded-full border border-gris-700 px-3 py-1.5">Sans carte bancaire</li>
            <li className="rounded-full border border-gris-700 px-3 py-1.5">
              Garantie {GUARANTEE_DAYS} jours
            </li>
          </ul>
        </section>

        <footer className="mx-auto mt-24 max-w-5xl border-t border-gris-700/60 px-4 py-10">
          <Logo />
          {/* Section 2.2 : 48 px de zone tactile, y compris dans le pied de page. */}
          <nav className="mt-4 flex flex-wrap gap-x-6 text-xs text-gris-300">
            {[
              { href: '/inscription', label: 'Créer un compte' },
              { href: '/garantie', label: 'La garantie' },
              { href: '/legal/mentions', label: 'Mentions légales' },
              { href: '/legal/cgv', label: 'Conditions de vente' },
              { href: '/legal/confidentialite', label: 'Confidentialité' },
              { href: '/connexion', label: 'Me connecter' },
            ].map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                className="tactile inline-flex items-center underline underline-offset-4"
              >
                {lien.label}
              </Link>
            ))}
          </nav>
          <p className="mt-6 text-xs text-gris-300">
            Nexteo ne promet aucun revenu. Ce que tu obtiendras dépend de ton idée, de ton marché et
            du travail que tu y mets.
          </p>
        </footer>
      </main>

      {/* Barre d'action collée en bas (section 2.2), toujours visible. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gris-700/60 bg-nuit-900/95 px-4 pt-3 backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Button asChild taille="bloc">
          <Link href="/diagnostic">
            Trouver mon idée
            <span aria-hidden>→</span>
          </Link>
        </Button>
      </div>
    </>
  );
}
