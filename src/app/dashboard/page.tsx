import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Coque, EnTete } from '@/components/coque/coque';
import { CarteProjet } from '@/components/projet/carte-projet';
import { Bouton } from '@/components/ui/bouton';
import { Panneau } from '@/components/ui/panneau';
import { requireUser } from '@/server/auth';
import { solde } from '@/server/credits';
import { db } from '@/server/db';
import { offreDe } from '@/server/offre';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Projets' };

export default async function DashboardPage() {
  return (
    <Coque>
      <Contenu />
    </Coque>
  );
}

async function Contenu() {
  const user = await requireUser();
  const [projets, offre, s] = await Promise.all([
    db.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    offreDe(user.id),
    solde(user.id),
  ]);

  return (
    <>
      <EnTete
        titre="Tes projets"
        sous={
          <span>
            Offre {offre.plan.name} · <span className="tabular text-arc-cyan">{s.total} crédit{s.total > 1 ? 's' : ''}</span> disponible
            {s.total > 1 ? 's' : ''} ·{' '}
            <Link href="/tarifs" className="underline underline-offset-4 hover:text-text-1">
              offres et recharges
            </Link>
          </span>
        }
        actions={
          <Bouton asChild variant="principal">
            <Link href="/creer">
              <Plus size={16} aria-hidden /> Créer mon jeu
            </Link>
          </Bouton>
        }
      />
      <div className="px-4 pb-12 sm:px-6">
        {projets.length === 0 ? (
          <Panneau className="max-w-2xl" interieur="p-8">
            <h2 className="display text-[26px]">Aucun projet pour l’instant</h2>
            <p className="mt-2 text-sm text-text-2">
              Décris un jeu en une phrase : l’agent en tire un plan que tu pourras corriger avant de lancer quoi que ce soit.
            </p>
            <Bouton asChild variant="secondaire" className="mt-6">
              <Link href="/creer">Décrire mon premier jeu</Link>
            </Bouton>
          </Panneau>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projets.map((p) => {
              const derniere = p.sessions[0];
              const enCours = derniere && ['queued', 'running', 'paused', 'stopping', 'awaiting_human'].includes(derniere.status) ? derniere.id : null;
              return (
                <CarteProjet
                  key={p.id}
                  p={{ id: p.id, name: p.name, genre: p.genre, tier: p.tier, derniereGeneration: derniere?.finishedAt ?? null, enCours }}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
