import "server-only";
import { z } from "zod";

type GenerateStructuredInput<TSchema extends z.ZodType> = {
  system: string;
  user: string;
  schema: TSchema;
};

type Provider = "openai" | "anthropic" | "google";

type ProviderResponse = {
  text: string;
};

function getAIConfig() {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  const model = process.env.AI_MODEL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();

  if (!provider || !model || !apiKey) {
    throw new Error("AI is not configured. Set AI_PROVIDER, AI_MODEL, and AI_API_KEY.");
  }

  if (!["openai", "anthropic", "google"].includes(provider)) {
    throw new Error(`Unsupported AI_PROVIDER "${provider}". Use openai, anthropic, or google.`);
  }

  return { provider: provider as Provider, model, apiKey };
}

async function requestProvider(
  provider: Provider,
  model: string,
  apiKey: string,
  system: string,
  user: string,
): Promise<ProviderResponse> {
  let response: Response;

  if (provider === "openai") {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${system}\nReturn JSON only; do not use markdown.` },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } else if (provider === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: `${system}\nReturn JSON only; do not use markdown.`,
        messages: [{ role: "user", content: user }],
      }),
    });
  } else {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${system}\nReturn JSON only; do not use markdown.` }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
  }

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`AI provider request failed (${response.status}): ${details}`);
  }

  const payload: unknown = await response.json();
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
}

export async function generateStructured<TSchema extends z.ZodType>({
  system,
  user,
  schema,
}: GenerateStructuredInput<TSchema>): Promise<z.infer<TSchema>> {
  const { provider, model, apiKey } = getAIConfig();
  let prompt = user;
  let lastError = "The model response was not valid JSON.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { text } = await requestProvider(provider, model, apiKey, system, prompt);
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

  throw new Error(`Unable to extract valid structured details: ${lastError}`);
}
