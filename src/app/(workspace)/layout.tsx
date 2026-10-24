import Link from "next/link";
import { redirect } from "next/navigation";
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
        <Link className="px-2 text-lg font-bold tracking-tight" href="/dashboard">
          JobLoop
        </Link>

        <div className="mt-8 border-y border-slate-200 px-2 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Workspace
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">
            {user.user_metadata.workspace_name ?? "Your print shop"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
        </div>

        <nav aria-label="Main navigation" className="mt-6 space-y-1">
          <Link
            className="block rounded px-3 py-2.5 text-sm font-medium hover:bg-slate-100"
            href="/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className="block rounded px-3 py-2.5 text-sm font-medium hover:bg-slate-100"
            href="/customers"
          >
            Customers
          </Link>
        </nav>

        <div className="mt-auto border-t border-slate-200 pt-4">
          <form action={signOut}>
            <Button className="w-full justify-start" type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8 lg:justify-end">
          <div className="flex items-center gap-4 lg:hidden">
            <Link className="font-bold tracking-tight" href="/dashboard">
              JobLoop
            </Link>
            <Link className="text-sm font-medium" href="/customers">
              Customers
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user.email}
            </span>
            <form action={signOut} className="lg:hidden">
              <Button size="sm" type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
