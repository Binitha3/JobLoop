import { describe, expect, it } from "vitest";
import { calculateQuoteTotals } from "./totals";

describe("calculateQuoteTotals", () => {
  it("sums line totals and applies discount, tax, and delivery", () => {
    expect(calculateQuoteTotals([100, 50.25], 10, 18, 20)).toEqual({
      subtotal: 150.25,
      taxable: 140.25,
      tax: 25.25,
      total: 185.5,
    });
  });

  it("rounds monetary results to two decimals", () => {
    expect(calculateQuoteTotals([0.1, 0.2], 0, 18, 0)).toEqual({
      subtotal: 0.3,
      taxable: 0.3,
      tax: 0.05,
      total: 0.35,
    });
  });

  it("accepts a discount equal to the subtotal", () => {
    expect(calculateQuoteTotals([10], 10, 18, 0)).toEqual({
      subtotal: 10,
      taxable: 0,
      tax: 0,
      total: 0,
    });
  });

  it("rejects discounts above subtotal", () => {
    expect(() => calculateQuoteTotals([10], 10.01, 18, 0)).toThrow(
      "Discount cannot exceed the subtotal.",
    );
  });

  it.each([
    [[-1], 0, 18, 0],
    [[Number.NaN], 0, 18, 0],
    [[10], -1, 18, 0],
    [[10], 0, 101, 0],
    [[10], 0, 18, -1],
  ])("rejects invalid quote values", (items, discount, tax, delivery) => {
    expect(() =>
      calculateQuoteTotals(items as number[], discount, tax, delivery),
    ).toThrow(RangeError);
  });
});
