'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { db } from '@/server/db';
import { isAdminEmail, signIn, VERSION_CONSENTEMENT } from '@/server/auth';
import { hashPassword } from '@/lib/auth/password';
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import { MESSAGE_SECRET_MANQUANT, secretAuthManquant } from '@/server/configuration';

export type AuthState = { error?: string; champ?: 'firstName' | 'email' | 'password' };

function destination(formData: FormData): string {
  const suite = String(formData.get('suite') ?? '').trim();
  // Une redirection ne suit qu'un chemin interne : accepter une URL complète
  // ouvrirait une redirection ouverte vers n'importe quel site.
  // « /\\hote » est lu comme « //hote » par les navigateurs.
  return suite.startsWith('/') && !suite.startsWith('//') && !suite.startsWith('/\\') ? suite : '/dashboard';
}

export async function inscrire(_etat: AuthState, formData: FormData): Promise<AuthState> {
  if (secretAuthManquant()) return { error: MESSAGE_SECRET_MANQUANT };

  const analyse = registerSchema.safeParse({
    firstName: formData.get('firstName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!analyse.success) {
    const premier = analyse.error.issues[0];
    return {
      error: premier?.message ?? 'Ces informations ne sont pas valides.',
      champ: premier?.path[0] as AuthState['champ'],
    };
  }

  if (!formData.get('consent')) {
    return { error: 'Il faut accepter les conditions pour créer un compte.' };
  }

  const { firstName, email, password } = analyse.data;

  const dejaPris = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (dejaPris) {
    return { error: 'Un compte existe déjà avec cette adresse.', champ: 'email' };
  }

  await db.user.create({
    data: {
      email,
      name: firstName,
      passwordHash: await hashPassword(password),
      role: isAdminEmail(email) ? 'admin' : 'user',
      consentAcceptedAt: new Date(),
      consentVersion: VERSION_CONSENTEMENT,
    },
  });

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      // Le compte est créé ; seule la connexion automatique a échoué. On le
      // dit plutôt que de laisser croire que l'inscription n'a pas marché.
      return { error: 'Compte créé, mais la connexion a échoué. Connecte-toi.' };
    }
    throw e;
  }

  redirect(destination(formData));
}

export async function connecter(_etat: AuthState, formData: FormData): Promise<AuthState> {
  if (secretAuthManquant()) return { error: MESSAGE_SECRET_MANQUANT };

  const analyse = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!analyse.success) return { error: 'Adresse ou mot de passe incorrect.' };

  try {
    await signIn('credentials', { ...analyse.data, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      // Aucune distinction entre « adresse inconnue » et « mot de passe
      // faux » : la différence dirait à un inconnu quelles adresses ont un
      // compte chez nous.
      return { error: 'Adresse ou mot de passe incorrect.' };
    }
    throw e;
  }

  redirect(destination(formData));
}
