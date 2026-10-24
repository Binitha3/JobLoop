import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Create workspace",
};

export default function SignupPage() {
  return (
    <main className="auth-background flex min-h-screen items-center justify-center px-5 py-12">
      <AuthForm mode="signup" setupRequired={!isSupabaseConfigured()} />
    </main>
  );
}
