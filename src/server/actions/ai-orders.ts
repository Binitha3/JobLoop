"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

export type AIOrderActionState = { message: string };

const createOrderPayloadSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(80).nullable(),
  dueDate: z.union([z.iso.date(), z.null()]),
  deliveryAddress: z.string().trim().max(1000).nullable(),
  sourceMessage: z.string().min(1).max(10_000),
  items: z.array(
    z
      .object({
        serviceId: z.string().uuid(),
        quantity: z.number().positive().max(1_000_000),
        unitPrice: z.number().min(0).max(1_000_000_000).nullable(),
        rawText: z.string().trim().max(1000),
        size: z.string().trim().max(300).nullable(),
        material: z.string().trim().max(300).nullable(),
        notes: z.string().trim().max(1000).nullable(),
        printWidth: z.number().positive().max(100_000).nullable().optional(),
        printHeight: z.number().positive().max(100_000).nullable().optional(),
        printUnit: z.enum(["mm", "cm", "in", "ft"]).nullable().optional(),
        bleedMm: z.number().min(0).max(1_000).optional(),
      })
      .superRefine((item, context) => {
        const hasWidth = item.printWidth != null;
        const hasHeight = item.printHeight != null;
        if (hasWidth !== hasHeight || (hasWidth && !item.printUnit)) {
          context.addIssue({
            code: "custom",
            message: "Enter both print dimensions and their unit.",
          });
        }
      }),
  ).min(1).max(50),
});

export async function createOrderFromMessage(
  _previousState: AIOrderActionState,
  formData: FormData,
): Promise<AIOrderActionState> {
  const rawPayload = formData.get("orderPayload");
  if (typeof rawPayload !== "string") {
    return { message: "Review and complete the extracted order details." };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawPayload);
  } catch {
    return { message: "The review details could not be read. Extract the message again." };
  }

  const parsed = createOrderPayloadSchema.safeParse(decoded);
  if (!parsed.success) {
    return {
      message: "Enter a customer name, at least one service, a quantity, and any missing price.",
    };
  }

  if (parsed.data.items.some((item) => item.rawText.length === 0)) {
    return { message: "Each line item needs a short description." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data, error } = await supabase.rpc("create_order_from_message", {
    p_workspace_id: workspaceId,
    p_customer_name: parsed.data.customerName,
    p_phone: parsed.data.phone,
    p_items: parsed.data.items.map((item) => ({
      service_id: item.serviceId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      raw_text: item.rawText,
      size: item.size,
      material: item.material,
      notes: item.notes,
      print_width: item.printWidth ?? null,
      print_height: item.printHeight ?? null,
      print_unit: item.printUnit ?? null,
      bleed_mm: item.bleedMm ?? 3,
    })),
    p_due_date: parsed.data.dueDate,
    p_delivery_address: parsed.data.deliveryAddress,
    p_source_message: parsed.data.sourceMessage,
  });

  if (error) {
    return { message: `Unable to create order: ${error.message}` };
  }
  if (typeof data !== "string") {
    throw new Error("Supabase returned an invalid order result.");
  }

  redirect(`/orders/${data}`);
}
