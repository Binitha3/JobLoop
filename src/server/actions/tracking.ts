"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

export type TrackingActionState = {
  message: string;
  token?: string;
};

export async function regenerateTrackingLink(
  orderId: string,
): Promise<TrackingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { message: "Sign in to regenerate this link." };

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

  const { data: token, error } = await supabase.rpc(
    "regenerate_order_tracking_token",
    { p_order_id: orderId },
  );

  if (error) {
    return { message: `Unable to regenerate tracking link: ${error.message}` };
  }
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error("Supabase returned an invalid tracking token.");
  }

  revalidatePath(`/orders/${orderId}`);
  return { message: "Tracking link regenerated.", token };
}
