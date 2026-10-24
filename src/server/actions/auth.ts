"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  signInSchema,
  signUpSchema,
  type AuthActionState,
} from "@/lib/validators/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function validationState(
  fieldErrors: AuthActionState["fieldErrors"],
): AuthActionState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

export async function signIn(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "Connect Supabase first. Copy .env.example to .env.local and add your project URL and anon key.",
    };
  }

  const parsed = signInSchema.safeParse({
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: "We couldn't sign you in. Check your email and password.",
    };
  }

  redirect("/dashboard");
}

export async function signUp(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message:
        "Connect Supabase first. Copy .env.example to .env.local and add your project URL and anon key.",
    };
  }

  const parsed = signUpSchema.safeParse({
    businessName: readString(formData, "businessName"),
    email: readString(formData, "email"),
    password: readString(formData, "password"),
  });

  if (!parsed.success) {
    return validationState(parsed.error.flatten().fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        workspace_name: parsed.data.businessName,
      },
    },
  });

  if (error) {
    return {
      status: "error",
      message: "We couldn't create your account. Please try again.",
    };
  }

  if (!data.session) {
    return {
      status: "success",
      message: "Account created. Check your email to confirm your address.",
    };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Unable to sign out: ${error.message}`);
  }

  redirect("/login");
}
