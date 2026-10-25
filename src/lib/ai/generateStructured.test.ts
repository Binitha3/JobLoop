import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));

import { extractOrderSchema } from "./extractOrder";
import { AIServiceError, generateStructured } from "./generateStructured";

const validOutput = {
  customer_name: { value: "Asha", confidence: "high" },
  phone: { value: null, confidence: "low" },
  items: {
    value: [],
    confidence: "low",
  },
  deadline: { value: null, confidence: "low" },
  delivery_address: { value: null, confidence: "low" },
  missing_fields: ["phone", "items", "deadline", "delivery_address"],
  clarifying_questions: ["What would you like to order?"],
};

function providerResponse(content: string, status = 200) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function configureAI(fallbackModel?: string) {
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("AI_MODEL", "test-model");
  vi.stubEnv("AI_API_KEY", "test-key");
  if (fallbackModel) vi.stubEnv("AI_FALLBACK_MODEL", fallbackModel);
  vi.spyOn(Math, "random").mockReturnValue(0);
}

function extract() {
  return generateStructured({
    system: "Extract details.",
    user: "Order please.",
    schema: extractOrderSchema,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generateStructured", () => {
  it("retries once with validation errors and returns the validated response", async () => {
    configureAI();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse(JSON.stringify({ customer_name: "Asha" })))
      .mockResolvedValueOnce(providerResponse(JSON.stringify(validOutput)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({
      system: "Extract details.",
      user: "Order please.",
      schema: extractOrderSchema,
    });

    expect(result).toEqual(validOutput);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(retryRequest.messages[1].content).toContain("failed schema validation");
    expect(retryRequest.messages[1].content).toContain("customer_name");
  });

  it("sends an optional image to the vision model and validates its response", async () => {
    configureAI();
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify({ notes: ["Small text may be difficult to read."] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateStructured({
      system: "Review this artwork.",
      user: "List visible concerns.",
      image: { mimeType: "image/jpeg", base64: "c21hbGw=" },
      schema: z.object({ notes: z.array(z.string()) }),
    });

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.messages[1].content[1].image_url.url).toBe(
      "data:image/jpeg;base64,c21hbGw=",
    );
    expect(result).toEqual({ notes: ["Small text may be difficult to read."] });
  });

  it("returns a clear error after the retry is still invalid", async () => {
    configureAI();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => providerResponse("{")));

    await expect(
      extract(),
    ).rejects.toThrow("Unable to extract order details. Please try again.");
  });

  it("succeeds on the second attempt after a 503 response", async () => {
    configureAI();
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse("temporary failure", 503))
      .mockResolvedValueOnce(providerResponse(JSON.stringify(validOutput)));
    vi.stubGlobal("fetch", fetchMock);

    const result = extract();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual(validOutput);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tries the fallback model once after all main-model retries fail temporarily", async () => {
    configureAI("fallback-model");
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse("temporary failure", 503))
      .mockResolvedValueOnce(providerResponse("temporary failure", 503))
      .mockResolvedValueOnce(providerResponse("temporary failure", 503))
      .mockResolvedValueOnce(providerResponse("temporary failure", 503))
      .mockResolvedValueOnce(providerResponse(JSON.stringify(validOutput)));
    vi.stubGlobal("fetch", fetchMock);

    const result = extract();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual(validOutput);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const requestedModels = fetchMock.mock.calls.map((call) =>
      JSON.parse(call[1].body).model,
    );
    expect(requestedModels).toEqual([
      "test-model",
      "test-model",
      "test-model",
      "test-model",
      "fallback-model",
    ]);
  });

  it("does not retry a 401 response", async () => {
    configureAI();
    const fetchMock = vi.fn().mockResolvedValue(
      providerResponse(JSON.stringify({ error: "invalid key" }), 401),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(extract()).rejects.toMatchObject({
      kind: "configuration",
      message: "AI isn't set up correctly.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the friendly temporary message after all attempts fail", async () => {
    configureAI();
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => providerResponse("temporary failure", 503));
    vi.stubGlobal("fetch", fetchMock);

    const result = extract().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({
      error: {
        kind: "temporary",
        message: "The AI service is busy right now. Please try again in a minute.",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("retries requests that time out", async () => {
    configureAI();
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = extract().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({
      error: {
        kind: "temporary",
        message: "The AI service is busy right now. Please try again in a minute.",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry an insufficient-quota response", async () => {
    configureAI();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "insufficient_quota" } }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await extract().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AIServiceError);
    expect(error).toMatchObject({
      kind: "quota",
      message: "AI credits are used up. Contact the workspace owner.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
