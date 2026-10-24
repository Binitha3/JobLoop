"use client";

import { useActionState, useState } from "react";
import type { QuoteActionState } from "@/server/actions/quotes";
import { calculateQuoteTotals } from "@/lib/quotes/totals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const defaultTerms =
  "This quote is valid until the date shown. Work begins after approval.";

export function QuoteForm({
  action,
  lineTotals,
  defaultValidUntil,
  currency,
}: {
  action: (
    state: QuoteActionState,
    formData: FormData,
  ) => Promise<QuoteActionState>;
  lineTotals: number[];
  defaultValidUntil: string;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxPercent, setTaxPercent] = useState("18");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const totals = (() => {
    try {
      return calculateQuoteTotals(
        lineTotals,
        Number(discountAmount),
        Number(taxPercent),
        Number(deliveryCharge),
      );
    } catch {
      return null;
    }
  })();
  const format = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);

  return (
    <form action={formAction} className="space-y-5">
      {state.message && (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="discountAmount">
            Discount
          </label>
          <Input
            id="discountAmount"
            min="0"
            name="discountAmount"
            onChange={(event) => setDiscountAmount(event.target.value)}
            required
            step="0.01"
            type="number"
            value={discountAmount}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="taxPercent">
            GST %
          </label>
          <Input
            id="taxPercent"
            max="100"
            min="0"
            name="taxPercent"
            onChange={(event) => setTaxPercent(event.target.value)}
            required
            step="0.01"
            type="number"
            value={taxPercent}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="deliveryCharge">
            Delivery charge
          </label>
          <Input
            id="deliveryCharge"
            min="0"
            name="deliveryCharge"
            onChange={(event) => setDeliveryCharge(event.target.value)}
            required
            step="0.01"
            type="number"
            value={deliveryCharge}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="validUntil">
            Valid until
          </label>
          <Input
            defaultValue={defaultValidUntil}
            id="validUntil"
            name="validUntil"
            required
            type="date"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="terms">
          Terms
        </label>
        <textarea
          className="min-h-20 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
          defaultValue={defaultTerms}
          id="terms"
          maxLength={5000}
          name="terms"
        />
      </div>
      <div aria-live="polite" className="space-y-1 border-y border-slate-200 py-3 text-sm tabular-nums">
        <p className="mb-2 font-semibold">Live preview</p>
        <p>Subtotal: {format(totals?.subtotal ?? 0)}</p>
        <p>Taxable: {format(totals?.taxable ?? 0)}</p>
        <p>GST: {format(totals?.tax ?? 0)}</p>
        <p className="font-semibold">Total: {format(totals?.total ?? 0)}</p>
        {!totals && (
          <p className="text-red-700" role="alert">
            Discount cannot exceed subtotal; amounts and GST must be valid.
          </p>
        )}
      </div>
      <Button disabled={pending || !totals} type="submit">
        {pending ? "Saving quote…" : "Save quote"}
      </Button>
    </form>
  );
}
