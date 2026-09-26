import { NextResponse, type NextRequest } from 'next/server';

/**
 * Attribue un identifiant de visiteur.
 *
 * Il n'y a pas d'offre gratuite, mais la liste reste ouverte et les quotas
 * des offres payantes doivent pouvoir se compter avant même la connexion.
 * Un composant serveur ne peut pas écrire de cookie — seuls un middleware,
 * une Server Action ou une route le peuvent. D'où ce passage.
 *
 * Cet identifiant ne sert qu'au décompte. Il ne permet de reconnaître
 * personne ailleurs, il n'est recoupé avec rien, et la politique de
 * confidentialité le dit.
 */
export const COOKIE_VISITEUR = 'nexteo_visiteur';

/** Treize mois : un mois de plus que la fenêtre de comptage, par sécurité. */
const DUREE_S = 60 * 60 * 24 * 400;

export function middleware(requete: NextRequest) {
  const reponse = NextResponse.next();

  if (!requete.cookies.get(COOKIE_VISITEUR)?.value) {
    reponse.cookies.set(COOKIE_VISITEUR, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: DUREE_S,
      path: '/',
    });
  }

  return reponse;
}

export const config = {
  // Inutile sur les fichiers statiques et les routes d'API : seules les pages
  // consomment du quota.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|api/).*)'],
};
