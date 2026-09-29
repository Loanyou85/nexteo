import { CoquePublique } from '@/components/coque/coque-publique';
import { MARQUE } from '@/config/brand';

export const metadata = { title: 'Mentions légales' };

export default function Mentions() {
  return (
    <CoquePublique>
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-14 text-sm leading-relaxed text-text-2 sm:px-6">
        <h1 className="display text-[40px] text-text-1">Mentions légales</h1>
        <p className="text-warn">À compléter par l’éditeur avant l’ouverture au public : les informations ci-dessous ne sont pas inventées à sa place.</p>
        <p>Éditeur : [raison sociale, forme, capital, adresse, numéro d’immatriculation, directeur de la publication].</p>
        <p>Hébergeur : [nom, adresse].</p>
        <p>Contact : {MARQUE.emailSupport}</p>
        <p>{MARQUE.mentionMarques}</p>
      </article>
    </CoquePublique>
  );
}
