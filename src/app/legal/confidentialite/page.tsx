import { CONSERVATION, SOCIETE } from '@/lib/societe';

export const metadata = { title: 'Politique de confidentialité — Nexteo' };

export default function ConfidentialitePage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>
        Nexteo traite des données d’entreprises, pas de personnes. Les seules données personnelles
        collectées sont celles de ton propre compte. Voici exactement lesquelles, et ce qu’on en
        fait.
      </p>

      <h2>Ce qui est collecté</h2>
      <ul>
        <li>Ton adresse e-mail et ton prénom, pour créer et retrouver ton compte.</li>
        <li>Une empreinte de ton mot de passe, jamais le mot de passe lui-même.</li>
        <li>
          Tes collections, éléments enregistrés, recherches sauvegardées et annonceurs suivis.
        </li>
        <li>
          Des compteurs d’usage mensuels — recherches, fiches consultées, exports — pour appliquer
          les quotas.
        </li>
        <li>
          Si tu t’abonnes : un identifiant client Stripe. Tes coordonnées bancaires ne transitent
          jamais par Nexteo et ne sont jamais stockées chez nous.
        </li>
      </ul>
      <p>
        Sans compte, un identifiant technique est déposé dans un cookie pour compter les trois fiches
        complètes offertes chaque mois. Il ne sert qu’à ça et ne permet de t’identifier nulle part
        ailleurs.
      </p>

      <h2>Ce qui n’est pas collecté</h2>
      <p>
        Aucune donnée personnelle d’annonceur. Nexteo indexe des <strong>pages</strong>, pas des
        personnes : quand une annonce mentionne un nom, il reste dans le texte publicitaire tel que
        son annonceur l’a publié, et n’est jamais extrait, indexé ni recoupé.
      </p>

      <h2>Où vivent les données</h2>
      <p>
        Base de données hébergée dans l’Union européenne ({SOCIETE.hebergeurDonnees}). Aucun
        transfert hors UE n’est effectué pour les données de compte, à l’exception de Stripe pour le
        paiement, qui agit sous ses propres garanties contractuelles.
      </p>

      <h2>Combien de temps</h2>
      <ul>
        <li>Compte : {CONSERVATION.compte}.</li>
        <li>Pièces de facturation : {CONSERVATION.facturation}.</li>
        <li>Journaux techniques : {CONSERVATION.journauxTechniques}.</li>
      </ul>

      <h2>Tes droits</h2>
      <p>
        Depuis ton compte, tu peux exporter l’intégralité de tes données au format JSON, et supprimer
        ton compte. La suppression est immédiate et définitive : elle emporte tes sessions, ton
        abonnement, tes collections, tes suivis et tes compteurs. Rien n’est conservé « au cas où ».
      </p>
      <p>
        Pour toute question ou pour exercer un droit d’accès, de rectification, d’opposition ou de
        portabilité : <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>. Tu peux aussi
        introduire une réclamation auprès de la CNIL.
      </p>

      <h2>Mesure d’audience</h2>
      <p>
        Aucun traceur publicitaire, aucun partage de données avec des régies. Les statistiques
        d’usage servent au fonctionnement du service et restent internes.
      </p>
    </>
  );
}
