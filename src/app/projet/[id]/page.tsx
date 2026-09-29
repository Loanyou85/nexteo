import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Play } from 'lucide-react';
import { Coque, EnTete } from '@/components/coque/coque';
import { FormulaireMiseAJour } from '@/components/projet/mise-a-jour';
import { BoutonRestaurer } from '@/components/projet/restaurer';
import { Bouton } from '@/components/ui/bouton';
import { BadgePalier, BarrePalier } from '@/components/ui/palier';
import { Panneau } from '@/components/ui/panneau';
import { PointEtat } from '@/components/ui/etat';
import { dateHeure, duree } from '@/lib/format';
import { lireGameSpec } from '@/lib/gamespec/schema';
import { RAPPELS_CREATOR_PORTAL, type Controle } from '@/lib/orchestrateur/prepublication';
import { PALIERS, estPalier, type Palier } from '@/lib/palier';
import { cn } from '@/lib/utils';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Projet' };

const ONGLETS = [
  ['apercu', 'Aperçu'],
  ['gamespec', 'GameSpec'],
  ['verse', 'Fichiers Verse'],
  ['devices', 'Devices'],
  ['entites', 'Entités'],
  ['tests', 'Tests'],
  ['erreurs', 'Erreurs'],
  ['versions', 'Versions'],
  ['pre-publication', 'Pré-publication'],
] as const;
type Onglet = (typeof ONGLETS)[number][0];

const CATEGORIES: Record<string, string> = {
  compile_error: 'Compilation',
  verse_error: 'Verse',
  invalid_reference: 'Référence invalide',
  gameplay_error: 'Gameplay',
  runtime_error: 'Exécution',
  device_error: 'Device',
  missing_asset: 'Ressource manquante',
  performance_issue: 'Performance',
  memory_issue: 'Mémoire',
  mcp_timeout: 'Délai MCP',
  editor_hang: 'Éditeur figé',
};

const CORRECTIFS: Record<string, { texte: string; classe: string }> = {
  proposed: { texte: 'proposé', classe: 'text-warn' },
  applied: { texte: 'appliqué', classe: 'text-arc-cyan' },
  verified: { texte: 'vérifié', classe: 'text-ok' },
  failed: { texte: 'échoué', classe: 'text-fail' },
};

export default async function ProjetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  return (
    <Coque>
      <Contenu params={params} searchParams={searchParams} />
    </Coque>
  );
}

