import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-background flex min-h-screen items-center justify-center px-5 py-12">
      <AuthForm
        mode="login"
        setupRequired={!isSupabaseConfigured() || params.setup === "required"}
      />
    </main>
  );
}
