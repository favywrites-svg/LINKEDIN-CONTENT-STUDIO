import { z } from "zod";
import { getEffectiveEnv } from "@/lib/env-store";

export type AIErrorCode =
  | "MISSING_KEY"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "UPSTREAM_ERROR";

export class AIProviderError extends Error {
  readonly code: AIErrorCode;
  readonly provider: string;

  constructor(code: AIErrorCode, message: string, provider = "gemini") {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.provider = provider;
  }
}

export interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;
  generateStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<T>;
}

function extractJsonObject(raw: string): unknown {
  // Strip reasoning tags emitted by some OpenRouter/thinking models before extracting JSON
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const withoutFences = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const firstBrace = withoutFences.indexOf("{");
    const lastBrace = withoutFences.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Model output did not contain valid JSON.");
  }
}

function validateStructuredText<T>(
  text: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  providerName: string
): T {
  if (!text.trim()) {
    throw new AIProviderError(
      "INVALID_RESPONSE",
      `${providerName} returned an empty response. Please retry.`,
      providerName
    );
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = extractJsonObject(text);
  } catch {
    throw new AIProviderError(
      "INVALID_RESPONSE",
      `${providerName} returned malformed JSON output. Rejected safely without overwriting your data.`,
      providerName
    );
  }

  const validated = schema.safeParse(parsedUnknown);
  if (!validated.success) {
    throw new AIProviderError(
      "INVALID_RESPONSE",
      `Model response failed schema validation (${validated.error.issues[0]?.message ?? "invalid shape"}). Please retry.`,
      providerName
    );
  }

  return validated.data;
}

