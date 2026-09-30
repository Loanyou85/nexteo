'use client';

/**
 * Dernier filet : une erreur dans le layout racine lui-même. Ce composant
 * remplace toute la page, donc il porte son propre <html> et ses styles en
 * ligne — les feuilles de style du site ne sont peut-être pas chargées.
 */
export default function ErreurGlobale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#070B18', color: '#F4F6FF', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 16 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>Nexteo est momentanément indisponible.</h1>
        <p style={{ maxWidth: 420, color: '#A9B2D6', margin: 0 }}>Une erreur est survenue. Réessaie dans un instant.</p>
        {error.digest ? <p style={{ fontSize: 12, color: '#6B7599', margin: 0 }}>Référence : {error.digest}</p> : null}
        <button type="button" onClick={reset} style={{ padding: '10px 20px', border: 0, background: '#2B7BFF', color: '#fff', fontSize: 16, cursor: 'pointer' }}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
