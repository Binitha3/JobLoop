import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageOrderReview } from "@/components/orders/message-order-review";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";
import { createOrderFromMessage } from "@/server/actions/ai-orders";

export const metadata: Metadata = { title: "Create order from message" };

export default async function OrderFromMessagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const [
    { data: customers, error: customersError },
    { data: services, error: servicesError },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone")
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
        <Link className="text-sm underline underline-offset-4" href="/dashboard">
          Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Create order from message
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Paste a customer message, review every extracted detail, and confirm before an order is created.
        </p>
      </header>
      <MessageOrderReview
        createOrder={createOrderFromMessage}
        customers={customers ?? []}
        services={(services ?? []).map((service) => ({
          ...service,
          base_price:
            service.base_price === null ? null : Number(service.base_price),
        }))}
      />
    </div>
  );
}
