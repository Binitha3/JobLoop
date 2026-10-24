import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { signOut } from "@/server/actions/auth";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured()) {
    redirect("/login?setup=required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
        <Link className="flex items-center gap-3 px-2" href="/dashboard">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white">
            <span className="font-bold">J</span>
          </span>
          <span className="text-lg font-bold tracking-tight">JobLoop</span>
        </Link>

        <div className="mt-9 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Workspace
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">
            {user.user_metadata.workspace_name ?? "Your print shop"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
        </div>

        <nav aria-label="Main navigation" className="mt-8 space-y-1">
          <Link
            aria-current="page"
            className="flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700"
            href="/dashboard"
          >
            <LayoutDashboard aria-hidden="true" className="size-4" />
            Dashboard
          </Link>
        </nav>

        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="mb-3 px-2 text-xs leading-5 text-slate-500">
            Your orders and customer details stay private to this workspace.
          </p>
          <form action={signOut}>
            <Button className="w-full justify-start" type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8 lg:justify-end">
          <Link className="font-bold tracking-tight lg:hidden" href="/dashboard">
            JobLoop
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user.email}
            </span>
            <form action={signOut} className="lg:hidden">
              <Button size="sm" type="submit" variant="outline">
                Sign out
              </Button>
            </form>
            <span
              aria-label="Account"
              className="grid size-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
            >
              {user.email?.slice(0, 1).toUpperCase() ?? "J"}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
