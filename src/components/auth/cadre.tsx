import Link from 'next/link';
import { Logo } from '@/components/marque/logo';
import { Panneau } from '@/components/ui/panneau';

export function CadreAuth({
  titre,
  sous,
  children,
  bas,
}: {
  titre: string;
  sous: string;
  children: React.ReactNode;
  bas: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* Halo : le dégradé de marque sert aux halos, jamais aux aplats. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-20%] h-[520px] w-[820px] -translate-x-1/2 opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #2B7BFF, #7A3BFF55, transparent)' }}
      />
      <div className="relative w-full max-w-md">
        <Link href="/" aria-label="Nexteo, accueil">
          <Logo />
        </Link>
        <Panneau className="mt-8" interieur="p-6 sm:p-8">
          <h1 className="display text-[30px]">{titre}</h1>
          <p className="mb-6 mt-2 text-sm text-text-2">{sous}</p>
          {children}
        </Panneau>
        <p className="mt-5 text-center text-sm text-text-2">{bas}</p>
      </div>
    </main>
  );
}
