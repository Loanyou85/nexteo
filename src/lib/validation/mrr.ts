import { z } from 'zod';

/**
 * Saisie d'un revenu mensuel déclaré.
 *
 * Un montant déclaré n'a de valeur que s'il est traçable. Sans lien vers la
 * publication, plus personne ne peut vérifier — et un chiffre invérifiable
 * dans une base de données devient un chiffre inventé au bout de six mois.
 * La source est donc obligatoire, et doit être une adresse http(s).
 *
 * La date est celle du relevé, pas celle de la saisie : un MRR publié en
 * janvier et saisi en septembre reste un chiffre de janvier, et l'afficher
 * comme récent tromperait le lecteur.
 */
export const mrrDeclareSchema = z.object({
  advertiserId: z.string().min(1, 'Annonceur manquant.'),
  /** Saisi en euros par mois, converti en centimes au stockage. */
  montantEuros: z.coerce
    .number({ message: 'Entre un montant en euros.' })
    .positive('Le montant doit être supérieur à zéro.')
    .max(100_000_000, 'Ce montant dépasse ce qu’on peut raisonnablement croire ; vérifie la source.'),
  source: z
    .string()
    .trim()
    .min(1, 'Le lien vers la publication est obligatoire.')
    .refine(
      (v) => /^https?:\/\/\S+\.\S+/.test(v),
      'Donne l’adresse complète de la publication, en http ou https.',
    ),
  releveLe: z.coerce
    .date({ message: 'Entre la date du relevé.' })
    .max(new Date(Date.now() + 86_400_000), 'Cette date est dans le futur.')
    .refine((d) => d.getFullYear() >= 2010, 'Cette date est trop ancienne pour être un relevé de MRR.'),
});

export type MrrDeclare = z.infer<typeof mrrDeclareSchema>;

export const oubliMrrSchema = z.object({ advertiserId: z.string().min(1) });
