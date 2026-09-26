import { db } from '../src/server/db';
import { executerIngestion, lotsEnSouffrance } from '../src/server/ingestion/pipeline';

/**
 * Point d'entrée du pipeline, appelé par le planificateur quotidien.
 *
 * Il tourne tous les jours dès le premier jour, même quand le site n'a aucun
 * utilisateur : un historique de six mois vaut infiniment plus qu'une belle
 * interface vide.
 */
async function main(): Promise<void> {
  const resume = await executerIngestion();

  console.log(
    [
      `Ingestion terminée en ${Math.round((resume.termineA.getTime() - resume.demarreA.getTime()) / 1000)} s`,
      `  lots              ${resume.lots}`,
      `  annonces vues     ${resume.annoncesVues}`,
      `  dont nouvelles    ${resume.annoncesNouvelles}`,
      `  ignorées          ${resume.annoncesIgnorees}`,
      `  annonceurs créés  ${resume.annonceursCrees}`,
      `  signaux recalculés ${resume.annonceursRecalcules}`,
      `  visuels copiés    ${resume.visuelsCopies}`,
      `  marquées retirées ${resume.marqueesDisparues}`,
      `  échecs            ${resume.echecs.length}`,
    ].join('\n'),
  );

  for (const e of resume.echecs) console.error(`  ↳ ${e.pays}/${e.terme} : ${e.erreur}`);

  const souffrance = await lotsEnSouffrance(db);
  if (souffrance.length > 0) {
    console.error(
      '\nALERTE : ces lots ont échoué deux fois de suite. Deux jours d’ingestion\n' +
        'perdus sont deux jours perdus à jamais.',
    );
    for (const s of souffrance) console.error(`  ↳ ${s.pays}/${s.terme ?? '(tous termes)'}`);
  }

  await db.$disconnect();
  process.exit(resume.echecs.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('Ingestion interrompue :', e);
  await db.$disconnect();
  process.exit(1);
});
