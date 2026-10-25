import "server-only";
import { z } from "zod";

type GenerateStructuredInput<TSchema extends z.ZodType> = {
  system: string;
  user: string;
  schema: TSchema;
};

type Provider = "openai" | "anthropic" | "google";
type AIErrorKind = "temporary" | "quota" | "configuration" | "other";

type ProviderResponse = {
  text: string;
};

const temporaryMessage =
  "The AI service is busy right now. Please try again in a minute.";
const quotaMessage = "AI credits are used up. Contact the workspace owner.";
const configurationMessage = "AI isn't set up correctly.";
const genericMessage = "Unable to extract order details. Please try again.";
const retryableStatuses = new Set([429, 500, 502, 503, 504]);
const retryDelaysMs = [1_000, 2_000, 4_000];
const requestTimeoutMs = 30_000;

export class AIServiceError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly details?: string,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`AI provider request failed (${status}): ${responseBody}`);
    this.name = "ProviderHttpError";
  }
}

function getAIConfig() {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  const model = process.env.AI_MODEL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();
  const fallbackModel = process.env.AI_FALLBACK_MODEL?.trim();

  if (!provider || !model || !apiKey) {
    throw new AIServiceError("configuration", configurationMessage);
  }

  if (!["openai", "anthropic", "google"].includes(provider)) {
    throw new AIServiceError("configuration", configurationMessage);
  }

  return {
    provider: provider as Provider,
    model,
    apiKey,
    fallbackModel: fallbackModel && fallbackModel !== model ? fallbackModel : undefined,
  };
}

async function requestProvider(
  provider: Provider,
  model: string,
  apiKey: string,
  system: string,
  user: string,
): Promise<ProviderResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, requestTimeoutMs);

  try {
    let url: string;
    let headers: HeadersInit;
    let body: string;

    if (provider === "openai") {
      url = "https://api.openai.com/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      body = JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${system}\nReturn JSON only; do not use markdown.` },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
    } else if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/messages";
      headers = {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
      body = JSON.stringify({
        model,
        max_tokens: 4096,
        system: `${system}\nReturn JSON only; do not use markdown.`,
        messages: [{ role: "user", content: user }],
      });
    } else {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      headers = { "Content-Type": "application/json" };
      body = JSON.stringify({
        systemInstruction: { parts: [{ text: `${system}\nReturn JSON only; do not use markdown.` }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json" },
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const responseBody = await response.text();

    if (!response.ok) {
      throw new ProviderHttpError(response.status, responseBody);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseBody);
    } catch {
      throw new Error("AI provider returned invalid JSON.");
    }

    const parsedPayload = z
      .object({
        choices: z.array(z.object({
          message: z.object({ content: z.string() }),
        })).optional(),
        content: z.array(z.object({ text: z.string().optional() })).optional(),
        candidates: z.array(z.object({
          content: z.object({
            parts: z.array(z.object({ text: z.string().optional() })),
          }),
        })).optional(),
      })
      .safeParse(payload);

    if (!parsedPayload.success) {
      throw new Error("AI provider returned an unsupported response format.");
    }

    const text =
      parsedPayload.data.choices?.[0]?.message.content ??
      parsedPayload.data.content?.map((block) => block.text ?? "").join("") ??
      parsedPayload.data.candidates?.[0]?.content.parts
        .map((part) => part.text ?? "")
        .join("");

    if (!text) throw new Error("AI provider returned an empty response.");
    return { text };
  } catch (error) {
    if (error instanceof ProviderHttpError) throw error;
    if (timedOut) {
      throw new AIServiceError("temporary", temporaryMessage, "AI provider request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isQuotaError(status: number, body: string) {
  return status === 402 || /insufficient[_\s-]*quota|billing|quota/i.test(body);
}

function classifyProviderError(error: unknown): AIServiceError {
  if (error instanceof AIServiceError) return error;
  if (error instanceof ProviderHttpError) {
    if (isQuotaError(error.status, error.responseBody)) {
      return new AIServiceError("quota", quotaMessage, error.message);
    }
    if (error.status === 401 || error.status === 403) {
      return new AIServiceError("configuration", configurationMessage, error.message);
    }
    if (retryableStatuses.has(error.status)) {
      return new AIServiceError("temporary", temporaryMessage, error.message);
    }
    return new AIServiceError("other", genericMessage, error.message);
  }
  return new AIServiceError(
    "other",
    genericMessage,
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
}

function isRetryable(error: AIServiceError) {
  return error.kind === "temporary";
}

function waitBeforeRetry(retryIndex: number) {
  const backoffMs = retryDelaysMs[retryIndex] ?? retryDelaysMs.at(-1)!;
  const jitterMs = Math.floor(Math.random() * 251);
  return new Promise<void>((resolve) => setTimeout(resolve, backoffMs + jitterMs));
}

async function requestWithRetries(
  provider: Provider,
  model: string,
  apiKey: string,
  system: string,
  user: string,
): Promise<ProviderResponse> {
  let lastError: AIServiceError | undefined;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await requestProvider(provider, model, apiKey, system, user);
    } catch (error) {
      lastError = classifyProviderError(error);
      if (!isRetryable(lastError) || attempt === retryDelaysMs.length) throw lastError;
      await waitBeforeRetry(attempt);
    }
  }

  throw lastError ?? new AIServiceError("other", genericMessage);
}

async function requestWithFallback(
  provider: Provider,
  model: string,
  fallbackModel: string | undefined,
  apiKey: string,
  system: string,
  user: string,
): Promise<ProviderResponse> {
  try {
    return await requestWithRetries(provider, model, apiKey, system, user);
  } catch (error) {
    const primaryError = classifyProviderError(error);
    if (primaryError.kind !== "temporary" || !fallbackModel) throw primaryError;

    try {
      return await requestProvider(provider, fallbackModel, apiKey, system, user);
    } catch (fallbackError) {
      const classifiedFallbackError = classifyProviderError(fallbackError);
      throw new AIServiceError(
        classifiedFallbackError.kind,
        classifiedFallbackError.message,
        `Primary model failed: ${primaryError.details ?? primaryError.message}\nFallback model failed: ${classifiedFallbackError.details ?? classifiedFallbackError.message}`,
      );
    }
  }
}

export async function generateStructured<TSchema extends z.ZodType>({
  system,
  user,
  schema,
}: GenerateStructuredInput<TSchema>): Promise<z.infer<TSchema>> {
  const { provider, model, fallbackModel, apiKey } = getAIConfig();
  let prompt = user;
  let lastError = "The model response was not valid JSON.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { text } = await requestWithFallback(
      provider,
      model,
      fallbackModel,
      apiKey,
      system,
      prompt,
    );
    let decoded: unknown;

    try {
      decoded = JSON.parse(text);
    } catch {
      lastError = "The response was not valid JSON.";
      prompt = `${user}\n\nYour previous response was invalid. ${lastError} Return only a valid JSON object.`;
      continue;
    }

    const result = schema.safeParse(decoded);
    if (result.success) return result.data;

    lastError = result.error.issues
      .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
      .join("; ");
    prompt = `${user}\n\nYour previous JSON failed schema validation. Fix these errors and return only corrected JSON: ${lastError}`;
  }

  throw new AIServiceError("other", genericMessage, lastError);
}
