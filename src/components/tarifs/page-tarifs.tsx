'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import { Check, Clock } from 'lucide-react';
import { Basculeur } from '@/components/tarifs/basculeur';
import { PrixDefilant } from '@/components/tarifs/prix';
import { Bouton } from '@/components/ui/bouton';
import { Panneau } from '@/components/ui/panneau';
import {
  economieAnnuellePct,
  euros,
  mensuelEquivalentCents,
  moisOfferts,
  prixCreditCents,
  prixCreditRechargeCents,
  prixRechargeCents,
} from '@/lib/tarifs/calculs';
import { cn } from '@/lib/utils';
import { choisirOffre, recharger, type EtatPaiement } from '@/server/actions/paiement';

export type OffreVue = {
  slug: string;
  name: string;
  tagline: string;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
  monthlyCredits: number;
  monthlyGamePlans: number | null;
  maxProjects: number | null;
  maxMembers: number;
  versionHistoryDays: number | null;
  queuePriority: number;
  equivalent: string;
  features: { label: string; available: boolean }[];
  isHighlighted: boolean;
};

export type DonneesTarifs = {
  offres: OffreVue[];
  decouverte: OffreVue | null;
  bareme: { operation: string; coutCents: number; credits: number }[];
  coutParCreditCents: number;
  majorationPct: number;
  recharge: { suggestions: number[]; min: number; max: number; offre: OffreVue } | null;
  utilisateur: { connecte: boolean; abonnement: { slug: string; intervalle: 'month' | 'year' } | null };
  periodeInitiale: 'mensuel' | 'annuel';
  rechargesDuMois: number;
};

const FAQ: [string, string][] = [
  ['Qu’est-ce qu’un crédit ?', 'L’unité de construction. Il est calibré sur le coût réel des appels d’IA : une map complète en consomme environ 10, une mise à jour typique 3. Générer un plan de map n’en consomme aucun.'],
  ['Que se passe-t-il si un build échoue ?', 'Si l’échec vient de la plateforme — éditeur injoignable, panne de l’agent local ou de l’orchestrateur — tes crédits sont restitués automatiquement. S’il vient de la complexité de la map demandée, ce qui a été réellement consommé est débité, et pas un crédit de plus.'],
  ['Mes crédits expirent-ils ?', 'Les crédits d’abonnement non utilisés sont reportés un mois, puis expirent. Les crédits de recharge n’expirent jamais. En annuel, les crédits sont versés mois par mois.'],
  ['Puis-je changer d’offre ?', 'Oui. Une montée est immédiate, facturée au prorata, et la différence de crédits est versée tout de suite. Une descente prend effet à la fin de la période en cours.'],
  ['Puis-je résilier quand je veux ?', 'Oui, en deux clics depuis le portail client. Pas de parcours de rétention, pas de faux compte à rebours. Tes crédits restent utilisables jusqu’à l’échéance, et tes recharges sont conservées.'],
  ['Et si je n’ai plus de crédits pendant un build ?', 'Le build réserve son plafond au lancement : il ne peut pas partir à découvert. S’il atteint ce plafond, il s’arrête proprement, garde son état, et te demande une confirmation explicite avant de consommer davantage.'],
  ['Faut-il un PC Windows ?', 'Oui. UEFN ne tourne que sous Windows, et l’agent Nexteo s’installe sur le PC où UEFN est ouvert. Depuis un Mac, tu peux préparer tes plans de map, pas lancer de construction.'],
];

function libelleBouton(o: OffreVue, u: DonneesTarifs['utilisateur'], annuel: boolean): { texte: string; actuel: boolean } {
  const intervalle = annuel ? 'year' : 'month';
  if (u.abonnement?.slug === o.slug && u.abonnement.intervalle === intervalle) return { texte: 'Ton plan actuel', actuel: true };
  if (u.abonnement?.slug === o.slug) return { texte: annuel ? 'Passer à l’annuel' : 'Passer au mensuel', actuel: false };
  if (u.abonnement) return { texte: `Passer à ${o.name}`, actuel: false };
  return { texte: `Choisir ${o.name}`, actuel: false };
}