export class GeminiProvider implements AIProvider {
  readonly providerName = "gemini";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(apiKey: string, modelName = "gemini-3.5-flash-lite") {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<T> {
    const timeoutMs = params.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.modelName
    )}:generateContent`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: params.systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: params.userPrompt }],
            },
          ],
          generationConfig: {
            temperature: params.temperature ?? 0.65,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        if (res.status === 429) {
          const isQuota = errBody.toLowerCase().includes("quota");
          throw new AIProviderError(
            isQuota ? "QUOTA_EXCEEDED" : "RATE_LIMITED",
            isQuota
              ? `Gemini free-tier quota reached for ${this.modelName}.`
              : `Gemini rate limit reached (HTTP 429) on ${this.modelName}.`,
            this.providerName
          );
        }
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          throw new AIProviderError(
            "UPSTREAM_ERROR",
            `Gemini rejected the request (HTTP ${res.status}) for ${this.modelName}.`,
            this.providerName
          );
        }
        throw new AIProviderError(
          "UPSTREAM_ERROR",
          `Gemini (${this.modelName}) returned HTTP ${res.status}.`,
          this.providerName
        );
      }

      const payload = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text =
        payload.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? "";

      return validateStructuredText(text, params.schema, this.providerName);
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError(
          "TIMEOUT",
          `Gemini (${this.modelName}) timed out.`,
          this.providerName
        );
      }
      throw new AIProviderError(
        "UPSTREAM_ERROR",
        err instanceof Error ? err.message : "Unexpected Gemini network error.",
        this.providerName
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OpenRouterProvider implements AIProvider {
  readonly providerName = "openrouter";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(
    apiKey: string,
    modelName = "nvidia/nemotron-3-ultra-550b-a55b:free"
  ) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<T> {
    // Safety guard: never invoke non-free OpenRouter slugs unless user explicitly removed :free and approved paid usage
    if (
      !this.modelName.endsWith(":free") &&
      this.modelName !== "openrouter/free"
    ) {
      throw new AIProviderError(
        "UPSTREAM_ERROR",
        `Refusing non-free OpenRouter model "${this.modelName}". Use a ":free" model ID (e.g. nvidia/nemotron-3-ultra-550b-a55b:free) so no paid usage occurs.`,
        this.providerName
      );
    }

    const timeoutMs = params.timeoutMs ?? 75000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "http://localhost:3010",
          "X-Title": "LinkedIn Content Assistant",
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature: params.temperature ?? 0.65,
          messages: [
            {
              role: "system",
              content: `${params.systemPrompt}\n\nIMPORTANT: Respond with a single valid JSON object only, with no markdown prose outside the JSON.`,
            },
            {
              role: "user",
              content: params.userPrompt,
            },
          ],
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          throw new AIProviderError(
            "RATE_LIMITED",
            `OpenRouter rate limit reached for ${this.modelName} (HTTP 429).`,
            this.providerName
          );
        }
        throw new AIProviderError(
          "UPSTREAM_ERROR",
          `OpenRouter (${this.modelName}) returned HTTP ${res.status}.`,
          this.providerName
        );
      }

      const payload = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string };
        }>;
      };

      const text = payload.choices?.[0]?.message?.content ?? "";
      return validateStructuredText(text, params.schema, this.providerName);
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError(
          "TIMEOUT",
          `OpenRouter (${this.modelName}) timed out.`,
          this.providerName
        );
      }
      throw new AIProviderError(
        "UPSTREAM_ERROR",
        err instanceof Error
          ? err.message
          : "Unexpected OpenRouter network error.",
        this.providerName
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Chains user-approved free-tier providers in "auto" mode so temporary 503/429 spikes
 * on one free endpoint smoothly fall over to the user's backup free endpoint (never paid).
 */
class AutoFreeChainProvider implements AIProvider {
  private readonly chain: AIProvider[];
  providerName: string;
  modelName: string;

  constructor(chain: AIProvider[]) {
    this.chain = chain;
    this.providerName = chain[0].providerName;
    this.modelName = chain[0].modelName;
  }

  async generateStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<T> {
    let lastError: unknown = null;
    for (const candidate of this.chain) {
      try {
        const out = await candidate.generateStructured(params);
        this.providerName = candidate.providerName;
        this.modelName = candidate.modelName;
        return out;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new AIProviderError(
          "UPSTREAM_ERROR",
          "All configured free-tier models are temporarily busy. Please retry in a moment."
        );
  }
}

export function getActiveAIProvider(
  envOverride?: Record<string, string | undefined>,
  modelChoice?: string
): AIProvider {
  const env = envOverride ?? getEffectiveEnv();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openRouterKey = env.OPENROUTER_API_KEY?.trim();

  // Explicit model chosen from the Dashboard picker (e.g. "gemini:gemini-3.5-flash-lite" or "openrouter:google/gemma-4-31b-it:free")
  if (modelChoice && modelChoice !== "auto") {
    if (modelChoice.startsWith("gemini:")) {
      const chosenModel = modelChoice.slice("gemini:".length).trim();
      if (!geminiKey) {
        throw new AIProviderError(
          "MISSING_KEY",
          "GEMINI_API_KEY is not configured yet. Add it in Settings or choose an OpenRouter model.",
          "gemini"
        );
      }
      // Try chosen Gemini model first, with automatic fallback if Google returns temporary 503
      const fallbacks: AIProvider[] = [
        new GeminiProvider(geminiKey, chosenModel),
      ];
      if (chosenModel !== "gemini-3.5-flash-lite") {
        fallbacks.push(new GeminiProvider(geminiKey, "gemini-3.5-flash-lite"));
      }
      if (openRouterKey) {
        fallbacks.push(
          new OpenRouterProvider(
            openRouterKey,
            "nvidia/nemotron-3.5-lightning:free"
          )
        );
      }
      return fallbacks.length === 1
        ? fallbacks[0]
        : new AutoFreeChainProvider(fallbacks);
    }

    if (modelChoice.startsWith("openrouter:")) {
      const chosenModel = modelChoice.slice("openrouter:".length).trim();
      if (!openRouterKey) {
        throw new AIProviderError(
          "MISSING_KEY",
          "OPENROUTER_API_KEY is not configured yet. Add it in Settings or choose Gemini.",
          "openrouter"
        );
      }
      const fallbacks: AIProvider[] = [
        new OpenRouterProvider(openRouterKey, chosenModel),
      ];
      for (const backup of [
        "nvidia/nemotron-3.5-lightning:free",
        "nvidia/nemotron-3-ultra-550b-a55b:free",
        "openrouter/free",
      ]) {
        if (backup !== chosenModel) {
          fallbacks.push(new OpenRouterProvider(openRouterKey, backup));
        }
      }
      return new AutoFreeChainProvider(fallbacks);
    }
  }

  const requested = (env.AI_PROVIDER || "auto").toLowerCase();

  const configuredGeminiModel =
    env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const configuredOrModel =
    env.OPENROUTER_MODEL?.trim() || "nvidia/nemotron-3-ultra-550b-a55b:free";

  if (requested === "openrouter") {
    if (!openRouterKey) {
      throw new AIProviderError(
        "MISSING_KEY",
        "AI_PROVIDER is set to OpenRouter, but OPENROUTER_API_KEY is empty in .env.",
        "openrouter"
      );
    }
    return new OpenRouterProvider(openRouterKey, configuredOrModel);
  }

  if (requested === "gemini") {
    if (!geminiKey) {
      throw new AIProviderError(
        "MISSING_KEY",
        "AI_PROVIDER is set to Gemini, but GEMINI_API_KEY is empty in .env.",
        "gemini"
      );
    }
    return new GeminiProvider(geminiKey, configuredGeminiModel);
  }

  // "auto": build resilient chain across the user's configured free keys only
  const chain: AIProvider[] = [];
  if (geminiKey) {
    chain.push(new GeminiProvider(geminiKey, configuredGeminiModel));
    for (const extraGemini of [
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
    ]) {
      if (configuredGeminiModel !== extraGemini) {
        chain.push(new GeminiProvider(geminiKey, extraGemini));
      }
    }
  }
  if (openRouterKey) {
    const freeOrFallbacks = [
      configuredOrModel,
      "nvidia/nemotron-3.5-lightning:free",
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "openrouter/free",
    ];
    for (const slug of Array.from(new Set(freeOrFallbacks))) {
      chain.push(new OpenRouterProvider(openRouterKey, slug));
    }
  }

  if (chain.length === 0) {
    throw new AIProviderError(
      "MISSING_KEY",
      "No AI key is configured yet. Paste your GEMINI_API_KEY and/or OPENROUTER_API_KEY into .env (or Settings) to start generating content."
    );
  }

  return chain.length === 1 ? chain[0] : new AutoFreeChainProvider(chain);
}

export async function testAIProviderConnection(): Promise<{
  ok: boolean;
  provider: string;
  model: string;
  message: string;
}> {
  const provider = getActiveAIProvider();
  const PingSchema = z.object({ status: z.string() });
  await provider.generateStructured({
    systemPrompt: "Return a JSON object with status set to 'connected'.",
    userPrompt: "Verify connectivity.",
    schema: PingSchema,
    temperature: 0,
    timeoutMs: 20000,
  });

  return {
    ok: true,
    provider: provider.providerName,
    model: provider.modelName,
    message: `Connected cleanly to ${provider.providerName} (${provider.modelName}).`,
  };
}
