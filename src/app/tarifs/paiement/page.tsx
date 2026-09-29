import Link from 'next/link';
import { CoquePublique } from '@/components/coque/coque-publique';
import { Panneau } from '@/components/ui/panneau';
import { choisirOffre } from '@/server/actions/paiement';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Paiement' };

/**
 * Reprise du paiement après inscription (section 5.5) : l'offre et la période
 * choisies avant de créer le compte sont retrouvées, sans refaire le choix.
 */
export default async function PaiementPage({ searchParams }: { searchParams: Promise<{ plan?: string; periode?: string }> }) {
  const { plan, periode } = await searchParams;
  const p = periode === 'annuel' ? 'annuel' : 'mensuel';
  const r = plan ? await choisirOffre(plan, p) : { erreur: 'Aucune offre choisie.' };

  return (
    <CoquePublique cta={false}>
      <div className="mx-auto max-w-xl px-4 py-16">
        <Panneau interieur="p-6">
          <h1 className="display text-[28px]">Paiement</h1>
          <p className="mt-3 text-sm text-text-2">{r.erreur}</p>
          <Link href={`/tarifs${p === 'annuel' ? '?periode=annuel' : ''}`} className="mt-5 inline-block text-sm text-arc-cyan underline underline-offset-4">
            Revenir aux tarifs
          </Link>
        </Panneau>
      </div>
    </CoquePublique>
  );
}
