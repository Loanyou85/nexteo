import { sessionOuNull } from '@/server/auth';
import { exporterDonnees } from '@/server/actions/account';

/** Export des données personnelles, au format JSON (garde-fou n° 5). */
export async function GET() {
  const session = await sessionOuNull();
  if (!session?.user?.id) return new Response('Non connecté', { status: 401 });

  const donnees = await exporterDonnees(session.user.id);
  return new Response(JSON.stringify(donnees, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="nexteo-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
