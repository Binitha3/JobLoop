import { z } from "zod";

const confidenceSchema = z.enum(["high", "medium", "low"]);

function extractedField<T extends z.ZodType>(value: T) {
  return z.object({
    value,
    confidence: confidenceSchema,
  });
}

const nullableText = z.string().trim().min(1).nullable();

export const extractOrderSchema = z.object({
  customer_name: extractedField(nullableText),
  phone: extractedField(nullableText),
  items: extractedField(
    z.array(
      z.object({
        service_id: extractedField(z.string().uuid().nullable()),
        raw_text: extractedField(z.string().trim().min(1)),
        quantity: extractedField(z.number().positive().max(1_000_000).nullable()),
        size: extractedField(nullableText),
        material: extractedField(nullableText),
        notes: extractedField(nullableText),
      }),
    ).max(25),
  ),
  deadline: extractedField(z.iso.date().nullable()),
  delivery_address: extractedField(nullableText),
  missing_fields: z.array(z.string().min(1)).max(100),
  clarifying_questions: z.array(z.string().trim().min(1)).max(20),
});

export type ExtractOrder = z.infer<typeof extractOrderSchema>;

export const extractOrderSystemPrompt = `You extract order details from customer messages for a print and signage business.
Messages may be in English, Hinglish, Hindi, or Kannada, informal, and may mix languages.
Never invent values. When a value is not stated or cannot be safely inferred, use null and include its field name in missing_fields. For a missing item quantity, use null and add a path such as items[0].quantity.
Match service_id only to an exact service from the supplied workspace catalogue; otherwise use null.
Convert relative deadlines such as "by Friday" or "kal tak" to an ISO date using the supplied today's date. If the deadline is ambiguous, use null and ask for clarification.
Write clarifying_questions in the same language and informal style as the customer's message.
Return only a JSON object matching the requested schema. Every extracted field value must be an object with value and confidence ("high", "medium", or "low").`;

export function buildExtractOrderPrompt(input: {
  message: string;
  today: string;
  services: { id: string; name: string; unit: string }[];
}) {
  return [
    `Today's date: ${input.today}`,
    "Workspace service catalogue (use only these service IDs):",
    JSON.stringify(input.services),
    "Customer message:",
    input.message,
    "Return JSON with this shape:",
    JSON.stringify({
      customer_name: { value: "string or null", confidence: "high|medium|low" },
      phone: { value: "string or null", confidence: "high|medium|low" },
      items: {
        value: [
          {
            service_id: { value: "catalogue UUID or null", confidence: "high|medium|low" },
            raw_text: { value: "original item text", confidence: "high|medium|low" },
            quantity: { value: "positive number or null", confidence: "high|medium|low" },
            size: { value: "string or null", confidence: "high|medium|low" },
            material: { value: "string or null", confidence: "high|medium|low" },
            notes: { value: "string or null", confidence: "high|medium|low" },
          },
        ],
        confidence: "high|medium|low",
      },
      deadline: { value: "YYYY-MM-DD or null", confidence: "high|medium|low" },
      delivery_address: { value: "string or null", confidence: "high|medium|low" },
      missing_fields: ["field name or item path"],
      clarifying_questions: ["short question in the customer's language style"],
    }),
  ].join("\n");
}
