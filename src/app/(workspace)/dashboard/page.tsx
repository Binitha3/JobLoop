import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";
import { getOrderStatusLabel, isOrderStatus } from "@/lib/orders/status";

export const metadata: Metadata = { title: "Dashboard" };

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(amount);

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("name, currency, timezone")
    .eq("id", workspaceId)
    .single();

  if (workspaceError) {
    throw new Error(`Unable to load workspace: ${workspaceError.message}`);
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: workspace.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [
    { count: pendingQuotes, error: quoteError },
    { count: dueToday, error: dueError },
    { count: cancelledOrders, error: cancelledError },
    { data: balances, error: balanceError },
    { data: orders, error: ordersError },
  ] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, orders!inner(status)", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["draft", "sent"])
      .neq("orders.status", "cancelled"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("due_date", today)
      .not("status", "in", "(delivered,cancelled)"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "cancelled"),
    supabase
      .from("orders")
      .select("balance_due")
      .eq("workspace_id", workspaceId)
      .gt("balance_due", 0)
      .neq("status", "cancelled"),
    supabase
      .from("orders")
      .select("id, order_number, customer_id, status, due_date, balance_due")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  if (quoteError) throw new Error(`Unable to load pending quotes: ${quoteError.message}`);
  if (dueError) throw new Error(`Unable to load orders due today: ${dueError.message}`);
  if (cancelledError) {
    throw new Error(`Unable to load cancelled orders: ${cancelledError.message}`);
  }
  if (balanceError) throw new Error(`Unable to load outstanding payments: ${balanceError.message}`);
  if (ordersError) throw new Error(`Unable to load orders: ${ordersError.message}`);

  const orderRows = orders ?? [];
  const customerIds = [...new Set(orderRows.map((order) => order.customer_id))];
  const orderIds = orderRows.map((order) => order.id);
  const [{ data: customers, error: customersError }, { data: items, error: itemsError }] =
    await Promise.all([
      customerIds.length
        ? supabase.from("customers").select("id, name").in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase
            .from("order_items")
            .select("order_id, service_id")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (customersError) throw new Error(`Unable to load order customers: ${customersError.message}`);
  if (itemsError) throw new Error(`Unable to load order services: ${itemsError.message}`);

  const serviceIds = [...new Set((items ?? []).map((item) => item.service_id))];
  const { data: services, error: servicesError } = serviceIds.length
    ? await supabase.from("services").select("id, name").in("id", serviceIds)
    : { data: [], error: null };

  if (servicesError) throw new Error(`Unable to load order services: ${servicesError.message}`);

  const customerById = new Map((customers ?? []).map((customer) => [customer.id, customer.name]));
  const serviceById = new Map((services ?? []).map((service) => [service.id, service.name]));
  const servicesByOrder = new Map<string, string[]>();

  for (const item of items ?? []) {
    const serviceName = serviceById.get(item.service_id);
    if (!serviceName) continue;
    const orderServices = servicesByOrder.get(item.order_id) ?? [];
    if (!orderServices.includes(serviceName)) orderServices.push(serviceName);
    servicesByOrder.set(item.order_id, orderServices);
  }

  const outstandingTotal = (balances ?? []).reduce(
    (sum, order) => sum + Number(order.balance_due),
    0,
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm text-slate-600">{workspace.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        {orderRows.length > 0 && (
          <Link
            className="inline-flex h-10 items-center justify-center rounded bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
            href="/orders/new"
          >
            New order
          </Link>
        )}
      </header>

      <section aria-label="Workspace metrics" className="overflow-x-auto border-y border-slate-200">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Pending quotes</th>
              <th className="px-4 py-3 font-medium">Orders due today</th>
              <th className="px-4 py-3 font-medium">Outstanding payments</th>
              <th className="px-4 py-3 font-medium">Cancelled orders</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-xl font-semibold">
              <td className="px-4 py-4">{pendingQuotes ?? 0}</td>
              <td className="px-4 py-4">{dueToday ?? 0}</td>
              <td className="px-4 py-4">{money(outstandingTotal, workspace.currency)}</td>
              <td className="px-4 py-4">{cancelledOrders ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Orders</h2>
        {orderRows.length === 0 ? (
          <div className="border-y border-slate-200 py-6">
            <p className="text-sm text-slate-600">
              No orders yet; create your first order to get started.
            </p>
            <Link
              className="mt-4 inline-flex h-10 items-center justify-center rounded bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
              href="/orders/new"
            >
              New order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto border-y border-slate-200">
            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">Job number</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Service</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Due date</th>
                  <th className="px-3 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((order) => (
                  <tr className="border-b border-slate-100 last:border-0" key={order.id}>
                    <td className="px-3 py-3 font-medium">
                      <Link
                        className="underline underline-offset-4"
                        href={`/orders/${order.id}`}
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {customerById.get(order.customer_id) ?? "Customer"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {servicesByOrder.get(order.id)?.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {isOrderStatus(order.status)
                        ? getOrderStatusLabel(order.status)
                        : order.status}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {order.due_date
                        ? new Date(`${order.due_date}T00:00:00Z`).toLocaleDateString(
                            "en-IN",
                            { timeZone: "UTC" },
                          )
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {money(Number(order.balance_due), workspace.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
