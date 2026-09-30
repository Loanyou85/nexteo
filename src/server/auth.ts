import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import { redirect, unstable_rethrow } from 'next/navigation';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { Role } from '@prisma/client';
import { db } from '@/server/db';
import { adresseAdmin, roleAJour } from '@/server/roles';
import { verifyPassword } from '@/lib/auth/password';
import { loginSchema } from '@/lib/validation/auth';
// L'import explicite force la résolution du module avant son augmentation.
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: Role } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

type SessionToken = JWT;

/**
 * Version de la politique de confidentialité acceptée à l'inscription. Elle
 * dit explicitement que le code Verse du projet est envoyé au fournisseur
 * d'IA (section 29) : un changement de ce point exige une nouvelle version.
 */
export const VERSION_CONSENTEMENT = '2026-09-uefn';

export const isAdminEmail = adresseAdmin;

const providers: NextAuthConfig['providers'] = [
  Credentials({
    credentials: {
      email: { label: 'E-mail', type: 'email' },
      password: { label: 'Mot de passe', type: 'password' },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      // Un compte créé via Google n'a pas de mot de passe : on refuse sans
      // révéler laquelle des deux informations est en cause.
      if (!user?.passwordHash) return null;

      const valid = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // Sessions signées plutôt que stockées : un identifiant vérifié par mot de
  // passe ne passe pas par l'adaptateur de base, c'est la seule stratégie
  // compatible avec un fournisseur à identifiants.
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/connexion', error: '/connexion' },
  providers,
  callbacks: {
    async jwt({ token, user, trigger }): Promise<SessionToken> {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? Role.user;
      }
      // Le rôle peut changer après coup (promotion en administrateur) : on le
      // relit à chaque rafraîchissement de session plutôt que de le figer.
      if (trigger === 'update' || (token.id && !token.role)) {
        const fresh = await db.user.findUnique({ where: { id: token.id }, select: { role: true } });
        if (fresh) token.role = fresh.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id;
      session.user.role = token.role ?? Role.user;
      return session;
    },
  },
  events: {
    // Ne concerne que les comptes créés par un fournisseur externe : une
    // inscription par mot de passe crée tout elle-même. Aucun abonnement
    // n'est créé : un compte sans abonnement est en Découverte.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      await db.user.update({
        where: { id: user.id },
        data: {
          role: isAdminEmail(user.email) ? Role.admin : Role.user,
          consentAcceptedAt: new Date(),
          consentVersion: VERSION_CONSENTEMENT,
        },
      });
    },
  },
});

/**
 * Session vérifiée, ou null.
 *
 * Deux raisons de renvoyer null plutôt que de laisser passer.
 *
 * La première : l'accueil et les tarifs sont publics. Ils n'ont aucune raison
 * de tomber si l'authentification est mal configurée — secret absent, hôte non
 * reconnu derrière un proxy. Ces erreurs coûtent la session, pas la page.
 *
 * La seconde, et c'est celle qui a mordu : **une session est un jeton signé,
 * pas une preuve que le compte existe encore.** Les sessions sont sans état,
 * donc le jeton survit dans le navigateur à la suppression du compte — et à
 * une base remise à zéro par une migration. Il se décode parfaitement et
 * désigne un compte disparu. Toute écriture qui s'y fie échoue alors sur une
 * clé étrangère, loin de la cause, avec un message que personne ne relie au
 * problème. On vérifie donc que la ligne existe avant de la croire.
 */
export async function sessionOuNull() {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const existe = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, email: true },
    });
    if (!existe) {
      console.warn('[auth] jeton valide pour un compte disparu, session ignorée');
      return null;
    }

    // Le rôle du jeton date de la connexion. On le relit en base, et on
    // promeut une adresse de ADMIN_EMAILS inscrite AVANT que la variable
    // existe : sinon le propriétaire se retrouve sans accès à l'administration,
    // ni à la réparation dont il a besoin quand la base est vide.
    session.user.role = await roleAJour(existe);

    return session;
  } catch (error) {
    // Les signaux internes de Next (rendu dynamique, redirection) ne sont pas des pannes.
    unstable_rethrow(error);
    console.error('[auth] session indisponible, on continue en anonyme', error);
    return null;
  }
}

/** Session obligatoire. Renvoie vers la connexion si le compte n'existe plus. */
export async function requireUser() {
  const session = await sessionOuNull();
  if (!session?.user?.id) redirect('/connexion');
  return session.user;
}

/**
 * Administrateur obligatoire.
 *
 * Renvoie vers l'accueil et non vers une page d'erreur : un visiteur qui
 * tombe sur une adresse d'administration n'a pas besoin d'apprendre qu'elle
 * existe. Utilisée aussi par les actions serveur — un écran caché n'est pas
 * une protection, seule la vérification côté serveur en est une.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}
