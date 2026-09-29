import Link from 'next/link';
import { AlertTriangle, Bug, FileCode2, Gamepad2, MonitorCog, Sparkles, Wrench } from 'lucide-react';
import { CoquePublique } from '@/components/coque/coque-publique';
import { RejeuConsole } from '@/components/accueil/rejeu';
import { Bouton } from '@/components/ui/bouton';
import { BadgePalier } from '@/components/ui/palier';
import { Panneau } from '@/components/ui/panneau';
import { PALIERS, type Palier } from '@/lib/palier';
import { euros, prixCreditCents } from '@/lib/tarifs/calculs';
import { MARQUE } from '@/config/brand';
import { db } from '@/server/db';
import { etatBase } from '@/server/etat';

export const dynamic = 'force-dynamic';

const ETAPES = [
  { Icone: Sparkles, titre: 'Tu décris ton jeu', texte: 'Une phrase suffit. L’agent en tire un plan de jeu structuré — joueurs, manches, ennemis, monnaie, interface — que tu corriges avant de lancer.' },
  { Icone: FileCode2, titre: 'L’agent construit', texte: 'Il écrit le Verse, place et configure les devices, crée les zones du Scene Graph. Dans ton UEFN, sur ton PC.' },
  { Icone: Bug, titre: 'Il teste et corrige', texte: 'Il compile, lance un playtest, lit les logs, corrige les erreurs, recompile et reteste — jusqu’à ce que les tests générés depuis ton plan passent.' },
  { Icone: Gamepad2, titre: 'Tu publies', texte: 'Le projet est ouvrable et vérifié. La publication reste dans le Creator Portal d’Epic : Nexteo prépare, il ne publie jamais à ta place.' },
];

const GENRES = [
  { nom: 'Survie zombie', actif: true },
  { nom: 'Gun Game', actif: false },
  { nom: 'Tycoon', actif: false },
  { nom: 'Course', actif: false },
  { nom: 'Horreur', actif: false },
  { nom: 'Arène JcJ', actif: false },
  { nom: 'Deathrun', actif: false },
];