async function Contenu({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const [{ id }, { onglet: brut }] = await Promise.all([params, searchParams]);
  const onglet: Onglet = (ONGLETS.map((o) => o[0]) as string[]).includes(brut ?? '') ? (brut as Onglet) : 'apercu';
  const user = await requireUser();
  const projet = await db.project.findFirst({
    where: { id, userId: user.id },
    include: { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!projet) notFound();
  const palier: Palier = estPalier(projet.tier) ? projet.tier : 1;
  const derniere = projet.sessions[0];
  const active = derniere && ['queued', 'running', 'paused', 'stopping', 'awaiting_human'].includes(derniere.status) ? derniere : null;

  return (
    <>
      <EnTete
        avant={
          <Link href="/dashboard" className="text-sm text-text-3 hover:text-text-1">
            ← Projets
          </Link>
        }
        titre={projet.name}
        sous={PALIERS[palier].sens}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <BadgePalier palier={palier} numero />
            {active ? (
              <Bouton asChild variant="principal">
                <Link href={`/projet/${id}/build/${active.id}`}>
                  <Play size={15} aria-hidden /> Console en cours
                </Link>
              </Bouton>
            ) : (
              <Bouton asChild variant="principal">
                <Link href={`/creer/${id}`}>Plan et lancement</Link>
              </Bouton>
            )}
          </div>
        }
      />
      <div className="px-4 sm:px-6">
        <BarrePalier palier={palier} valeur={(palier / 5) * 100} />
        <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-void-700" aria-label="Onglets du projet">
          {ONGLETS.map(([cle, libelle]) => (
            <Link
              key={cle}
              href={`/projet/${id}?onglet=${cle}`}
              aria-current={onglet === cle ? 'page' : undefined}
              className={cn(
                'relative shrink-0 px-3 py-2.5 text-sm transition-colors',
                onglet === cle ? 'text-text-1' : 'text-text-3 hover:text-text-1',
              )}
            >
              {libelle}
              {onglet === cle ? <span aria-hidden className="degrade-arc absolute inset-x-2 bottom-0 h-0.5" /> : null}
            </Link>
          ))}
        </nav>
      </div>
      <div className="px-4 pb-12 pt-6 sm:px-6">
        <OngletContenu onglet={onglet} projet={projet} />
      </div>
    </>
  );
}

async function OngletContenu({ onglet, projet }: { onglet: Onglet; projet: { id: string; currentSpecVersion: number; tier: number } }) {
  const id = projet.id;

  if (onglet === 'apercu') {
    const [sessions, fichiers, devices, erreurs] = await Promise.all([
      db.agentSession.findMany({ where: { projectId: id }, orderBy: { createdAt: 'desc' }, take: 8, include: { plan: true } }),
      db.verseFile.count({ where: { projectId: id } }),
      db.deviceInstance.count({ where: { projectId: id } }),
      db.buildError.count({ where: { projectId: id } }),
    ]);
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Fichiers Verse', fichiers],
              ['Devices placés', devices],
              ['Erreurs rencontrées', erreurs],
            ].map(([l, n]) => (
              <Panneau key={l as string} interieur="p-4" biseau={10}>
                <p className="display tabular text-[34px] text-text-1">{n as number}</p>
                <p className="text-xs text-text-3">{l as string}</p>
              </Panneau>
            ))}
          </div>
          <Panneau interieur="p-5">
            <h2 className="display text-[22px]">Générations</h2>
            {sessions.length === 0 ? (
              <p className="mt-3 text-sm text-text-3">Aucune construction pour l’instant.</p>
            ) : (
              <ul className="mt-3 divide-y divide-void-700">
                {sessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <PointEtat etat={s.status === 'completed' ? 'ok' : s.status === 'failed' ? 'fail' : ['running', 'queued'].includes(s.status) ? 'actif' : 'warn'} />
                    <span className="text-text-1">{s.plan.kind === 'initial' ? 'Première construction' : 'Mise à jour'}</span>
                    <span className="text-text-3">{dateHeure(s.createdAt)}</span>
                    <span className="tabular text-text-3">{s.startedAt && s.finishedAt ? duree(s.finishedAt.getTime() - s.startedAt.getTime()) : ''}</span>
                    <span className="tabular text-text-3">{s.creditsDebited !== null ? `${s.creditsDebited} crédit(s)` : `${s.creditsReserved} réservés`}</span>
                    {s.provider === 'mock' ? <span className="text-2xs text-warn">simulé</span> : null}
                    <Link href={`/projet/${id}/build/${s.id}`} className="ml-auto text-arc-cyan underline underline-offset-4">
                      Console
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panneau>
        </div>
        <Panneau interieur="p-5" as="section">
          <h2 id="mise-a-jour" className="display scroll-mt-20 text-[22px]">
            Générer une mise à jour
          </h2>
          <p className="mb-4 mt-1 text-sm text-text-2">Décris la modification. L’agent inspecte le projet réel et ne refait que ce qui change.</p>
          <FormulaireMiseAJour projectId={id} />
        </Panneau>
      </div>
    );
  }

  if (onglet === 'gamespec') {
    const versions = await db.gameSpec.findMany({ where: { projectId: id }, orderBy: { version: 'desc' } });
    const courante = versions.find((v) => v.version === projet.currentSpecVersion);
    const lu = courante ? lireGameSpec(courante.data) : null;
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panneau interieur="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-void-700 px-4 py-3">
            <h2 className="text-sm font-medium">Version {projet.currentSpecVersion} — schéma {lu?.ok ? lu.spec.specVersion : '?'}</h2>
            <Link href={`/creer/${id}`} className="text-xs text-arc-cyan underline underline-offset-4">
              Modifier en formulaire
            </Link>
          </div>
          <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-code text-text-2">{JSON.stringify(courante?.data, null, 2)}</pre>
        </Panneau>
        <Panneau interieur="p-5">
          <h2 className="display text-[22px]">Historique</h2>
          <ul className="mt-3 space-y-3">
            {versions.map((v) => (
              <li key={v.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={v.version === projet.currentSpecVersion ? 'text-arc-cyan' : 'text-text-1'}>
                    Version {v.version} · {v.author === 'ia' ? 'IA' : v.author === 'restauration' ? 'restauration' : 'toi'}
                  </span>
                  {v.version !== projet.currentSpecVersion ? <BoutonRestaurer projectId={id} version={v.version} /> : <span className="text-2xs text-text-3">courante</span>}
                </div>
                <p className="text-xs text-text-3">{dateHeure(v.createdAt)}</p>
                {v.note ? <p className="mt-0.5 text-xs text-text-2">{v.note}</p> : null}
              </li>
            ))}
          </ul>
        </Panneau>
      </div>
    );
  }

  if (onglet === 'verse') {
    const fichiers = await db.verseFile.findMany({ where: { projectId: id }, orderBy: { path: 'asc' } });
    if (!fichiers.length) return <Vide texte="Aucun fichier Verse relu dans le projet pour l’instant." />;
    return (
      <div className="space-y-4">
        <p className="text-xs text-text-3">Contenu relu dans l’éditeur à la dernière inspection — pas une copie de ce que l’IA a produit.</p>
        {fichiers.map((f) => (
          <Panneau key={f.id} interieur="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-void-700 px-4 py-2.5">
              <h3 className="font-mono text-code text-text-1">{f.path}</h3>
              <span className="font-mono text-2xs text-text-3">{f.contentHash} · {dateHeure(f.observedAt)}</span>
            </div>
            <pre className="max-h-96 overflow-auto p-4 font-mono text-code leading-relaxed text-text-2">{f.content}</pre>
          </Panneau>
        ))}
      </div>
    );
  }

  if (onglet === 'devices') {
    const devices = await db.deviceInstance.findMany({ where: { projectId: id }, orderBy: { deviceType: 'asc' } });
    if (!devices.length) return <Vide texte="Aucun device relu dans le projet pour l’instant." />;
    return (
      <Panneau interieur="p-0 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-void-700 text-2xs uppercase tracking-wider text-text-3">
            <tr>
              <th className="px-4 py-3 font-medium">Identifiant stable</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Position (gauche · haut · avant)</th>
              <th className="px-4 py-3 font-medium">Propriétés</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-void-700">
            {devices.map((d) => {
              const p = d.positionLuf as { left: number; up: number; forward: number };
              return (
                <tr key={d.id} className="hover:bg-void-700/40">
                  <td className="px-4 py-2.5 font-mono text-code text-text-1">{d.stableId}</td>
                  <td className="px-4 py-2.5 font-mono text-code text-text-2">{d.deviceType}</td>
                  <td className="tabular px-4 py-2.5 font-mono text-code text-text-2">
                    {p.left} · {p.up} · {p.forward}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-text-3">{JSON.stringify(d.properties)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panneau>
    );
  }

  if (onglet === 'entites') {
    const entites = await db.sceneEntity.findMany({ where: { projectId: id }, orderBy: { stableId: 'asc' } });
    if (!entites.length) return <Vide texte="Aucune entité relue dans le projet pour l’instant." />;
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entites.map((e) => {
          const t = e.transformLuf as { position: { left: number; up: number; forward: number } };
          return (
            <Panneau key={e.id} interieur="p-4" biseau={10}>
              <p className="font-mono text-code text-text-1">{e.stableId}</p>
              <p className="mt-1 text-xs text-text-3">{e.uefnId}</p>
              <p className="tabular mt-3 font-mono text-2xs text-text-2">
                LUF {t.position.left} · {t.position.up} · {t.position.forward}
              </p>
              <p className="mt-1 text-2xs text-text-3">{(e.components as { type: string }[]).map((c) => c.type).join(', ')}</p>
            </Panneau>
          );
        })}
      </div>
    );
  }

  if (onglet === 'tests') {
    const run = await db.testRun.findFirst({
      where: { session: { projectId: id } },
      orderBy: { startedAt: 'desc' },
      include: { results: { include: { spec: true } } },
    });
    if (!run) return <Vide texte="Aucun playtest pour l’instant. Les tests sont générés depuis le plan de map et vérifiés sur les logs." />;
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-2">
          Dernier passage : {run.passed} réussi(s), {run.failed} échoué(s), sur {run.logCount} lignes de log — {dateHeure(run.startedAt)}.
        </p>
        {run.results.map((r) => (
          <Panneau key={r.id} interieur="p-4" biseau={10} couleurBord={r.passed ? undefined : r.spec.severity === 'blocking' ? 'var(--color-fail)' : 'var(--color-warn)'}>
            <div className="flex flex-wrap items-center gap-3">
              <PointEtat etat={r.passed ? 'ok' : r.spec.severity === 'blocking' ? 'fail' : 'warn'} />
              <span className="text-sm text-text-1">{r.spec.description}</span>
              <span className="text-2xs text-text-3">{r.spec.severity === 'blocking' ? 'bloquant' : 'avertissement'}</span>
            </div>
            <p className="mt-2 font-mono text-2xs text-text-2">
              {r.spec.assertion} — observé : {r.observed}
            </p>
            {r.evidence.length ? <pre className="mt-2 overflow-x-auto font-mono text-2xs text-text-3">{r.evidence.join('\n')}</pre> : null}
          </Panneau>
        ))}
      </div>
    );
  }

  if (onglet === 'erreurs') {
    const erreurs = await db.buildError.findMany({ where: { projectId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
    if (!erreurs.length) return <Vide texte="Aucune erreur rencontrée." />;
    return (
      <div className="space-y-3">
        <p className="text-xs text-text-3">Le message brut est toujours conservé et affiché : une erreur reformulée sans son texte d’origine est indébogable.</p>
        {erreurs.map((e) => (
          <Panneau key={e.id} interieur="p-4" biseau={10}>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-fail">{CATEGORIES[e.category] ?? e.category}</span>
              <span className="text-text-3">{dateHeure(e.createdAt)}</span>
              {e.fixStatus ? <span className={cn('ml-auto text-xs', CORRECTIFS[e.fixStatus]?.classe)}>correctif {CORRECTIFS[e.fixStatus]?.texte}</span> : null}
            </div>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-code text-text-1">{e.raw}</pre>
            {e.suggestedFix ? <p className="mt-2 text-xs text-text-2">{e.suggestedFix}</p> : null}
          </Panneau>
        ))}
      </div>
    );
  }

  if (onglet === 'versions') {
    const versions = await db.projectVersion.findMany({ where: { projectId: id }, orderBy: { number: 'desc' } });
    if (!versions.length) return <Vide texte="Chaque génération produit une version. Aucune pour l’instant." />;
    return (
      <ul className="space-y-3">
        {versions.map((v) => {
          const snap = v.snapshot as { fichiers?: unknown[]; devices?: unknown[]; entites?: unknown[] };
          const p: Palier = estPalier(v.tier) ? v.tier : 1;
          return (
            <Panneau key={v.id} as="li" interieur="flex flex-wrap items-center gap-4 p-4" biseau={10}>
              <span className="display text-[24px] text-text-1">V{v.number}</span>
              <BadgePalier palier={p} />
              <span className="text-sm text-text-2">{v.summary}</span>
              <span className="text-xs text-text-3">
                plan v{v.specVersion} · {snap.fichiers?.length ?? 0} fichiers · {snap.devices?.length ?? 0} devices · {snap.entites?.length ?? 0} entités
              </span>
              <span className="ml-auto text-xs text-text-3">{dateHeure(v.createdAt)}</span>
            </Panneau>
          );
        })}
      </ul>
    );
  }

  // Pré-publication
  const check = await db.prePublishCheck.findFirst({ where: { projectId: id }, orderBy: { createdAt: 'desc' } });
  if (!check) return <Vide texte="La vérification de pré-publication se lance à la fin d’une construction." />;
  const donnees = check.checks as { controles: Controle[]; metadonnees: { titre: string; description: string; motsCles: string[]; promptVignette: string; textePromo: string } };
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <Panneau interieur="p-5" couleurBord={check.ready ? 'var(--color-tier-5)' : 'var(--color-warn)'}>
          <p className={cn('display text-[34px]', check.ready ? 'text-tier-5' : 'text-warn')}>{check.ready ? 'Prêt' : 'Pas prêt'}</p>
          <p className="mt-1 text-sm text-text-2">Vérifié le {dateHeure(check.createdAt)}. Nexteo prépare, il ne publie jamais : la publication se fait dans le Creator Portal d’Epic.</p>
        </Panneau>
        <ul className="space-y-2">
          {donnees.controles.map((c) => (
            <li key={c.cle} className="flex items-start gap-3 text-sm">
              <PointEtat etat={c.ok ? 'ok' : 'fail'} className="mt-1.5" />
              <div className="flex-1">
                <p className="text-text-1">{c.libelle}</p>
                <p className="text-xs text-text-3">{c.detail}</p>
              </div>
              {!c.ok ? (
                <Link href={`/projet/${id}?onglet=${c.lien}`} className="text-xs text-arc-cyan underline underline-offset-4">
                  Voir
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <Panneau interieur="p-4" biseau={10}>
          <h3 className="text-sm font-medium text-text-1">À faire dans le Creator Portal</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-text-2">
            {RAPPELS_CREATOR_PORTAL.map((r) => (
              <li key={r} className="flex gap-2">
                <ExternalLink size={13} className="mt-1 shrink-0 text-text-3" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </Panneau>
      </div>
      <Panneau interieur="p-5 space-y-4">
        <h3 className="display text-[22px]">Métadonnées générées</h3>
        <Bloc titre="Titre" texte={donnees.metadonnees.titre} />
        <Bloc titre="Description" texte={donnees.metadonnees.description} />
        <Bloc titre="Mots-clés" texte={donnees.metadonnees.motsCles.join(', ')} />
        <Bloc titre="Texte promotionnel" texte={donnees.metadonnees.textePromo} />
        <Bloc titre="Prompt de vignette" texte={donnees.metadonnees.promptVignette} mono />
      </Panneau>
    </div>
  );
}

function Bloc({ titre, texte, mono }: { titre: string; texte: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-text-3">{titre}</p>
      <p className={cn('mt-1 text-sm text-text-1', mono && 'font-mono text-code text-text-2')}>{texte}</p>
    </div>
  );
}

function Vide({ texte }: { texte: string }) {
  return (
    <Panneau className="max-w-2xl" interieur="p-6">
      <p className="text-sm text-text-2">{texte}</p>
    </Panneau>
  );
}
