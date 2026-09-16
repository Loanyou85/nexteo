import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardText, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { requireUser } from '@/server/auth';
import { parcoursDe, etapesApplicables } from '@/server/journey';
import { formatMinutes } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Aujourd’hui — Nexteo' };

/**
 * Section 2.1 : une seule action à l'écran. En haut, une phrase — ce qu'il
 * doit faire maintenant. Un seul bouton. Le reste est secondaire.
 */
export default async function AujourdhuiPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const { bienvenue } = await searchParams;
  const user = await requireUser();
  const parcours = await parcoursDe(user.id);

  // Pas encore d'idée choisie : on ne renvoie pas vers le diagnostic en
  // boucle, on l'accueille et on lui donne la seule action qui compte.
  if (!parcours) {
    return (
      <AppShell actif="/app">
        <h1 className="text-xl font-extrabold text-white">Bienvenue{user.name ? `, ${user.name}` : ''}.</h1>
        <p className="mt-3 text-sm text-gris-300">
          Ton compte est créé. Il te manque une idée à construire : le diagnostic prend une dizaine
          de minutes et ne demande rien de plus que ce que tu sais déjà.
        </p>
        <Button asChild taille="bloc" className="mt-8">
          <Link href="/diagnostic">Trouver mon idée</Link>
        </Button>
        <Button asChild taille="bloc" variant="secondaire" className="mt-3">
          <Link href="/app/compte">Voir mon compte</Link>
        </Button>
      </AppShell>
    );
  }

  const etapes = etapesApplicables(parcours);
  const parId = new Map(parcours.steps.map((s) => [s.stepId, s]));
  const courante =
    etapes.find((e) => e.id === parcours.currentStepId) ??
    etapes.find((e) => parId.get(e.id)?.status !== 'done') ??
    null;

  const faites = etapes.filter((e) => parId.get(e.id)?.status === 'done').length;

  return (
    <AppShell actif="/app">
      {bienvenue ? (
        <Card className="mb-6 border-neo-500/30">
          <CardTitle>Ton abonnement est actif.</CardTitle>
          <CardText className="mt-1">Tout le parcours est ouvert. On reprend où tu en étais.</CardText>
        </Card>
      ) : null}

      <div className="mb-6">
        <ProgressBar value={parcours.progressPercent} />
        <p className="mt-2 text-xs text-gris-300 tabular">
          {faites} étape{faites > 1 ? 's' : ''} sur {etapes.length} — {parcours.progressPercent} %
        </p>
      </div>

      {parcours.idea ? (
        <p className="mb-6 text-sm text-gris-300">
          Tu construis <span className="text-white">{parcours.idea.title}</span>.
        </p>
      ) : null}

      {courante ? (
        <section>
          <p className="text-xs uppercase tracking-wide text-gris-300">Maintenant</p>
          <h1 className="mt-2 text-xl font-extrabold text-white">{courante.title}</h1>
          <p className="mt-2 text-sm text-gris-300">{courante.goal}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>Phase {courante.phase.order} — {courante.phase.title}</Badge>
            <Badge>{formatMinutes(courante.estimatedMinutes)}</Badge>
          </div>

          <Button asChild taille="bloc" className="mt-6">
            <Link href={`/app/etape/${courante.id}`}>Ouvrir l’étape</Link>
          </Button>

          <p className="mt-6 text-sm text-gris-300">
            <span className="text-white">Pourquoi ça compte.</span> {courante.why}
          </p>
        </section>
      ) : (
        <section>
          <h1 className="text-xl font-extrabold text-white">Tu es arrivé au bout.</h1>
          <p className="mt-2 text-sm text-gris-300">
            Les treize phases sont validées. Ton produit existe, il est en ligne, et il peut
            encaisser. La suite ne s’écrit plus ici.
          </p>
          <Button asChild taille="bloc" variant="secondaire" className="mt-6">
            <Link href="/app/chemin">Revoir le chemin</Link>
          </Button>
        </section>
      )}

      <section className="mt-10 grid gap-3">
        <Link
          href="/app/prompts"
          className="tactile flex items-center justify-between rounded-card border border-gris-700 bg-nuit-800 px-4 py-3 text-sm text-white"
        >
          Mes prompts
          <span aria-hidden className="text-gris-300">→</span>
        </Link>
        <Link
          href="/app/ajouter"
          className="tactile flex items-center justify-between rounded-card border border-gris-700 bg-nuit-800 px-4 py-3 text-sm text-white"
        >
          Ajouter quelque chose à mon SaaS
          <span aria-hidden className="text-gris-300">→</span>
        </Link>
        <Link
          href="/app/videos"
          className="tactile flex items-center justify-between rounded-card border border-gris-700 bg-nuit-800 px-4 py-3 text-sm text-white"
        >
          Mes trente vidéos
          <span aria-hidden className="text-gris-300">→</span>
        </Link>
      </section>
    </AppShell>
  );
}
