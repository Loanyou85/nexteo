import { CoquePublique } from '@/components/coque/coque-publique';
import { MARQUE } from '@/config/brand';

export const metadata = { title: 'Confidentialité' };

export default function Confidentialite() {
  return (
    <CoquePublique>
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-14 text-sm leading-relaxed text-text-2 sm:px-6">
        <h1 className="display text-[40px] text-text-1">Confidentialité</h1>
        <p className="text-warn">Version 2026-09-uefn. Les mentions entre crochets sont à compléter par l’éditeur avant l’ouverture au public.</p>
        <section>
          <h2 className="text-lg font-medium text-text-1">Ce que nous conservons</h2>
          <p>Ton adresse e-mail, ton prénom et une empreinte de ton mot de passe (jamais le mot de passe lui-même). Tes projets : plans de map, code Verse relu dans ton éditeur, devices, historique des générations, erreurs et logs de playtest. Ton registre de crédits et tes abonnements.</p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-text-1">Ton code Verse est envoyé au fournisseur d’IA</h2>
          <p>Pour construire et corriger ta map, le plan de map et le code Verse de tes projets sont transmis au fournisseur d’IA (Anthropic). C’est la condition du service : sans cet envoi, l’agent ne peut ni générer ni corriger. Aucun secret, aucun mot de passe, aucune donnée de paiement n’est envoyé au modèle.</p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-text-1">Paiements</h2>
          <p>Les paiements sont traités par Stripe. Nous ne voyons ni ne conservons ton numéro de carte.</p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-text-1">Hébergement et durée</h2>
          <p>Les données sont hébergées dans l’Union européenne [hébergeur et région à compléter]. Elles sont conservées tant que ton compte existe ; les journaux de construction détaillés sont purgés après [durée à fixer].</p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-text-1">Tes droits</h2>
          <p>Depuis la page « Mon compte », tu peux exporter toutes tes données et supprimer ton compte, définitivement. Pour toute autre demande : {MARQUE.emailSupport}.</p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-text-1">Cookies</h2>
          <p>Un seul cookie, nécessaire à la connexion. Aucun cookie publicitaire, aucun traceur tiers ; les polices sont servies par nos soins.</p>
        </section>
      </article>
    </CoquePublique>
  );
}
