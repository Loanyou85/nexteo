import { z } from 'zod';

/** Longueur minimale : on préfère un mot de passe long à un mot de passe compliqué. */
export const MIN_PASSWORD_LENGTH = 8;

export const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'Ton prénom, au moins deux lettres.')
    .max(60, 'Ce prénom est trop long.'),
  email: z.string().trim().toLowerCase().email('Cette adresse e-mail n’est pas valide.'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Ton mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
    .max(200, 'Ce mot de passe est trop long.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
