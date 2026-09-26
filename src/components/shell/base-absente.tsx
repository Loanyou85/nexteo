import type { EtatBase } from '@/server/etat';

/**
 * Écran affiché quand la base n'est pas prête.
 *
 * Il remplace ce qui était auparavant un déploiement rouge et un journal
 * illisible. Le site se construit, se met en ligne, et explique lui-même ce
 * qui lui manque — à quelqu'un qui peut agir, sans tableau de bord à ouvrir.
 */
export function BaseAbsente({ etat }: { etat: Extract<EtatBase, { pret: false }> }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-card border border-alerte/40 bg-alerte/5 p-6">
        <h1 className="text-lg">{etat.titre}</h1>
        <p className="mt-2 text-sm text-encre-2">{etat.explication}</p>

        <p className="mt-6 text-sm font-medium text-encre">À faire</p>
        <ol className="mt-2 space-y-1.5 text-sm text-encre-2">
          {etat.aFaire.map((e, i) => (
            <li key={e} className="flex gap-2">
              <span className="tabular shrink-0 text-encre-2">{i + 1}.</span>
              {e}
            </li>
          ))}
        </ol>

        <p className="mt-6 text-2xs text-encre-2">
          Le reste du site est en ligne et fonctionne. Seules les pages qui lisent des annonces
          affichent ce message.
        </p>
      </div>
    </div>
  );
}
