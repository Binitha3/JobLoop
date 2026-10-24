import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { extractOrderSchema } from "./extractOrder";
import { generateStructured } from "./generateStructured";

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

function providerResponse(content: string) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("generateStructured", () => {
  it("retries once with validation errors and returns the validated response", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubEnv("AI_API_KEY", "test-key");
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

  it("returns a clear error after the retry is still invalid", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => providerResponse("{")));

    await expect(
      generateStructured({
        system: "Extract details.",
        user: "Order please.",
        schema: extractOrderSchema,
      }),
    ).rejects.toThrow("Unable to extract valid structured details");
  });
});
