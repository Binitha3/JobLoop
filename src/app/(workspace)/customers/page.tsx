import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone, email, source_channel, created_at")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (error) throw new Error(`Unable to load customers: ${error.message}`);

  const sourceLabels: Record<string, string> = {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    call: "Call",
    walk_in: "Walk-in",
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Customer contacts for this workspace.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
          href="/customers/new"
        >
          Add customer
        </Link>
      </header>

      {customers?.length ? (
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Source</th>
                <th className="px-3 py-3 font-medium">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  className="border-b border-slate-100 last:border-0"
                  key={customer.id}
                >
                  <td className="px-3 py-3 font-medium">{customer.name}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {customer.phone || "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {customer.email || "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {customer.source_channel
                      ? sourceLabels[customer.source_channel]
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      className="font-medium underline underline-offset-4"
                      href={`/customers/${customer.id}/edit`}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-y border-slate-200 py-6 text-sm text-slate-600">
          No customers yet. Add a customer to keep their contact details here.
        </p>
      )}
    </div>
  );
}
