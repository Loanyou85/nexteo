/** « 12 s », « 1 m 20 s », « 1 h 04 m ». Une durée nulle ne s'affiche pas. */
export function duree(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} m ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
}

export function euros2(micros: number): string {
  return `${(micros / 1_000_000).toFixed(2).replace('.', ',')} €`;
}

export function dateCourte(d: Date | string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateHeure(d: Date | string): string {
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
