import { Coque, EnTete } from '@/components/coque/coque';
import { Panneau } from '@/components/ui/panneau';
import { PointEtat } from '@/components/ui/etat';
import { dateHeure } from '@/lib/format';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { modeUefn } from '@/server/mode';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connexion UEFN' };

/**
 * Écran de connexion (section 28) : c'est lui qui décide si un débutant reste
 * ou abandonne. Chaque ligne dit son état RÉEL — relu depuis l'agent local —
 * et exactement comment corriger. Sans agent, rien n'est « vert » : on ne
 * devine pas l'état d'un PC qu'on ne voit pas.
 */

type Diagnostic = Partial<{
  uefn: { installe: boolean; version?: string };
  fortnite: { installe: boolean };
  pythonScripting: boolean;
  mcpToolsets: boolean;
  projet: { nom: string; mcpJson: boolean } | null;
  mcp: { connecte: boolean };
}>;

const ETAPES_ONBOARDING = [
  'Utilises-tu déjà UEFN ? Si non, installe-le depuis le lanceur Epic Games (Windows uniquement).',
  'Installer UEFN et ouvrir une fois le projet que l’agent construira.',
  'Installer l’agent Nexteo pour Windows.',
  'Activer Python Editor Scripting dans les paramètres du projet.',
  'Activer UEFN MCP Toolsets dans les paramètres du projet (fonction en accès bêta).',
  'Sélectionner le projet dans l’agent : il écrit le fichier .mcp.json à la racine du projet.',
  'Lancer le test de connexion.',
  'Créer ton premier jeu.',
];

type Ligne = { nom: string; ok: boolean | null; etat: string; detail?: string; correction: string[] };

export default async function ConnexionUefnPage() {
  return (
    <Coque>
      <Contenu />
    </Coque>
  );
}

