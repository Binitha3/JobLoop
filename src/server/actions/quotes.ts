"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

export type QuoteActionState = { message: string };

const quoteInputSchema = z.object({
  discountAmount: z.number().finite().min(0).max(1_000_000_000),
  taxPercent: z.number().finite().min(0).max(100),
  deliveryCharge: z.number().finite().min(0).max(1_000_000_000),
  validUntil: z.iso.date(),
  terms: z.string().max(5000),
});

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, name: string) {
  const value = readString(formData, name);
  return value === "" ? Number.NaN : Number(value);
}

export async function createQuote(
  orderId: string,
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const parsed = quoteInputSchema.safeParse({
    discountAmount: readNumber(formData, "discountAmount"),
    taxPercent: readNumber(formData, "taxPercent"),
    deliveryCharge: readNumber(formData, "deliveryCharge"),
    validUntil: readString(formData, "validUntil"),
    terms: readString(formData, "terms"),
  });

  if (!parsed.success) {
    return { message: "Enter valid discount, GST, delivery, and validity details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (orderError) {
    return { message: `Unable to load order: ${orderError.message}` };
  }
  if (!order) return { message: "Order not found in this workspace." };

  const { data, error } = await supabase.rpc("save_order_quote", {
    p_order_id: orderId,
    p_discount_amount: parsed.data.discountAmount,
    p_tax_percent: parsed.data.taxPercent,
    p_delivery_charge: parsed.data.deliveryCharge,
    p_valid_until: parsed.data.validUntil,
    p_terms: parsed.data.terms || null,
  });

  if (error) {
    return { message: `Unable to save quote: ${error.message}` };
  }

  if (!data || typeof data !== "object" || !("id" in data)) {
    throw new Error("Supabase returned an invalid quote result.");
  }

  redirect(`/orders/${orderId}?quote=saved`);
}