function Carte({ o, annuel, u, pro }: { o: OffreVue; annuel: boolean; u: DonneesTarifs['utilisateur']; pro: boolean }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const periode = annuel ? 'annuel' : 'mensuel';
  const aAnnuel = o.annualPriceCents !== null;
  const bouton = libelleBouton(o, u, annuel);
  const prixCredit = prixCreditCents(o.monthlyPriceCents, o.monthlyCredits);
  const suite = `/tarifs/paiement?plan=${o.slug}&periode=${periode}`;

  const contenu = (
    <div className="relative flex h-full flex-col p-6">
      {pro ? (
        <span className="chanfrein display absolute right-5 top-5 bg-tier-4/20 px-2.5 py-1 text-[20px] text-tier-4 [--c:6px]">Le plus choisi</span>
      ) : null}
      <h3 className="display text-[30px] text-text-1">{o.name}</h3>
      <p className="mt-1 text-sm text-text-3">{o.tagline}</p>

      <div className="mt-6 min-h-[88px]">
        <p className="flex items-baseline gap-2">
          <PrixDefilant valeur={annuel && aAnnuel ? euros(o.annualPriceCents!) : euros(o.monthlyPriceCents)} className="display h-[52px] text-[48px] leading-[52px] text-text-1" />
          <span className="text-sm text-text-2">{annuel && aAnnuel ? '/ an' : '/ mois'}</span>
        </p>
        {annuel && aAnnuel ? (
          <p className="tabular anim-fondu mt-1 text-xs text-text-2">
            soit {euros(mensuelEquivalentCents(o.annualPriceCents!), 'toujours')} / mois ·{' '}
            <s className="text-text-3">{euros(o.monthlyPriceCents * 12)}</s>
          </p>
        ) : (
          <p className="mt-1 text-xs text-text-3">Sans engagement, résiliable en deux clics.</p>
        )}
      </div>

      <p className="mt-4 text-sm">
        <span className="tabular display text-[26px] text-arc-cyan">{o.monthlyCredits}</span>
        <span className="ml-2 text-text-2">crédits / mois</span>
      </p>
      <p className="mt-1 text-sm text-text-1">{o.equivalent}</p>
      {prixCredit ? <p className="tabular mt-1 text-2xs text-text-3">{euros(prixCredit, 'toujours')} le crédit</p> : null}

      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {o.features.map((f) => (
          <li key={f.label} className="flex gap-2.5">
            {f.available ? (
              <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ok" aria-hidden />
            ) : (
              <Clock size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-text-3" aria-hidden />
            )}
            <span className={f.available ? 'text-text-1' : 'text-text-3'}>
              {f.label}
              {f.available ? null : <span className="ml-1.5 text-2xs uppercase tracking-wide text-warn">bientôt</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {bouton.actuel ? (
          <Bouton taille="lg" className="w-full" disabled>
            {bouton.texte}
          </Bouton>
        ) : !u.connecte ? (
          <Bouton asChild taille="lg" variant={pro ? 'principal' : 'secondaire'} className="w-full">
            <Link href={`/inscription?suite=${encodeURIComponent(suite)}`}>{bouton.texte}</Link>
          </Bouton>
        ) : (
          <Bouton
            taille="lg"
            variant={pro ? 'principal' : 'secondaire'}
            className="w-full"
            disabled={enCours || (annuel && !aAnnuel)}
            onClick={() =>
              demarrer(async () => {
                setErreur(null);
                const r = await choisirOffre(o.slug, periode);
                if (r?.erreur) setErreur(r.erreur);
              })
            }
          >
            {enCours ? 'Redirection vers le paiement…' : bouton.texte}
          </Bouton>
        )}
        {erreur ? <p className="mt-2 text-xs text-fail">{erreur}</p> : null}
      </div>
    </div>
  );

  return pro ? (
    <Panneau actif couleurBord="var(--color-tier-4)" className="h-full">
      {contenu}
    </Panneau>
  ) : (
    <Panneau className="h-full">{contenu}</Panneau>
  );
}

function Recharge({ r, majorationPct, rechargesDuMois, offres }: { r: NonNullable<DonneesTarifs['recharge']>; majorationPct: number; rechargesDuMois: number; offres: OffreVue[] }) {
  const [quantite, setQuantite] = useState(r.suggestions[1] ?? r.suggestions[0] ?? 20);
  const [etat, action] = useActionState<EtatPaiement, FormData>(recharger, {});
  const valide = Number.isInteger(quantite) && quantite >= r.min && quantite <= r.max;
  const total = valide ? prixRechargeCents({ offreMensuelCents: r.offre.monthlyPriceCents, offreCredits: r.offre.monthlyCredits, quantite, majorationPct }) : null;
  const unitaire = prixCreditRechargeCents(r.offre.monthlyPriceCents, r.offre.monthlyCredits, majorationPct);
  const superieure = offres.find((o) => o.monthlyCredits > r.offre.monthlyCredits);

  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-text-2">
        Le crédit en recharge coûte celui de ton offre {r.offre.name} majoré de {majorationPct} %, soit{' '}
        <strong className="tabular text-text-1">{unitaire ? euros(unitaire, 'toujours') : '—'}</strong>. Sans expiration.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {r.suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQuantite(s)}
            aria-pressed={quantite === s}
            className={cn('chanfrein tabular h-10 px-4 text-sm [--c:6px]', quantite === s ? 'bg-arc-blue/25 text-text-1' : 'bg-void-700 text-text-2 hover:text-text-1')}
          >
            {s} crédits
          </button>
        ))}
        <label className="flex items-center gap-2 text-sm text-text-2">
          ou
          <input
            name="quantite"
            type="number"
            min={r.min}
            max={r.max}
            value={quantite}
            onChange={(e) => setQuantite(Number(e.target.value))}
            className="tabular h-10 w-24 border border-void-600 bg-void-900 px-3 text-text-1"
            aria-label="Nombre de crédits"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Bouton type="submit" disabled={!valide}>
          Recharger {valide ? `— ${euros(total!, 'toujours')}` : ''}
        </Bouton>
        {!valide ? <p className="text-xs text-warn">Entre {r.min} et {r.max} crédits.</p> : null}
      </div>
      {etat.erreur ? <p className="text-sm text-fail">{etat.erreur}</p> : null}
      {rechargesDuMois >= 2 && superieure ? (
        <p className="chanfrein bg-tier-5/12 p-3 text-sm text-text-1 [--c:8px]">
          Tu as rechargé {rechargesDuMois} fois ce mois-ci. En {superieure.name}, le crédit coûte{' '}
          {euros(prixCreditCents(superieure.monthlyPriceCents, superieure.monthlyCredits)!, 'toujours')} au lieu de{' '}
          {unitaire ? euros(unitaire, 'toujours') : '—'} en recharge : monter d’offre te coûterait moins cher.
        </p>
      ) : null}
    </form>
  );
}

