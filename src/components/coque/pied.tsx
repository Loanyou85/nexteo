import Link from 'next/link';
import { MARQUE } from '@/config/brand';

export function Pied() {
  return (
    <footer className="border-t border-void-700 px-4 py-8 text-xs text-text-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <p className="max-w-2xl leading-relaxed">{MARQUE.mentionMarques}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Liens légaux">
          <Link href="/legal/confidentialite" className="hover:text-text-1">
            Confidentialité
          </Link>
          <Link href="/legal/mentions" className="hover:text-text-1">
            Mentions légales
          </Link>
          <a href={`mailto:${MARQUE.emailSupport}`} className="hover:text-text-1">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
