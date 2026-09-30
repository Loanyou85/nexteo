import 'server-only';
import { Role } from '@prisma/client';
import { db } from '@/server/db';

/**
 * Qui est administrateur : `ADMIN_EMAILS`, relue à chaque appel (et non figée
 * au chargement du module) pour qu'un changement de variable soit pris en
 * compte sans dépendre de l'ordre de démarrage.
 */
export function adresseAdmin(email: string): boolean {
  const liste = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return liste.includes(email.trim().toLowerCase());
}

/**
 * Rôle réel d'un compte : celui de la base, promu si l'adresse est dans
 * ADMIN_EMAILS. Sans ça, un propriétaire inscrit AVANT d'avoir défini la
 * variable reste utilisateur ordinaire — et n'a accès ni à l'administration,
 * ni à la réparation dont il a besoin quand la base est vide.
 */
export async function roleAJour(compte: { id: string; role: Role; email: string }): Promise<Role> {
  if (compte.role === Role.admin) return Role.admin;
  if (!adresseAdmin(compte.email)) return compte.role;
  await db.user.update({ where: { id: compte.id }, data: { role: Role.admin } });
  return Role.admin;
}
