import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CustomerForm } from "@/components/customers/customer-form";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";
import { updateCustomer } from "@/server/actions/customers";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, phone, email, source_channel")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw new Error(`Unable to load customer: ${error.message}`);
  if (!customer) notFound();

  const saveAction = updateCustomer.bind(null, customer.id);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <Link
          className="text-sm underline underline-offset-4"
          href="/customers"
        >
          Customers
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Edit {customer.name}
        </h1>
      </header>
      {query.saved === "1" && (
        <p className="text-sm text-green-800" role="status">
          Customer saved.
        </p>
      )}
      <CustomerForm
        action={saveAction}
        initialValues={customer}
        submitLabel="Save changes"
      />
    </div>
  );
}
