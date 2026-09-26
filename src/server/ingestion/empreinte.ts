import { createHash } from 'node:crypto';
import type { AnnonceNormalisee } from '@/server/source';

/**
 * Empreinte d'une création publicitaire.
 *
 * C'est l'unité du « rythme de test » du signal : rediffuser la même création
 * sur dix annonces n'est pas dix tests, c'est un seul.
 *
 * Elle repose d'abord sur le texte, pas sur le visuel. L'API ne rend que des
 * vignettes basse résolution dont les URL expirent, et parfois rien du tout ;
 * une empreinte qui exigerait l'image ne serait calculable qu'une fois sur
 * deux. Les sommes de contrôle des visuels s'y ajoutent quand elles existent,
 * ce qui rend l'empreinte plus fine sans jamais la rendre indisponible.
 *
 * La ponctuation et la casse sont écrasées : Meta renvoie régulièrement la
 * même accroche à une espace insécable près, et deux empreintes différentes
 * feraient croire à un test qui n'a pas eu lieu.
 */
function aplatir(texte: string | null): string {
  return (texte ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function empreinteCreation(
  annonce: Pick<AnnonceNormalisee, 'bodyText' | 'linkTitle' | 'linkDescription' | 'linkCaption'>,
  checksumsVisuels: string[] = [],
): string {
  const parties = [
    aplatir(annonce.bodyText),
    aplatir(annonce.linkTitle),
    aplatir(annonce.linkDescription),
    aplatir(annonce.linkCaption),
    [...checksumsVisuels].sort().join(','),
  ];
  return createHash('sha256').update(parties.join('\u0000')).digest('hex');
}
