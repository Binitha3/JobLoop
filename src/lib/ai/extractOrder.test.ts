import { describe, expect, it } from "vitest";
import { extractOrderSchema } from "./extractOrder";

const field = <T,>(value: T, confidence: "high" | "medium" | "low" = "high") => ({
  value,
  confidence,
});

const validExtraction = {
  customer_name: field("Asha"),
  phone: field(null),
  items: field([
    {
      service_id: field("c5026a82-bf07-474a-a8c3-0cc2f24005f4"),
      raw_text: field("200 A4 flyers"),
      quantity: field(200),
      size: field("A4"),
      material: field(null),
      notes: field(null),
    },
  ]),
  deadline: field("2026-11-02"),
  delivery_address: field(null),
  missing_fields: ["phone", "delivery_address"],
  clarifying_questions: ["What is the best phone number to reach you?"],
};

describe("extractOrderSchema", () => {
  it("accepts a valid extraction with explicitly missing values", () => {
    expect(extractOrderSchema.safeParse(validExtraction).success).toBe(true);
  });

  it("accepts missing values when they are represented as null and listed", () => {
    const result = extractOrderSchema.safeParse({
      ...validExtraction,
      items: field([
        {
          ...validExtraction.items.value[0],
          quantity: field(null, "low"),
        },
      ]),
      missing_fields: ["phone", "delivery_address", "items[0].quantity"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items.value[0].quantity.value).toBeNull();
    }
  });

  it("rejects omitted fields and wrong value types", () => {
    expect(
      extractOrderSchema.safeParse({
        ...validExtraction,
        phone: undefined,
      }).success,
    ).toBe(false);
    expect(
      extractOrderSchema.safeParse({
        ...validExtraction,
        items: field([
          {
            ...validExtraction.items.value[0],
            quantity: field("two"),
          },
        ]),
      }).success,
    ).toBe(false);
  });
});
