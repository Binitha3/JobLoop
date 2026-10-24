import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderForm } from "@/components/orders/order-form";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";
import { createOrder } from "@/server/actions/orders";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const [{ data: customers, error: customersError }, { data: services, error: servicesError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name"),
      supabase
        .from("services")
        .select("id, name, unit, base_price")
        .eq("workspace_id", workspaceId)
        .eq("active", true)
        .order("name"),
    ]);

  if (customersError) {
    throw new Error(`Unable to load customers: ${customersError.message}`);
  }
  if (servicesError) {
    throw new Error(`Unable to load services: ${servicesError.message}`);
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <Link
          className="text-sm underline underline-offset-4"
          href="/dashboard"
        >
          Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">New order</h1>
      </header>
      <OrderForm
        action={createOrder}
        customers={customers ?? []}
        services={services ?? []}
      />
    </div>
  );
}
