"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { signIn, signUp } from "@/server/actions/auth";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/validators/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthFormProps = {
  mode: "login" | "signup";
  setupRequired?: boolean;
};

function FieldError({ children, id }: { children?: string[]; id: string }) {
  if (!children?.length) return null;

  return (
    <p className="mt-1.5 text-xs font-medium text-rose-600" id={id} role="alert">
      {children[0]}
    </p>
  );
}

export function AuthForm({ mode, setupRequired = false }: AuthFormProps) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<
    AuthActionState,
    FormData
  >(action, initialAuthActionState);
  const isSignup = mode === "signup";

  return (
    <div className="w-full max-w-md">
      <Link
        aria-label="JobLoop home"
        className="mb-9 inline-flex items-center gap-3"
        href="/"
      >
        <span className="grid size-11 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
          <span className="text-lg font-bold tracking-tight">J</span>
        </span>
        <span className="text-xl font-bold tracking-tight text-slate-950">
          JobLoop
        </span>
      </Link>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-900/[0.04] sm:p-9">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">
            Your work, in a better loop
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {isSignup ? "Set up your workspace" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {isSignup
              ? "Keep every print enquiry, quote and delivery in one clear place."
              : "Sign in to pick up where your team left off."}
          </p>
        </div>

        {setupRequired && (
          <div
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900"
            role="status"
          >
            Add your Supabase URL and anon key to <code>.env.local</code> to
            enable sign-in.
          </div>
        )}

        {state.message && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-5 ${
              state.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </div>
        )}

        <form action={formAction} className="space-y-5">
          {isSignup && (
            <div>
              <label
                className="mb-2 block text-sm font-medium text-slate-700"
                htmlFor="businessName"
              >
                Business name
              </label>
              <Input
                autoComplete="organization"
                id="businessName"
                name="businessName"
                placeholder="e.g. Paper & Press Studio"
                required
                aria-describedby={
                  state.fieldErrors?.businessName ? "businessName-error" : undefined
                }
                aria-invalid={Boolean(state.fieldErrors?.businessName)}
              />
              <FieldError id="businessName-error">
                {state.fieldErrors?.businessName}
              </FieldError>
            </div>
          )}

          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="email"
            >
              Email address
            </label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                autoComplete="email"
                className="pl-10"
                id="email"
                name="email"
                placeholder="you@yourbusiness.com"
                required
                type="email"
                aria-describedby={
                  state.fieldErrors?.email ? "email-error" : undefined
                }
                aria-invalid={Boolean(state.fieldErrors?.email)}
              />
            </div>
            <FieldError id="email-error">{state.fieldErrors?.email}</FieldError>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="pl-10"
                id="password"
                minLength={isSignup ? 8 : undefined}
                name="password"
                placeholder={isSignup ? "At least 8 characters" : "Your password"}
                required
                type="password"
                aria-describedby={
                  state.fieldErrors?.password ? "password-error" : undefined
                }
                aria-invalid={Boolean(state.fieldErrors?.password)}
              />
            </div>
            <FieldError id="password-error">
              {state.fieldErrors?.password}
            </FieldError>
          </div>

          <Button className="w-full" disabled={pending} type="submit">
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ArrowRight aria-hidden="true" className="size-4" />
            )}
            <span>
              {pending
                ? "Please wait…"
                : isSignup
                  ? "Create your workspace"
                  : "Sign in to JobLoop"}
            </span>
          </Button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-500">
          {isSignup ? "Already using JobLoop?" : "New to JobLoop?"}{" "}
          <Link
            className="font-semibold text-indigo-600 hover:text-indigo-700"
            href={isSignup ? "/login" : "/signup"}
          >
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>

      <p className="mt-6 text-center text-xs leading-5 text-slate-400">
        Built for the people who make things happen.
      </p>
    </div>
  );
}
