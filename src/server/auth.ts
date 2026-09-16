import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { Role } from '@prisma/client';
import { db } from '@/server/db';
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

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string): boolean {
  return adminEmails.includes(email.trim().toLowerCase());
}

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
    // inscription par mot de passe crée tout elle-même.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: {
            role: isAdminEmail(user.email) ? Role.admin : Role.user,
            consentAcceptedAt: new Date(),
            consentVersion: '2026-01',
          },
        }),
        db.subscription.create({ data: { userId: user.id } }),
        db.notificationPref.create({ data: { userId: user.id } }),
      ]);
    },
  },
});

/**
 * Session, ou null si la pile d'authentification est indisponible.
 *
 * Le diagnostic est public et ne demande aucun compte. Il n'a pourtant aucune
 * raison de tomber si l'authentification est mal configurée — secret absent,
 * hôte non reconnu derrière un proxy, fournisseur externe en panne. Ces
 * erreurs-là doivent coûter la session, pas le parcours.
 */
export async function sessionOuNull() {
  try {
    return await auth();
  } catch (error) {
    console.error('[auth] session indisponible, on continue en anonyme', error);
    return null;
  }
}

/** Session obligatoire : lève si l'utilisateur n'est pas connecté. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHENTICATED');
  return session.user;
}
