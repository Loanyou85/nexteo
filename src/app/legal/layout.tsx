import { TopBar } from '@/components/shell/top-bar';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="prose-nexteo mx-auto max-w-2xl px-4 pb-16 pt-8 text-sm leading-relaxed text-encre-2 [&_h1]:text-xl [&_h1]:text-encre [&_h2]:mt-8 [&_h2]:text-base [&_h2]:text-encre [&_p]:mt-3 [&_li]:mt-1.5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </main>
    </>
  );
}
