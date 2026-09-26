import { OFFRES, economieAnnuelle, FICHES_GRATUITES_PAR_MOIS } from '@/lib/plans';
import { SOCIETE } from '@/lib/societe';

export const metadata = { title: 'Conditions générales de vente — Nexteo' };

export default function CgvPage() {
  return (
    <>
      <h1>Conditions générales de vente</h1>
      <p>
        En vigueur au [date de mise en ligne]. Éditeur : {SOCIETE.nom}, {SOCIETE.siret}.
      </p>

      <h2>Ce qui est vendu</h2>
      <p>
        Un accès par abonnement à un service en ligne de veille publicitaire : consultation des
        annonceurs et de leurs annonces issues de la bibliothèque publicitaire de Meta, signal
        Nexteo et son détail, chronologie de diffusion, archive conservée par Nexteo, accroches,
        pages de destination, annonceurs proches, collections et suivi, selon l’offre souscrite.
      </p>
      <p>
        Le service donne accès à de l’information observée. Il ne fournit ni conseil en
        investissement, ni garantie de résultat commercial, et ne prétend pas qu’une activité
        observée sera reproductible.
      </p>

      <h2>Les offres et leurs prix</h2>
      <ul>
        {OFFRES.map((offre) => (
          <li key={offre.plan}>
            <strong>{offre.nom}</strong> — {offre.mensuel} € par mois, ou {offre.annuel} € par an
            (soit {economieAnnuelle(offre)} % d’économie), toutes taxes comprises. {offre.promesse}
          </li>
        ))}
      </ul>
      <p>
        Un accès gratuit, sans compte, permet la recherche, la consultation de la liste des
        annonceurs, la lecture du signal et {FICHES_GRATUITES_PAR_MOIS} fiches complètes par mois. Il
        ne donne lieu à aucun paiement.
      </p>

      <h2>Souscription et paiement</h2>
      <p>
        Le paiement est traité par Stripe. L’accès payant est ouvert à la réception de la
        confirmation de paiement par Stripe, et uniquement à ce moment : aucune intention d’achat
        n’ouvre de droits par elle-même. L’abonnement se renouvelle automatiquement à échéance.
      </p>

      <h2>Résiliation</h2>
      <p>
        La résiliation s’effectue en deux clics depuis le portail client Stripe, accessible depuis
        ton compte. Elle prend effet à la fin de la période en cours ; l’accès reste ouvert jusque-là.
        Aucun compte à rebours, aucune rareté artificielle et aucune manœuvre destinée à retarder la
        résiliation ne sont employés.
      </p>

      <h2>Droit de rétractation</h2>
      <p>
        Pour un contenu numérique fourni immédiatement, le droit de rétractation de quatorze jours
        s’éteint dès que l’exécution commence avec ton accord exprès, conformément à l’article
        L221-28 du code de la consommation. Cet accord est recueilli au moment du paiement.
      </p>

      <h2>Disponibilité et limites</h2>
      <p>
        Nexteo dépend de l’API officielle de Meta, dont les règles, les champs et la disponibilité
        peuvent évoluer sans préavis. Une interruption ou une modification de cette API peut réduire
        temporairement la fraîcheur des données. Les données déjà archivées restent consultables.
      </p>
      <p>
        Hors publicités politiques, l’API ne couvre que les annonces diffusées auprès d’utilisateurs
        de l’Union européenne. Aucune couverture mondiale n’est promise ni fournie.
      </p>

      <h2>Réclamations</h2>
      <p>
        <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>. En cas de litige non résolu, tu peux
        recourir gratuitement à un médiateur de la consommation.
      </p>
    </>
  );
}
