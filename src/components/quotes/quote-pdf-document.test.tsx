import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import {
  QuotePdfPage,
  type QuotePdfData,
} from "./quote-pdf-document";

describe("QuotePdfPage", () => {
  it("renders Indian currency with an embedded symbol font", async () => {
    const quote: QuotePdfData = {
      businessName: "JobLoop",
      businessPhone: null,
      businessEmail: null,
      quoteNumber: "JL-Q-0001",
      date: "2026-10-24",
      validUntil: "2026-10-31",
      customerName: "Test Customer",
      customerPhone: null,
      customerEmail: null,
      items: [
        {
          service: "Test service",
          quantity: 1,
          unitPrice: 123456,
          lineTotal: 123456,
        },
      ],
      subtotal: 123456,
      discount: 0,
      taxPercent: 18,
      taxAmount: 22222.08,
      deliveryCharge: 0,
      total: 145678.08,
      terms: "Test terms",
    };

    const pdf = await renderToBuffer(
      createElement(
        Document,
        {},
        createElement(QuotePdfPage, { quote }),
      ),
    );

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
