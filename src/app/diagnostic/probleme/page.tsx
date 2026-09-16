import Link from 'next/link';
import { TopBar } from '@/components/shell/top-bar';
import { Button } from '@/components/ui/button';
import { CopierRapport } from '@/components/app/copier-rapport';
import { autotest } from '@/server/autotest';
import { expliquer } from '@/lib/panne/classer';
import { QUESTIONS, indexOfQuestion } from '@/lib/diagnostic/questions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ça a coincé — Nexteo' };

/**
 * Écran de panne du diagnostic.
 *
 * Next masque le message d'une erreur en production et ne laisse qu'un
 * identifiant illisible sans accès aux journaux de l'hébergeur. Cet écran
 * refait donc le test lui-même — lire la base, y écrire, lire un cookie — et
 * dit en français laquelle des trois opérations tombe.
 *
 * C'est le principe du bouton « Ça ne marche pas » du parcours, appliqué au
 * site lui-même : personne ne doit rester devant un mur sans explication.
 */
export default async function ProblemePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; question?: string }>;
}) {
  const { code = 'INCONNU', question } = await searchParams;
  const explication = expliquer(code);
  const rapport = await autotest();

  const index = question ? indexOfQuestion(question) : -1;
  const reprise = index >= 0 ? `/diagnostic?q=${index}` : '/diagnostic';
  const titreQuestion = index >= 0 ? QUESTIONS[index]?.title : null;

  const texte = [
    'Rapport Nexteo',
    `Code : ${code}`,
    question ? `Question : ${question}` : null,
    '',
    ...rapport.etapes.map(
      (e) =>
        `${e.ok ? 'OK  ' : 'ÉCHEC'} ${e.nom} (${e.millisecondes} ms)` +
        (e.ok ? '' : ` — ${e.code}${e.message ? ` : ${e.message}` : ''}`),
    ),
    '',
    rapport.contenu
      ? `Contenu : ${rapport.contenu.phases} phases, ${rapport.contenu.archetypes} archétypes, ${rapport.contenu.gabarits} gabarits`
      : 'Contenu : illisible',
    `Configuration : ${JSON.stringify(rapport.configuration)}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 pb-16 pt-8">
        <h1 className="text-xl font-extrabold text-white">Ça a coincé, et voici pourquoi.</h1>
        <p className="mt-3 text-sm text-gris-300">
          {titreQuestion ? `À la question « ${titreQuestion} ». ` : ''}
          Tes réponses précédentes sont gardées.
        </p>

        <section className="mt-6 rounded-card border border-gris-700 bg-nuit-800 p-4">
          <p className="font-mono text-xs text-neo-100">{code}</p>
          <p className="mt-2 text-sm font-bold text-white">{explication.quoi}</p>
          <p className="mt-1 text-sm text-gris-300">{explication.suite}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold text-white">Ce qui a été vérifié</h2>
          <ul className="mt-3 space-y-2">
            {rapport.etapes.map((etape) => (
              <li
                key={etape.nom}
                className="rounded-card border border-gris-700 bg-nuit-800 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white">{etape.nom}</span>
                  <span className={`text-xs ${etape.ok ? 'text-gris-300' : 'text-red-400'}`}>
                    {etape.ok ? `ok — ${etape.millisecondes} ms` : 'échec'}
                  </span>
                </div>
                {!etape.ok ? (
                  <p className="mt-2 break-words font-mono text-xs text-red-400">
                    {etape.code}
                    {etape.message ? ` — ${etape.message}` : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {rapport.contenu ? (
            <p className="mt-3 text-xs text-gris-300 tabular">
              Contenu en base : {rapport.contenu.phases} phases, {rapport.contenu.archetypes}{' '}
              archétypes, {rapport.contenu.gabarits} gabarits.
              {rapport.contenu.complet ? '' : ' Le contenu est incomplet.'}
            </p>
          ) : null}
        </section>

        <div className="mt-8 space-y-3">
          <Button asChild taille="bloc">
            <Link href={reprise}>Réessayer</Link>
          </Button>
          <CopierRapport rapport={texte} />
        </div>

        <p className="mt-4 text-center text-xs text-gris-300">
          Le rapport ne contient aucune clé ni adresse de connexion.
        </p>
      </main>
    </>
  );
}