async function Contenu() {
  const user = await requireUser();
  const agent = await db.localAgent.findFirst({ where: { userId: user.id, revokedAt: null }, orderBy: { lastSeenAt: 'desc' } });
  const vivant = !!agent?.lastSeenAt && agent.lastSeenAt > new Date(Date.now() - 2 * 60_000);
  const d = (agent?.diagnostics ?? {}) as Diagnostic;
  const inconnu = !vivant;

  const lignes: Ligne[] = [
    {
      nom: 'UEFN',
      ok: inconnu ? null : !!d.uefn?.installe,
      etat: inconnu ? 'non détecté' : d.uefn?.installe ? 'installé' : 'absent',
      detail: d.uefn?.version,
      correction: ['Installe Unreal Editor for Fortnite depuis le lanceur Epic Games.', 'UEFN ne fonctionne que sous Windows : un Mac ne peut pas l’exécuter.'],
    },
    {
      nom: 'Fortnite',
      ok: inconnu ? null : !!d.fortnite?.installe,
      etat: inconnu ? 'non détecté' : d.fortnite?.installe ? 'installé' : 'absent',
      correction: ['Installe Fortnite depuis le lanceur Epic Games : les playtests se lancent dans le client du jeu.'],
    },
    {
      nom: 'Agent Nexteo',
      ok: vivant,
      etat: vivant ? 'connecté' : agent ? 'hors ligne' : 'non installé',
      detail: agent?.lastSeenAt ? `vu le ${dateHeure(agent.lastSeenAt)}` : undefined,
      correction: [
        'L’agent Nexteo pour Windows n’est pas encore disponible : il arrive après la validation complète du produit contre le simulateur.',
        'En attendant, les constructions tournent contre l’éditeur simulé, et c’est affiché partout.',
      ],
    },
    {
      nom: 'Python Editor Scripting',
      ok: inconnu ? null : !!d.pythonScripting,
      etat: inconnu ? 'non vérifiable' : d.pythonScripting ? 'activé' : 'désactivé',
      correction: [
        'Dans UEFN, ouvre les paramètres du projet (Project Settings).',
        'Recherche « Python Editor Scripting » et coche l’option.',
        'Redémarre l’éditeur si UEFN le demande.',
      ],
    },
    {
      nom: 'UEFN MCP Toolsets',
      ok: inconnu ? null : !!d.mcpToolsets,
      etat: inconnu ? 'non vérifiable' : d.mcpToolsets ? 'activé' : 'désactivé',
      correction: [
        'Dans les paramètres du projet, recherche « UEFN MCP Toolsets » et coche l’option.',
        'La fonction est en accès bêta : si elle n’apparaît pas, vérifie que ton UEFN est à jour (version 42.00 ou plus).',
      ],
    },
    {
      nom: 'Projet',
      ok: inconnu ? null : !!d.projet?.mcpJson,
      etat: inconnu ? 'non sélectionné' : d.projet ? (d.projet.mcpJson ? 'prêt' : '.mcp.json absent') : 'non sélectionné',
      detail: d.projet?.nom,
      correction: [
        'Dans l’agent, choisis le projet UEFN à construire.',
        'L’agent écrit le fichier .mcp.json à la racine du projet — tu n’as rien à copier à la main.',
      ],
    },
    {
      nom: 'MCP',
      ok: inconnu ? null : !!d.mcp?.connecte,
      etat: inconnu ? 'non connecté' : d.mcp?.connecte ? 'connecté' : 'non connecté',
      correction: [
        'Le client MCP doit être lancé DEPUIS le répertoire racine du projet : lancé d’ailleurs, rien ne se connecte, et l’erreur est peu explicite.',
        'L’agent s’en charge ; si la connexion échoue, relance le test depuis l’agent.',
      ],
    },
  ];

  return (
    <>
      <EnTete
        titre="Connexion UEFN"
        sous="Le MCP d’Epic tourne dans ton éditeur, sur ton PC. Quatre réglages le rendent joignable ; chacun est vérifié ici, et chacun dit comment le corriger."
      />
      <div className="grid gap-6 px-4 pb-12 sm:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {modeUefn() === 'mock' ? (
            <Panneau interieur="p-4" biseau={10} couleurBord="var(--color-warn)">
              <p className="text-sm text-warn">
                Aucun agent local n’est connecté. Les constructions tournent contre l’éditeur simulé, et chaque écran l’indique.
              </p>
            </Panneau>
          ) : null}

          <Panneau interieur="p-0 overflow-hidden">
            <ul className="divide-y divide-void-700">
              {lignes.map((l) => (
                <li key={l.nom}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3.5 hover:bg-void-700/40">
                      <span className="w-48 shrink-0 font-mono text-code text-text-1">{l.nom}</span>
                      <PointEtat etat={l.ok === true ? 'ok' : l.ok === false ? 'fail' : 'idle'} vide={l.ok !== true} />
                      <span className={l.ok === true ? 'text-sm text-ok' : l.ok === false ? 'text-sm text-fail' : 'text-sm text-text-3'}>{l.etat}</span>
                      {l.detail ? <span className="text-xs text-text-3">{l.detail}</span> : null}
                      {l.ok !== true ? <span className="ml-auto text-xs text-arc-cyan group-open:hidden">→ Comment faire</span> : null}
                    </summary>
                    <ol className="space-y-1.5 px-4 pb-4 pl-[13.5rem] text-sm text-text-2">
                      {l.correction.map((c, i) => (
                        <li key={c} className="flex gap-2">
                          <span className="tabular text-text-3">{i + 1}.</span>
                          {c}
                        </li>
                      ))}
                    </ol>
                  </details>
                </li>
              ))}
            </ul>
          </Panneau>
          <p className="text-xs text-text-3">
            Les captures d’écran de chaque réglage seront ajoutées à partir d’un vrai UEFN : nous n’en publierons pas de reconstituées.
          </p>
        </div>

        <Panneau interieur="p-5">
          <h2 className="display text-[22px]">Mise en route</h2>
          <ol className="mt-4 space-y-3">
            {ETAPES_ONBOARDING.map((e, i) => (
              <li key={e} className="flex gap-3 text-sm">
                <span className="chanfrein flex h-6 w-6 shrink-0 items-center justify-center bg-void-700 text-xs text-text-2 [--c:4px]">{i + 1}</span>
                <span className="text-text-2">{e}</span>
              </li>
            ))}
          </ol>
        </Panneau>
      </div>
    </>
  );
}
