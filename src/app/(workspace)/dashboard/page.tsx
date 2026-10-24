import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowUpRight, ClipboardList, PackageCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Unable to load workspace membership: ${membershipError.message}`);
  }

  if (!membership) {
    throw new Error(
      "No workspace is connected to this account. Apply the Supabase migrations and sign in again.",
    );
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", membership.workspace_id)
    .single();

  if (workspaceError) {
    throw new Error(`Unable to load workspace: ${workspaceError.message}`);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-indigo-600">
            {workspace.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Your work, at a glance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            A calmer way to move every print job from the first enquiry to
            delivery.
          </p>
        </div>
        <Button disabled type="button">
          New order
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Button>
      </section>

      <section aria-label="Workspace setup" className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users aria-hidden="true" className="size-5" />
          </div>
          <h2 className="mt-5 text-base font-semibold text-slate-900">
            Keep customer details together
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Save contacts and the way they found your shop, so every new request
            starts with context.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <ClipboardList aria-hidden="true" className="size-5" />
          </div>
          <h2 className="mt-5 text-base font-semibold text-slate-900">
            Quote with confidence
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Build a reusable print catalogue with sizes, materials and finishes
            that match how you price.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.02]">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <PackageCheck aria-hidden="true" className="size-5" />
          </div>
          <h2 className="mt-5 text-base font-semibold text-slate-900">
            See each job through
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Track approvals, production, due dates and payments from one shared
            workspace.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Getting started
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
            Your workspace is ready for its first job.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            JobLoop keeps your team in control. You review every quote and
            customer update before it goes out; AI suggestions will never create
            an order on their own.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Private workspace
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Owner access
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Print-shop ready
          </span>
        </div>
      </section>
    </div>
  );
}
