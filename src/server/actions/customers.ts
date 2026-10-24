"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

export type CustomerActionState = {
  message: string;
};

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

const sourceChannels = ["whatsapp", "instagram", "call", "walk_in"] as const;

function readSourceChannel(formData: FormData) {
  const value = readString(formData, "source_channel");
  return value === "" ? null : sourceChannels.find((channel) => channel === value);
}

function readCustomer(formData: FormData) {
  const name = readString(formData, "name");
  const phone = readString(formData, "phone");
  const email = readString(formData, "email");
  const sourceChannel = readSourceChannel(formData);

  if (name.length < 1 || name.length > 160) {
    return {
      success: false as const,
      error: "Enter a customer name between 1 and 160 characters.",
    };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false as const, error: "Enter a valid email address." };
  }

  if (readString(formData, "source_channel") && !sourceChannel) {
    return { success: false as const, error: "Choose a valid source channel." };
  }

  return {
    success: true as const,
    value: {
      name,
      phone: phone || null,
      email: email || null,
      source_channel: sourceChannel ?? null,
    },
  };
}

export async function createCustomer(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const parsed = readCustomer(formData);
  if (!parsed.success) return { message: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...parsed.value, workspace_id: workspaceId })
    .select("id")
    .single();

  if (error) {
    return { message: `Unable to save customer: ${error.message}` };
  }

  redirect(`/customers/${data.id}/edit?saved=1`);
}

export async function updateCustomer(
  customerId: string,
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const parsed = readCustomer(formData);
  if (!parsed.success) return { message: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data, error } = await supabase
    .from("customers")
    .update(parsed.value)
    .eq("id", customerId)
    .eq("workspace_id", workspaceId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { message: `Unable to update customer: ${error.message}` };
  }

  if (!data) {
    return { message: "Customer not found in this workspace." };
  }

  redirect(`/customers/${data.id}/edit?saved=1`);
}
