import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingHero } from "@/components/landing/landing-hero";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "JobLoop | Every enquiry becomes a tracked job",
  description:
    "Paste a customer's WhatsApp message, review the order, send a quote and share a tracking link.",
};

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) redirect("/dashboard");
  }

  return <LandingHero />;
}
