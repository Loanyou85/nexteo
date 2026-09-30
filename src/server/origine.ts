import 'server-only';
import { headers } from 'next/headers';

/** Adresse publique du site telle que le visiteur la voit (derrière un proxy ou un domaine personnalisé). */
export async function origine(): Promise<string> {
  const h = await headers();
  const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (hote.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${hote}`;
}
