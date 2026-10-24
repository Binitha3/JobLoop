import type { SupabaseClient } from "@supabase/supabase-js";

export async function getWorkspaceId(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load workspace membership: ${error.message}`);
  }

  if (!data?.workspace_id) {
    throw new Error("No workspace is connected to this account.");
  }

  return data.workspace_id;
}
