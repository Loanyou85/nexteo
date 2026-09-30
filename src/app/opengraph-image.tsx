import { ImageResponse } from 'next/og';
import { MARQUE } from '@/config/brand';
import { TRACE_N } from '@/components/marque/logo';

export const alt = `${MARQUE.nom} — ${MARQUE.promesse}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Image d'aperçu du site. Le N est le même tracé que le logo et le favicon.
 * Polices système : aucune requête vers un tiers pour la fabriquer.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          background: 'radial-gradient(900px 500px at 78% 30%, #16224F 0%, #070B18 70%)',
          color: '#F4F6FF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="88" height="88" viewBox="0 0 48 48">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#2FE9FF" />
                <stop offset="0.5" stopColor="#2B7BFF" />
                <stop offset="1" stopColor="#7A3BFF" />
              </linearGradient>
            </defs>
            <g transform="translate(3 0) skewX(-9)">
              <path d={TRACE_N} fill="url(#g)" />
            </g>
          </svg>
          <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: 4 }}>{MARQUE.nom.toUpperCase()}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44, fontSize: 76, fontWeight: 900, lineHeight: 1.08, letterSpacing: -1, whiteSpace: 'nowrap' }}>
          <span>DÉCRIS TA MAP.</span>
          <span style={{ color: '#2FE9FF' }}>L’AGENT LA CONSTRUIT.</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 30, color: '#A9B2D6' }}>Pour UEFN — écrit le Verse, place les devices, compile et teste.</div>
      </div>
    ),
    size,
  );
}
