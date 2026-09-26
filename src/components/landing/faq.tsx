const QUESTIONS: { q: string; r: string }[] = [
  {
    q: 'D’où viennent les données ?',
    r: 'De l’API officielle de la bibliothèque publicitaire de Meta, endpoint ads_archive. Aucun moissonnage de l’interface web, aucun service tiers de contournement. Chaque annonce affichée renvoie vers son instantané officiel chez Meta.',
  },
  {
    q: 'Pourquoi n’affichez-vous pas le chiffre d’affaires des entreprises ?',
    r: 'Parce que personne ne le connaît. Cette donnée n’existe publiquement nulle part pour une société privée, et les outils qui en affichent une l’ont déduite du nombre d’avis et du classement dans les magasins d’applications. C’est une supposition présentée comme un fait. Nexteo mesure autre chose : depuis combien de temps une entreprise paie pour diffuser. C’est vérifiable, et ça se vérifie sur l’instantané officiel.',
  },
  {
    q: 'En quoi la durée de diffusion est-elle un signal ?',
    r: 'Une campagne publicitaire se paie tous les jours. Une entreprise qui diffuse la même annonce sans interruption depuis huit mois a donc, huit mois durant, décidé chaque jour de continuer à payer. C’est le meilleur signal public disponible sur ce qui fonctionne — et contrairement à une estimation de recettes, c’est un fait observable.',
  },
  {
    q: 'Pourquoi uniquement l’Europe ?',
    r: 'Hors publicités politiques, l’API officielle ne couvre que les annonces diffusées auprès d’utilisateurs de l’Union européenne, en application du Digital Services Act. C’est une contrainte pour un produit américain. Pour qui cible des annonceurs européens, c’est exactement le bon périmètre.',
  },
  {
    q: 'Qu’est-ce que vous avez que je ne peux pas aller chercher moi-même ?',
    r: 'L’historique. Meta retire une annonce commerciale de son archive environ douze mois après sa dernière impression. Une recherche faite aujourd’hui ne voit que la fenêtre d’aujourd’hui. Nexteo ingère tous les jours et ne supprime jamais : les annonces que Meta a déjà effacées sont conservées ici, et elles ne sont plus récupérables ailleurs.',
  },
  {
    q: 'Le signal dit-il qu’une entreprise va bien ?',
    r: 'Non, et il ne faut pas le lire ainsi. Il décrit une activité publicitaire observée : durée, continuité, volume, rythme de production de créations, étendue géographique. Les libellés des bandes — test, en cours de validation, modèle installé, modèle éprouvé — décrivent cette activité, jamais une santé financière.',
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-bordure border-y border-bordure">
      {QUESTIONS.map((item) => (
        <details key={item.q} className="group py-4">
          <summary className="cursor-pointer list-none text-base font-medium text-encre marker:hidden">
            <span className="flex items-start justify-between gap-4">
              {item.q}
              <span
                aria-hidden
                className="mt-1 shrink-0 text-encre-2 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </span>
          </summary>
          <p className="mt-2 max-w-2xl text-sm text-encre-2">{item.r}</p>
        </details>
      ))}
    </div>
  );
}
