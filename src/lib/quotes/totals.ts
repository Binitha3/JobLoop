export type QuoteTotals = {
  subtotal: number;
  taxable: number;
  tax: number;
  total: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateQuoteTotals(
  lineTotals: readonly number[],
  discountAmount: number,
  taxPercent: number,
  deliveryCharge: number,
): QuoteTotals {
  if (
    lineTotals.some((lineTotal) => !Number.isFinite(lineTotal) || lineTotal < 0)
  ) {
    throw new RangeError("Line totals must be finite and non-negative.");
  }

  if (
    !Number.isFinite(discountAmount) ||
    !Number.isFinite(taxPercent) ||
    !Number.isFinite(deliveryCharge) ||
    discountAmount < 0 ||
    deliveryCharge < 0 ||
    taxPercent < 0 ||
    taxPercent > 100
  ) {
    throw new RangeError("Quote amounts and tax percentage must be valid.");
  }

  const subtotal = roundMoney(
    lineTotals.reduce((sum, lineTotal) => sum + lineTotal, 0),
  );

  if (discountAmount > subtotal) {
    throw new RangeError("Discount cannot exceed the subtotal.");
  }

  const taxable = roundMoney(subtotal - discountAmount);
  const tax = roundMoney((taxable * taxPercent) / 100);
  const total = roundMoney(taxable + tax + deliveryCharge);

  if (total < 0) {
    throw new RangeError("Quote total cannot be negative.");
  }

  return { subtotal, taxable, tax, total };
}