export default async function Accueil() {
  const etat = await etatBase();
  const offres = etat.pret ? await db.plan.findMany({ where: { isActive: true, monthlyPriceCents: { gt: 0 } }, orderBy: { sortOrder: 'asc' } }) : [];

  return (
    <CoquePublique cta={false}>
      {/* Héros : la seule séquence orchestrée du produit, au chargement. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-30%] h-[700px] w-[1100px] -translate-x-1/2 opacity-35 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, #2B7BFF, #7A3BFF66, transparent)' }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-24">
          <div>
            <p className="anim-arrivee text-xs uppercase tracking-[0.2em] text-arc-cyan" style={{ animationDelay: '0ms' }}>
              {MARQUE.compatibilite}
            </p>
            <h1 className="display anim-arrivee mt-5 text-[56px] leading-[0.95] text-text-1 sm:text-[80px]" style={{ animationDelay: '80ms' }}>
              Décris ton jeu.
              <br />
              <span className="bg-gradient-to-r from-arc-cyan via-arc-blue to-arc-violet bg-clip-text text-transparent">L’agent le construit.</span>
            </h1>
            <p className="anim-arrivee mt-6 max-w-xl text-lg leading-relaxed text-text-2" style={{ animationDelay: '180ms' }}>
              {MARQUE.nom} écrit le Verse, place les devices, compile, lance le playtest, lit les erreurs et les corrige — dans ton UEFN, sur ton PC.
            </p>
            <div className="anim-arrivee mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '280ms' }}>
              <Bouton asChild variant="principal" taille="lg">
                <Link href="/inscription">Créer mon jeu</Link>
              </Bouton>
              <Bouton asChild variant="fantome" taille="lg">
                <Link href="#prerequis">Ce qu’il te faut</Link>
              </Bouton>
            </div>
            <div className="anim-arrivee mt-10 flex flex-wrap items-center gap-2" style={{ animationDelay: '380ms' }} aria-label="Les cinq paliers d’un projet">
              {([1, 2, 3, 4, 5] as Palier[]).map((p) => (
                <span key={p} className="chanfrein flex items-center gap-1.5 px-2.5 py-1 text-xs [--c:5px]" style={{ background: `color-mix(in srgb, ${PALIERS[p].couleur} 16%, transparent)`, color: PALIERS[p].couleur }}>
                  <span className="h-1.5 w-1.5" style={{ background: PALIERS[p].couleur }} />
                  {PALIERS[p].libelle}
                </span>
              ))}
            </div>
          </div>
          <div className="anim-arrivee" style={{ animationDelay: '220ms' }}>
            <RejeuConsole />
          </div>
        </div>
      </section>

      {/* Prérequis EN HAUT : un visiteur sur Mac doit l'apprendre en dix secondes. */}
      <section id="prerequis" className="scroll-mt-20 border-y border-void-700 bg-void-800/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="flex gap-3">
            <MonitorCog className="mt-0.5 shrink-0 text-arc-cyan" size={22} aria-hidden />
            <div>
              <h2 className="text-sm font-medium text-text-1">Un PC Windows avec UEFN</h2>
              <p className="mt-1 text-sm text-text-2">UEFN ne tourne que sous Windows. Depuis un Mac, tu peux préparer tes plans de jeu, pas construire.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Wrench className="mt-0.5 shrink-0 text-arc-cyan" size={22} aria-hidden />
            <div>
              <h2 className="text-sm font-medium text-text-1">Une installation locale</h2>
              <p className="mt-1 text-sm text-text-2">Un petit agent Windows relie Nexteo à ton éditeur, et deux réglages s’activent dans le projet UEFN.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-warn" size={22} aria-hidden />
            <div>
              <h2 className="text-sm font-medium text-text-1">Un outil d’Epic encore en bêta</h2>
              <p className="mt-1 text-sm text-text-2">Nexteo s’appuie sur le MCP officiel d’UEFN, en bêta. Des dysfonctionnements en découlent, et nous les signalons au lieu de les cacher.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="comment" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="display text-[40px] sm:text-[52px]">Comment ça marche</h2>
        <p className="mt-3 max-w-2xl text-text-2">Un chatbot répond des extraits de code. Cet agent agit, vérifie et corrige : jamais « générer puis supposer que ça marche ».</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES.map(({ Icone, titre, texte }, i) => (
            <Panneau key={titre} interieur="p-5">
              <div className="flex items-center justify-between">
                <Icone className="text-arc-cyan" size={22} aria-hidden />
                <span className="display text-[28px] text-void-500">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-medium text-text-1">{titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-2">{texte}</p>
            </Panneau>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="display text-[40px] sm:text-[52px]">Ce que l’agent sait construire aujourd’hui</h2>
            <p className="mt-4 text-text-2">
              Un seul genre, fiable, plutôt que sept approximatifs. Les autres arrivent un par un, quand le scénario de référence — une survie zombie à
              quatre joueurs — passe dix fois de suite contre un vrai éditeur.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <span key={g.nom} className={g.actif ? 'chanfrein bg-tier-2/15 px-3 py-1.5 text-sm text-tier-2 [--c:6px]' : 'chanfrein bg-void-700 px-3 py-1.5 text-sm text-text-3 [--c:6px]'}>
                  {g.nom}
                  {g.actif ? '' : ' · bientôt'}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="display text-[40px] sm:text-[52px]">Un projet, cinq paliers</h2>
            <p className="mt-4 text-text-2">L’avancement se lit comme une rareté. Chaque palier est calculé à partir de faits vérifiés, jamais avancé par optimisme.</p>
            <ul className="mt-6 space-y-2">
              {([1, 2, 3, 4, 5] as Palier[]).map((p) => (
                <li key={p} className="flex items-center gap-4">
                  <BadgePalier palier={p} className="w-40 justify-center" />
                  <span className="text-sm text-text-2">{PALIERS[p].sens}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {offres.length ? (
        <section className="border-t border-void-700 bg-void-800/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display text-[40px] sm:text-[52px]">Tarifs</h2>
              <Link href="/tarifs" className="text-sm text-arc-cyan underline underline-offset-4">
                Tout le détail, et l’annuel à 2 mois offerts
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {offres.map((o) => (
                <Panneau key={o.id} interieur="p-6" actif={o.isHighlighted} couleurBord={o.isHighlighted ? 'var(--color-tier-4)' : undefined}>
                  <p className="display text-[26px]">{o.name}</p>
                  <p className="tabular mt-3 text-text-1">
                    <span className="display text-[40px]">{euros(o.monthlyPriceCents)}</span> <span className="text-sm text-text-2">/ mois</span>
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="tabular text-arc-cyan">{o.monthlyCredits} crédits</span> <span className="text-text-2">· {o.equivalent}</span>
                  </p>
                  <p className="tabular mt-1 text-2xs text-text-3">{euros(prixCreditCents(o.monthlyPriceCents, o.monthlyCredits)!, 'toujours')} le crédit</p>
                </Panneau>
              ))}
            </div>
            <p className="mt-4 text-sm text-text-3">Le plan de jeu est gratuit, sans carte bancaire. Aucun build gratuit : chacun coûte des appels d’IA réels.</p>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="display text-[40px]">Questions</h2>
        <div className="mt-6 divide-y divide-void-700 border-y border-void-700">
          {[
            ['Est-ce que ça publie mon jeu ?', 'Non. Nexteo prépare : titre, description, mots-clés, prompt de vignette et liste de vérification. La publication, les tests privés et la monétisation restent dans le Creator Portal d’Epic.'],
            ['Est-ce affilié à Epic Games ?', 'Non. Nexteo utilise le MCP officiel qu’Epic intègre à UEFN, mais n’est ni affilié à Epic, ni approuvé par Epic.'],
            ['Mon jeu va-t-il rapporter de l’argent ?', 'Personne ne peut le promettre, et nous ne le promettons pas. Nexteo construit un jeu qui compile et se joue ; son succès dépend de ce que tu en fais.'],
            ['Où va mon code Verse ?', 'Il est envoyé au fournisseur d’IA pour être écrit et corrigé. La politique de confidentialité le dit, et tes données sont hébergées dans l’Union européenne.'],
          ].map(([q, r]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-text-1">
                {q}
                <span aria-hidden className="text-text-3 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-2">{r}</p>
            </details>
          ))}
        </div>
        <div className="mt-16 text-center">
          <p className="display text-[44px] sm:text-[60px]">Décris ton jeu. L’agent le construit.</p>
          <Bouton asChild variant="secondaire" taille="lg" className="mt-6">
            <Link href="/inscription">Commencer — le plan de jeu est gratuit</Link>
          </Bouton>
        </div>
      </section>
    </CoquePublique>
  );
}
