import Link from 'next/link';
import { BarreLaterale } from '@/components/shell/barre-laterale';
import { NavMobile } from '@/components/shell/nav-mobile';
import { Logo } from '@/components/brand/logo';

/**
 * Coque de l'application.
 *
 * Barre latérale bleu nuit à gauche, contenu dans un panneau blanc arrondi
 * posé dessus. La marge autour du panneau laisse voir le fond sombre : c'est
 * ce liseré qui fait qu'on se sent dans un outil et pas sur une page.
 *
 * Sous 1024 px la barre latérale disparaît au profit d'un en-tête compact et
 * de la navigation basse — une colonne de 272 px ne laisserait rien au
 * contenu sur un téléphone.
 */
export function Coque({
  children,
  compteurs,
  compte,
  admin,
}: {
  children: React.ReactNode;
  compteurs?: { annonceurs?: number; annonces?: number };
  compte?: { email: string; plan: string; abonne: boolean } | null;
  admin?: boolean;
}) {
  return (
    <div className="flex min-h-dvh bg-nuit">
      <div className="hidden w-[272px] shrink-0 flex-col lg:flex">
        <BarreLaterale compteurs={compteurs} admin={admin} />
        {/* Rien à vendre à quelqu'un qui paie déjà : lui remontrer « Passer à
            Pro » à chaque écran lui dit qu'on ne sait pas qu'il est client. */}
        <div className="p-4">
          {compte?.abonne ? (
            <Link
              href="/tarifs"
              className="flex h-12 items-center justify-center rounded-capsule border border-nuit-3 text-sm font-medium text-nuit-encre transition-colors hover:bg-nuit-2"
            >
              Gérer l’abonnement
            </Link>
          ) : (
            <Link
              href="/tarifs"
              className="flex h-12 items-center justify-center rounded-capsule bg-neo-500 text-sm font-semibold text-white transition-colors hover:bg-neo-400"
            >
              Passer à Pro
            </Link>
          )}
        </div>

        {compte ? (
          <div className="border-t border-nuit-3/60 px-5 py-4">
            <p className="truncate text-xs text-nuit-encre">{compte.email}</p>
            <p className="text-2xs text-nuit-encre-2">{compte.plan}</p>
          </div>
        ) : (
          <div className="border-t border-nuit-3/60 px-5 py-4">
            <Link href="/connexion" className="text-xs text-nuit-encre-2 hover:text-nuit-encre">
              Se connecter
            </Link>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 lg:py-3 lg:pr-3">
        {/* En-tête compact, mobile uniquement. */}
        <header className="flex h-14 items-center justify-between bg-nuit px-4 lg:hidden">
          <Link href="/" aria-label="Nexteo, accueil">
            <Logo variant="nuit" />
          </Link>
          <Link
            href="/tarifs"
            className={
              compte?.abonne
                ? 'flex h-9 items-center rounded-capsule border border-nuit-3 px-4 text-xs font-medium text-nuit-encre'
                : 'flex h-9 items-center rounded-capsule bg-neo-500 px-4 text-xs font-semibold text-white'
            }
          >
            {compte?.abonne ? 'Gérer l’abonnement' : 'Passer à Pro'}
          </Link>
        </header>

        <main className="min-h-[calc(100dvh-3.5rem)] bg-surface pb-20 lg:min-h-full lg:rounded-card lg:pb-0">
          {children}
        </main>
      </div>

      <NavMobile />
    </div>
  );
}

/** En-tête de page : titre, compteur, et actions éventuelles. */
export function EnTetePage({
  titre,
  compteur,
  sous,
  etiquette,
  actions,
}: {
  titre: string;
  compteur?: string;
  sous?: string;
  etiquette?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-6 lg:px-8 lg:pt-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl">{titre}</h1>
          {etiquette ? (
            <span className="rounded-capsule bg-neo-100 px-2.5 py-0.5 text-2xs font-medium text-neo-600">
              {etiquette}
            </span>
          ) : null}
        </div>
        {compteur ? <p className="mt-1 text-sm text-encre-2">{compteur}</p> : null}
        {sous ? <p className="mt-1 max-w-2xl text-sm text-encre-2">{sous}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

/** État vide : encadré pointillé, pictogramme, raison, et une sortie. */
export function EtatVide({
  titre,
  explication,
  action,
}: {
  titre: string;
  explication: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-bordure px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-neo-100">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-neo-600" aria-hidden>
          <path
            d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="mt-4 text-base font-semibold text-encre">{titre}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-encre-2">{explication}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Jauge de quota, comme « Sauvegardes utilisées 0 / 10 ». */
export function Jauge({
  intitule,
  utilise,
  total,
}: {
  intitule: string;
  utilise: number;
  total: number;
}) {
  const part = total > 0 ? Math.min(100, (utilise / total) * 100) : 0;
  return (
    <div className="rounded-card border border-bordure bg-fond p-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-encre">{intitule}</p>
        <p className="tabular text-sm font-semibold text-encre">
          {utilise} / {total}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-capsule bg-bordure">
        <div className="h-full rounded-capsule bg-neo-500" style={{ width: `${part}%` }} />
      </div>
    </div>
  );
}
