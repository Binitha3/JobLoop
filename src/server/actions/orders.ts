"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  isValidOrderStatusTransition,
  ORDER_STATUSES,
} from "@/lib/orders/status";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

export type OrderActionState = { message: string };

const orderItemSchema = z
  .object({
    service_id: z.string().uuid(),
    quantity: z.number().positive().max(1_000_000),
    unit_price: z.number().min(0).max(1_000_000_000),
    print_width: z.number().positive().max(100_000).nullable().optional(),
    print_height: z.number().positive().max(100_000).nullable().optional(),
    print_unit: z.enum(["mm", "cm", "in", "ft"]).nullable().optional(),
    bleed_mm: z.number().min(0).max(1_000).optional(),
  })
  .superRefine((item, context) => {
    const hasWidth = item.print_width != null;
    const hasHeight = item.print_height != null;
    if (hasWidth !== hasHeight || (hasWidth && !item.print_unit)) {
      context.addIssue({
        code: "custom",
        message: "Enter both print dimensions and their unit.",
      });
    }
  });

const newCustomerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(80),
  email: z.union([
    z.literal(""),
    z.string().trim().email().max(254),
  ]),
  source_channel: z.enum(["", "whatsapp", "instagram", "call", "walk_in"]),
});

const statusSchema = z.enum(ORDER_STATUSES);

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createOrder(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const customerId = readString(formData, "customerId");
  const customerName = readString(formData, "newCustomerName");
  const newCustomer = customerName
    ? newCustomerSchema.safeParse({
        name: customerName,
        phone: readString(formData, "newCustomerPhone"),
        email: readString(formData, "newCustomerEmail"),
        source_channel: readString(formData, "newCustomerSource"),
      })
    : null;

  if (newCustomer && !newCustomer.success) {
    return { message: "Enter valid details for the new customer." };
  }

  if (!newCustomer && !z.string().uuid().safeParse(customerId).success) {
    return { message: "Choose a customer or enter details for a new customer." };
  }

  let itemValues: unknown;
  try {
    itemValues = JSON.parse(readString(formData, "items"));
  } catch {
    return { message: "Add at least one valid order item." };
  }

  const parsedItems = z.array(orderItemSchema).min(1).max(50).safeParse(itemValues);
  if (!parsedItems.success) {
    return { message: "Add at least one valid service, quantity, and price." };
  }

  const dueDate = readString(formData, "dueDate");
  const parsedDueDate = dueDate
    ? z.iso.date().safeParse(dueDate)
    : { success: true as const, data: null };
  if (!parsedDueDate.success) {
    return { message: "Enter a valid due date." };
  }

  const notes = readString(formData, "notes");
  if (notes.length > 5000) {
    return { message: "Notes must be 5,000 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data, error } = await supabase.rpc("create_order_with_items", {
    p_workspace_id: workspaceId,
    p_customer_id: newCustomer ? null : customerId,
    p_new_customer: newCustomer
      ? {
          ...newCustomer.data,
          email: newCustomer.data.email || null,
          source_channel: newCustomer.data.source_channel || null,
        }
      : null,
    p_due_date: parsedDueDate.data,
    p_notes: notes || null,
    p_items: parsedItems.data,
  });

  if (error) {
    return { message: `Unable to create order: ${error.message}` };
  }

  redirect(`/orders/${data}`);
}

export async function changeOrderStatus(
  orderId: string,
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const parsedStatus = statusSchema.safeParse(readString(formData, "status"));
  if (!parsedStatus.success) {
    return { message: "Choose a valid order status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (orderError) {
    return { message: `Unable to load order status: ${orderError.message}` };
  }
  if (!order) {
    return { message: "Order not found in this workspace." };
  }

  const currentStatus = statusSchema.safeParse(order.status);
  if (
    !currentStatus.success ||
    !isValidOrderStatusTransition(currentStatus.data, parsedStatus.data)
  ) {
    return {
      message: "That status change is not allowed for this order.",
    };
  }

  const reason = readString(formData, "reason");
  if (reason.length > 500) {
    return { message: "The reason must be 500 characters or fewer." };
  }

  const { error } = await supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_new_status: parsedStatus.data,
    p_reason: reason || null,
  });

  if (error) {
    return { message: `Unable to update order status: ${error.message}` };
  }

  redirect(`/orders/${orderId}`);
}
