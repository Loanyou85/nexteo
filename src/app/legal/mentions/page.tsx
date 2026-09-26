import { SOCIETE } from '@/lib/societe';

export const metadata = { title: 'Mentions légales — Nexteo' };

/**
 * Les informations d'éditeur restent entre crochets tant qu'elles ne sont pas
 * renseignées : on n'invente pas l'identité d'une entreprise, et un crochet
 * visible en production se corrige, contrairement à une valeur plausible.
 */
export default function MentionsPage() {
  return (
    <>
      <h1>Mentions légales</h1>

      <h2>Éditeur</h2>
      <p>
        {SOCIETE.nom}, {SOCIETE.formeJuridique}. Siège social : {SOCIETE.siege}.
        <br />
        SIRET : {SOCIETE.siret}. TVA intracommunautaire : {SOCIETE.tva}.
        <br />
        Directeur de la publication : {SOCIETE.directeurPublication}.
        <br />
        Contact : <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a>.
      </p>

      <h2>Hébergement</h2>
      <p>
        Application : {SOCIETE.hebergeur}.
        <br />
        Base de données : {SOCIETE.hebergeurDonnees}.
      </p>

      <h2>Provenance et limites des données</h2>
      <p>
        Les annonces présentées proviennent de l’API officielle de la bibliothèque publicitaire de
        Meta (<em>Meta Ad Library</em>), endpoint <code>ads_archive</code>. Nexteo ne pratique aucun
        moissonnage de l’interface web de cette bibliothèque, ni des magasins d’applications.
      </p>
      <p>
        Hors publicités à caractère politique, cette API ne couvre que les annonces diffusées auprès
        d’utilisateurs de l’Union européenne, en application du Digital Services Act. La couverture
        de Nexteo est donc européenne, jamais mondiale.
      </p>
      <p>
        Meta retire les annonces commerciales de son archive environ douze mois après leur dernière
        impression. Nexteo conserve ce qu’il a observé avant ce retrait ; ces annonces conservées
        sont signalées comme telles. Pour toute annonce affichée, un lien renvoie vers son
        instantané officiel chez Meta, qui fait foi.
      </p>

      <h2>Les montants affichés, et ce qu’ils valent</h2>
      <p>
        Nexteo affiche deux types de montants, qui ne se lisent pas de la même façon et ne sont
        jamais mélangés.
      </p>
      <p>
        Un montant <strong>déclaré</strong> a été publié par l’entreprise elle-même. Nexteo indique
        le lien vers cette publication et la date du relevé. Nexteo ne garantit ni l’exactitude ni
        l’actualité de ce que l’entreprise a publié.
      </p>
      <p>
        Une <strong>estimation</strong> est calculée par Nexteo à partir de la portée européenne que
        Meta expose pour les annonces concernées, par une chaîne d’hypothèses de marché explicitée à
        côté de chaque montant. Elle est présentée en fourchette, jamais en valeur unique. Ce n’est
        pas une mesure : le revenu d’une société privée n’est pas une donnée publique, et aucune
        estimation ne doit être tenue pour un fait ni servir de base à une décision
        d’investissement.
      </p>
      <p>
        Le signal Nexteo, lui, ne contient aucune donnée monétaire. Il mesure une activité
        publicitaire observée — durée de diffusion, continuité, volume, étendue — et ne décrit pas la
        santé financière d’une entreprise.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes et visuels publicitaires affichés appartiennent à leurs annonceurs respectifs. Ils
        sont reproduits à des fins d’information et de veille, avec lien vers leur source officielle.
        Toute demande relative à une annonce peut être adressée à{' '}
        <a href={`mailto:${SOCIETE.email}`}>{SOCIETE.email}</a> ; une page peut être exclue de
        l’index sur demande motivée.
      </p>
    </>
  );
}
