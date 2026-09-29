import { describe, expect, it } from 'vitest';
import { analyserSortieCompilateur, erreursSeulement } from '@/lib/verse/erreurs';
import { CORPUS } from '@/lib/verse/corpus';

describe('parseur d’erreurs Verse', () => {
  it('lit fichier, position, code, message et identifiant', () => {
    const [d] = analyserSortieCompilateur(CORPUS.identifiantInconnu).diagnostics;
    expect(d).toMatchObject({
      niveau: 'error',
      code: 3506,
      fichier: 'zombie_spawner.verse',
      ligne: 26,
      colonne: 9,
      ligneFin: 26,
      colonneFin: 19,
      categorie: 'invalid_reference',
      identifiant: 'SpawnZombi',
    });
  });

  it('garde toujours la ligne brute', () => {
    const [d] = analyserSortieCompilateur(CORPUS.identifiantInconnu).diagnostics;
    expect(d!.brut).toBe(CORPUS.identifiantInconnu);
  });

  it('comprend les chemins Windows à antislash et garde le sous-dossier', () => {
    const [d] = analyserSortieCompilateur(CORPUS.cheminAntislash).diagnostics;
    expect(d!.fichier).toBe('modules/hud_manager.verse');
    expect(d!.identifiant).toBe('Print');
  });

  it('classe une incompatibilité de type à part', () => {
    const [d] = analyserSortieCompilateur(CORPUS.typeIncompatible).diagnostics;
    expect(d!.categorie).toBe('verse_error');
    expect(d!.fichier).toBe('currency_system.verse');
  });

  it('accepte une position sans fin', () => {
    const [d] = analyserSortieCompilateur(CORPUS.sansFin).diagnostics;
    expect(d).toMatchObject({ ligne: 4, colonne: 1, ligneFin: null, categorie: 'compile_error' });
  });

  it('accepte une erreur sans fichier, sans inventer de fichier', () => {
    const [d] = analyserSortieCompilateur(CORPUS.sansPosition).diagnostics;
    expect(d).toMatchObject({ code: 3001, fichier: null, ligne: null });
  });

  it('sépare avertissements et erreurs', () => {
    const r = analyserSortieCompilateur(CORPUS.avertissement);
    expect(r.diagnostics[0]!.niveau).toBe('warning');
    expect(erreursSeulement(r)).toHaveLength(0);
  });

  it('ignore le résumé du compilateur au lieu de le compter comme une erreur', () => {
    const r = analyserSortieCompilateur(CORPUS.bruitEtResume);
    expect(r.diagnostics).toHaveLength(2);
    expect(r.nonReconnues).toEqual([]);
  });

  it('rend visible ce qu’il ne sait pas lire au lieu de le jeter', () => {
    const r = analyserSortieCompilateur(CORPUS.nonReconnue);
    expect(r.diagnostics).toHaveLength(0);
    expect(r.nonReconnues).toEqual([CORPUS.nonReconnue]);
  });
});
