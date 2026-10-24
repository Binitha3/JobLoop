import { createClient } from "@/lib/supabase/server";
import {
  sanitizePublicTrackingData,
  type PublicTrackingData,
} from "@/lib/tracking/public-data";

export { sanitizePublicTrackingData } from "@/lib/tracking/public-data";
export type { PublicTrackingData } from "@/lib/tracking/public-data";

export async function getPublicTrackingData(
  token: string,
): Promise<PublicTrackingData | null> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_order_tracking", {
    p_token: token,
  });

  if (error) {
    throw new Error(`Unable to load public tracking data: ${error.message}`);
  }

  return sanitizePublicTrackingData(data);
}