export function PageTarifs(d: DonneesTarifs) {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const [annuel, setAnnuel] = useState(d.periodeInitiale === 'annuel');

  function basculer(v: boolean) {
    setAnnuel(v);
    // L'état vit dans l'URL : un lien partagé en description de vidéo
    // ouvre directement sur l'annuel.
    const p = new URLSearchParams(params.toString());
    if (v) p.set('periode', 'annuel');
    else p.delete('periode');
    router.replace(`${chemin}${p.size ? `?${p}` : ''}`, { scroll: false });
  }

  const reference = d.offres.find((o) => o.annualPriceCents) ?? d.offres[0];
  const mois = reference?.annualPriceCents ? moisOfferts(reference.monthlyPriceCents, reference.annualPriceCents) : 2;
  // Pro au centre sur grand écran, en premier sur téléphone.
  const pro = d.offres.find((o) => o.isHighlighted);
  const autres = d.offres.filter((o) => !o.isHighlighted);
  const ordreBureau = pro ? [autres[0], pro, ...autres.slice(1)].filter(Boolean) as OffreVue[] : d.offres;
  const abonneMensuel = d.utilisateur.abonnement?.intervalle === 'month' ? d.offres.find((o) => o.slug === d.utilisateur.abonnement?.slug) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <header className="pt-14 text-center">
        <h1 className="display text-[44px] leading-none sm:text-[64px]">Choisis ta puissance de construction.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-text-2">
          Chaque crédit fait avancer l’agent. Une map complète consomme environ{' '}
          {d.bareme.find((b) => b.operation.startsWith('Map complète typique'))?.credits ?? 10} crédits.
        </p>
        <div className="mt-8">
          <Basculeur annuel={annuel} onChange={basculer} moisOfferts={mois} />
        </div>
      </header>

      {abonneMensuel?.annualPriceCents && !annuel ? (
        <div className="chanfrein mx-auto mt-8 max-w-2xl bg-tier-5/12 p-4 text-center text-sm [--c:10px]">
          Passe ton offre {abonneMensuel.name} à l’annuel :{' '}
          <strong className="tabular">{euros(abonneMensuel.monthlyPriceCents * 12 - abonneMensuel.annualPriceCents)}</strong> d’économie par an (
          {economieAnnuellePct(abonneMensuel.monthlyPriceCents, abonneMensuel.annualPriceCents)} %).{' '}
          <button type="button" onClick={() => basculer(true)} className="text-tier-5 underline underline-offset-4">
            Voir l’annuel
          </button>
        </div>
      ) : null}

      {/* Mobile : Pro en premier. Bureau : Pro au centre. */}
      <div className="mt-10 grid gap-4 md:hidden">
        {[pro, ...autres].filter(Boolean).map((o) => (
          <Carte key={o!.slug} o={o!} annuel={annuel} u={d.utilisateur} pro={o!.isHighlighted} />
        ))}
      </div>
      <div className="mt-10 hidden items-stretch gap-4 md:grid md:grid-cols-3">
        {ordreBureau.map((o) => (
          <Carte key={o.slug} o={o} annuel={annuel} u={d.utilisateur} pro={o.isHighlighted} />
        ))}
      </div>

      {d.decouverte ? (
        <Panneau className="mt-4" interieur="flex flex-wrap items-center gap-4 px-6 py-4">
          <span className="display text-[22px]">{d.decouverte.name}</span>
          <span className="tabular text-text-1">{euros(0)}</span>
          <span className="text-sm text-text-2">{d.decouverte.features.map((f) => f.label).join(' · ')}. {d.decouverte.equivalent}.</span>
          <Bouton asChild taille="sm" variant="fantome" className="ml-auto">
            <Link href={d.utilisateur.connecte ? '/creer' : '/inscription'}>Commencer gratuitement</Link>
          </Bouton>
        </Panneau>
      ) : null}

      {/* Tableau comparatif */}
      <section className="mt-20">
        <h2 className="display text-[32px]">Comparer en détail</h2>
        <Panneau className="mt-6" interieur="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-void-700 text-2xs uppercase tracking-wider text-text-3">
              <tr>
                <th className="px-4 py-3 font-medium" />
                {[d.decouverte, ...d.offres].filter(Boolean).map((o) => (
                  <th key={o!.slug} className={cn('px-4 py-3 font-medium', o!.isHighlighted && 'text-tier-4')}>
                    {o!.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-void-700">
              {(
                [
                  ['Prix mensuel', (o: OffreVue) => euros(o.monthlyPriceCents)],
                  ['Prix annuel', (o: OffreVue) => (o.annualPriceCents ? euros(o.annualPriceCents) : '—')],
                  ['Crédits par mois', (o: OffreVue) => String(o.monthlyCredits)],
                  ['Prix du crédit', (o: OffreVue) => { const p = prixCreditCents(o.monthlyPriceCents, o.monthlyCredits); return p ? euros(p, 'toujours') : '—'; }],
                  ['Crédit en recharge', (o: OffreVue) => { const p = prixCreditRechargeCents(o.monthlyPriceCents, o.monthlyCredits, d.majorationPct); return p ? euros(p, 'toujours') : '—'; }],
                  ['Plans de map par mois', (o: OffreVue) => (o.monthlyGamePlans === null ? 'illimités' : String(o.monthlyGamePlans))],
                  ['Projets actifs', (o: OffreVue) => (o.maxProjects === null ? 'illimités' : String(o.maxProjects))],
                  ['Builds réels', (o: OffreVue) => (o.monthlyCredits > 0 ? 'oui' : 'non')],
                  ['Historique des versions', (o: OffreVue) => (o.versionHistoryDays === null ? 'illimité' : `${o.versionHistoryDays} jours`)],
                  ['Membres', (o: OffreVue) => (o.maxMembers > 1 ? `${o.maxMembers} (bientôt)` : '1')],
                  ['File de build', (o: OffreVue) => ['—', 'standard', 'prioritaire', 'prioritaire maximale'][o.queuePriority] ?? '—'],
                ] as [string, (o: OffreVue) => string][]
              ).map(([libelle, f]) => (
                <tr key={libelle}>
                  <th scope="row" className="px-4 py-3 font-normal text-text-2">{libelle}</th>
                  {[d.decouverte, ...d.offres].filter(Boolean).map((o) => (
                    <td key={o!.slug} className="px-4 py-3 text-text-1">{f(o!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panneau>
      </section>

      {/* Crédits */}
      <section className="mt-20 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 className="display text-[32px]">Comment se comptent les crédits</h2>
          <p className="mt-4 text-text-2">
            Un crédit correspond à environ {euros(d.coutParCreditCents, 'toujours')} d’appels d’IA. Avant chaque build, l’estimation est
            affichée ; au lancement, le plafond est réservé ; à la fin, seul le coût réel est débité, arrondi au crédit supérieur, et le reste
            est libéré. Aucune formule illimitée : chaque build a un coût réel, et le cacher finirait par le reporter sur tout le monde.
          </p>
        </div>
        <Panneau interieur="p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-void-700 text-2xs uppercase tracking-wider text-text-3">
              <tr>
                <th className="px-4 py-3 font-medium">Opération</th>
                <th className="px-4 py-3 text-right font-medium">Coût IA estimé</th>
                <th className="px-4 py-3 text-right font-medium">Crédits</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-void-700">
              {d.bareme.map((b) => (
                <tr key={b.operation}>
                  <td className="px-4 py-3 text-text-1">{b.operation}</td>
                  <td className="px-4 py-3 text-right text-text-2">{euros(b.coutCents, 'toujours')}</td>
                  <td className="px-4 py-3 text-right text-arc-cyan">{b.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panneau>
      </section>

      <section id="recharge" className="mt-20 scroll-mt-20">
        <h2 className="display text-[32px]">Recharger à la demande</h2>
        <Panneau className="mt-6" interieur="p-6">
          {d.recharge ? (
            <Recharge r={d.recharge} majorationPct={d.majorationPct} rechargesDuMois={d.rechargesDuMois} offres={d.offres} />
          ) : (
            <p className="text-sm text-text-2">
              Les recharges sont réservées aux abonnés d’une offre payante : le crédit y coûte celui de ton offre majoré de {d.majorationPct} %,
              et n’expire jamais. Elles dépannent, elles ne remplacent pas une offre.
            </p>
          )}
        </Panneau>
      </section>

      <section className="mt-20">
        <h2 className="display text-[32px]">Questions fréquentes</h2>
        <div className="mt-6 divide-y divide-void-700 border-y border-void-700">
          {FAQ.map(([q, r]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-text-1">
                {q}
                <span aria-hidden className="text-text-3 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-2">{r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-20 text-center">
        <h2 className="display text-[40px]">Décris ta map. L’agent la construit.</h2>
        <Bouton asChild variant="secondaire" taille="lg" className="mt-6">
          <Link href={d.utilisateur.connecte ? '/creer' : '/inscription'}>Créer ma map</Link>
        </Bouton>
      </section>
    </div>
  );
}
