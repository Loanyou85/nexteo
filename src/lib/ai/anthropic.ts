import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import {
  SortieInvalide,
  type AIProvider,
  type Analyse,
  type ErreurAAnalyser,
  type RequeteCode,
  type RequeteStructuree,
  type RequeteTexte,
  type Resultat,
  type Usage,
} from '@/lib/ai/types';

/**
 * Fournisseur Anthropic (section 23).
 *
 * Modèle `claude-opus-5-5`, avec le repli serveur par défaut : si une requête
 * est refusée par un filtre de sécurité, l'API la rejoue sur un autre modèle
 * dans le même appel au lieu de laisser le build s'arrêter. Le modèle
 * réellement servi est relu dans la réponse — c'est lui qui est facturé.
 *
 * Sorties structurées : le SDK convertit le schéma Zod en JSON Schema et
 * valide la réponse avec le schéma d'origine (refinements compris). Une
 * réponse qui ne passe pas est refusée, jamais écrite dans un fichier.
 */

export const MODELE = 'claude-opus-5-5';
const REPLI = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

/** Erreur imputable au fournisseur (réseau, surcharge, 5xx) : la plateforme rembourse. */
export class ErreurFournisseurIA extends Error {
  readonly plateforme = true;
  constructor(message: string) {
    super(message);
    this.name = 'ErreurFournisseurIA';
  }
}

function usageDe(r: {
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
}): Usage {
  return {
    model: r.model,
    inputTokens: r.usage.input_tokens,
    outputTokens: r.usage.output_tokens,
    cacheReadTokens: r.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: r.usage.cache_creation_input_tokens ?? 0,
  };
}

/** Distingue ce qui relève de la plateforme (remboursable) du reste. */
function traduire(e: unknown): never {
  if (
    e instanceof Anthropic.RateLimitError ||
    e instanceof Anthropic.InternalServerError ||
    e instanceof Anthropic.APIConnectionError
  ) {
    throw new ErreurFournisseurIA(`Fournisseur d’IA indisponible : ${(e as Error).message}`);
  }
  if (e instanceof Anthropic.APIError && typeof e.status === 'number' && e.status >= 500) {
    throw new ErreurFournisseurIA(`Fournisseur d’IA en erreur ${e.status}`);
  }
  throw e;
}

const analyseSchema = z.object({
  cause: z.string().min(1).max(600),
  fichier: z.string().max(200).nullable(),
  strategie: z.string().min(1).max(800),
});

const codeSchema = z.object({
  contenu: z.string().min(1),
  resume: z.string().max(400),
});

const SYSTEME_VERSE = `Tu écris du code Verse pour Unreal Editor for Fortnite (UEFN).
Règles :
- Un fichier = un module, une classe principale dérivée de creative_device quand il pilote des devices.
- Déclare chaque device utilisé en @editable, jamais de référence inventée.
- Chaque étape observable émet une ligne Print("[NX] cle=valeur") : c'est ainsi que les tests lisent la map.
- Pas de dépendance à un module qui n'est pas listé dans le contexte.
Réponds uniquement avec le contenu complet du fichier et un résumé d'une phrase.`;

export class AnthropicProvider implements AIProvider {
  readonly nom = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }

  async generate(req: RequeteTexte): Promise<Resultat<string>> {
    try {
      const r = await this.client.beta.messages.create({
        model: MODELE,
        max_tokens: req.maxTokens ?? 16000,
        ...REPLI,
        system: [{ type: 'text', text: req.systeme, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: req.message }],
      });
      if (r.stop_reason === 'refusal') throw new SortieInvalide(['Requête refusée par le modèle.']);
      const texte = r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      return { valeur: texte, usage: usageDe(r) };
    } catch (e) {
      if (e instanceof SortieInvalide) throw e;
      return traduire(e);
    }
  }

  async *stream(req: RequeteTexte): AsyncIterable<string> {
    const flux = this.client.beta.messages.stream({
      model: MODELE,
      max_tokens: req.maxTokens ?? 64000,
      ...REPLI,
      system: [{ type: 'text', text: req.systeme, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: req.message }],
    });
    try {
      for await (const ev of flux) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
      }
    } catch (e) {
      traduire(e);
    }
  }

  async structuredOutput<T>(req: RequeteStructuree<T>): Promise<Resultat<T>> {
    try {
      const r = await this.client.beta.messages.parse({
        model: MODELE,
        max_tokens: req.maxTokens ?? 16000,
        ...REPLI,
        system: [{ type: 'text', text: req.systeme, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: req.message }],
        output_config: {
          effort: 'medium',
          format: betaZodOutputFormat(req.schema),
        },
      });
      if (r.stop_reason === 'refusal') throw new SortieInvalide(['Requête refusée par le modèle.']);
      if (r.stop_reason === 'max_tokens') throw new SortieInvalide(['Réponse tronquée : limite de longueur atteinte.']);

      const brut = r.parsed_output;
      // Seconde validation avec le schéma d'origine : c'est elle qui fait foi.
      const verif = req.schema.safeParse(brut);
      if (!verif.success) {
        throw new SortieInvalide(verif.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`));
      }
      return { valeur: verif.data, usage: usageDe(r) };
    } catch (e) {
      if (e instanceof SortieInvalide) throw e;
      return traduire(e);
    }
  }

  async analyze(erreur: ErreurAAnalyser): Promise<Resultat<Analyse>> {
    return this.structuredOutput({
      systeme:
        'Tu analyses une erreur de build UEFN. Identifie la cause réelle à partir du message BRUT, le fichier en cause, et la stratégie de correction minimale. Ne reformule pas le message : il est conservé tel quel à côté.',
      message: JSON.stringify(erreur),
      schema: analyseSchema,
      nomSchema: 'Analyse',
      maxTokens: 4000,
    });
  }

  async codeGeneration(req: RequeteCode): Promise<Resultat<string>> {
    const consigne =
      req.intention === 'module'
        ? `Écris le module ${req.chemin}.\nConsigne : ${req.consigne}\nContexte :\n${req.contexte}`
        : `Corrige ${req.chemin} en modifiant le MINIMUM nécessaire.\nErreur brute :\n${req.erreur?.brut ?? ''}\nContenu actuel :\n${req.contenuActuel ?? ''}\nContexte :\n${req.contexte}`;

    const r = await this.structuredOutput({
      systeme: SYSTEME_VERSE,
      message: consigne,
      schema: codeSchema,
      nomSchema: 'Code',
      maxTokens: 16000,
    });
    return { valeur: r.valeur.contenu, usage: r.usage };
  }
}
