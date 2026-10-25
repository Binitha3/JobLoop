import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatusForm } from "@/components/orders/order-status-form";
import { ArtworkManager } from "@/components/orders/artwork-manager";
import { QuoteForm } from "@/components/quotes/quote-form";
import { QuoteActions } from "@/components/quotes/quote-actions";
import { TrackingLinkActions } from "@/components/orders/tracking-link-actions";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";
import { changeOrderStatus } from "@/server/actions/orders";
import { isOrderStatus, getOrderStatusLabel } from "@/lib/orders/status";
import { createQuote } from "@/server/actions/quotes";
import type {
  PreflightCheck,
  PreflightStatus,
} from "@/lib/preflight/engine";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, workspace_id, customer_id, order_number, status, due_date, internal_notes, currency, subtotal, total_amount, balance_due, created_at",
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (orderError) throw new Error(`Unable to load order: ${orderError.message}`);
  if (!order) notFound();
  if (!isOrderStatus(order.status)) {
    throw new Error(`Order has an unknown status: ${order.status}`);
  }

  const [
    { data: customer, error: customerError },
    { data: items, error: itemsError },
    { data: events, error: eventsError },
    { data: workspace, error: workspaceError },
    { data: quotes, error: quotesError },
    { data: trackingToken, error: trackingTokenError },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("name, phone, email")
      .eq("id", order.customer_id)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .from("order_items")
      .select("id, service_id, quantity, unit_price, line_total, description, print_width, print_height, print_unit, bleed_mm")
      .eq("order_id", order.id)
      .eq("workspace_id", workspaceId)
      .order("created_at"),
    supabase
      .from("order_events")
      .select(
        "event_type, previous_status, new_status, from_status, to_status, reason, actor_id, description, created_at",
      )
      .eq("order_id", order.id)
      .eq("workspace_id", workspaceId)
      .order("created_at"),
    supabase
      .from("workspaces")
      .select("currency")
      .eq("id", workspaceId)
      .single(),
    supabase
      .from("quotes")
      .select(
        "id, version, quote_number, subtotal, discount_amount, tax_percent, tax_amount, delivery_charge, total, valid_until, terms, created_at",
      )
      .eq("order_id", order.id)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("tracking_tokens")
      .select("token")
      .eq("order_id", order.id)
      .eq("workspace_id", workspaceId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (customerError) throw new Error(`Unable to load customer: ${customerError.message}`);
  if (itemsError) throw new Error(`Unable to load order items: ${itemsError.message}`);
  if (eventsError) throw new Error(`Unable to load order history: ${eventsError.message}`);
  if (workspaceError) throw new Error(`Unable to load workspace: ${workspaceError.message}`);
  if (quotesError) throw new Error(`Unable to load quotes: ${quotesError.message}`);
  if (trackingTokenError) {
    throw new Error(`Unable to load tracking link: ${trackingTokenError.message}`);
  }

  const serviceIds = [...new Set((items ?? []).map((item) => item.service_id))];
  const { data: services, error: servicesError } = serviceIds.length
    ? await supabase
        .from("services")
        .select("id, name, unit")
        .eq("workspace_id", workspaceId)
        .in("id", serviceIds)
    : { data: [], error: null };

  if (servicesError) throw new Error(`Unable to load services: ${servicesError.message}`);

  const itemIds = (items ?? []).map((item) => item.id);
  const { data: artworkRows, error: artworkError } = itemIds.length
    ? await supabase
        .from("artwork_files")
        .select(
          "id, order_item_id, storage_path, original_name, mime, size_bytes, width_px, height_px, created_at",
        )
        .eq("workspace_id", workspaceId)
        .in("order_item_id", itemIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (artworkError) {
    throw new Error(`Unable to load artwork files: ${artworkError.message}`);
  }

  const artworkIds = (artworkRows ?? []).map((file) => file.id);
  const { data: reportRows, error: reportsError } = artworkIds.length
    ? await supabase
        .from("preflight_reports")
        .select("id, artwork_file_id, results, overall, ai_notes, created_at")
        .in("artwork_file_id", artworkIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (reportsError) {
    throw new Error(`Unable to load preflight reports: ${reportsError.message}`);
  }

  const reportByFile = new Map<string, (typeof reportRows)[number]>();
  for (const report of reportRows ?? []) {
    if (!reportByFile.has(report.artwork_file_id)) {
      reportByFile.set(report.artwork_file_id, report);
    }
  }

  const artworkByItem = new Map<
    string,
    Array<{
      id: string;
      originalName: string;
      mime: string;
      sizeBytes: number;
      widthPx: number;
      heightPx: number;
      createdAt: string;
      thumbnailUrl: string;
      overall: PreflightStatus;
      checks: PreflightCheck[];
      aiNotes: string[];
    }>
  >();
  for (const file of artworkRows ?? []) {
    const report = reportByFile.get(file.id);
    if (!report) {
      throw new Error(`Artwork file ${file.id} has no preflight report.`);
    }
    const { data: signed, error: signedUrlError } = await supabase.storage
      .from("artwork")
      .createSignedUrl(file.storage_path, 60 * 60);
    if (signedUrlError) {
      throw new Error(`Unable to create artwork thumbnail URL: ${signedUrlError.message}`);
    }
    const overall = report.overall;
    if (overall !== "pass" && overall !== "warn" && overall !== "fail") {
      throw new Error(`Artwork file ${file.id} has an unknown preflight status.`);
    }
    const fileView = {
      id: file.id,
      originalName: file.original_name,
      mime: file.mime,
      sizeBytes: Number(file.size_bytes),
      widthPx: file.width_px,
      heightPx: file.height_px,
      createdAt: file.created_at,
      thumbnailUrl: signed.signedUrl,
      overall,
      checks: Array.isArray(report.results)
        ? (report.results as PreflightCheck[])
        : [],
      aiNotes: Array.isArray(report.ai_notes)
        ? report.ai_notes.filter(
            (note): note is string => typeof note === "string",
          )
        : [],
    };
    const existing = artworkByItem.get(file.order_item_id) ?? [];
    existing.push(fileView);
    artworkByItem.set(file.order_item_id, existing);
  }

  const hasFailedPreflight = (reportRows ?? []).some(
    (report) => report.overall === "fail",
  );
  const displayItems = [...(items ?? [])].sort((left, right) => {
    const leftFails = artworkByItem
      .get(left.id)
      ?.some((file) => file.overall === "fail");
    const rightFails = artworkByItem
      .get(right.id)
      ?.some((file) => file.overall === "fail");
    return Number(Boolean(rightFails)) - Number(Boolean(leftFails));
  });

  const serviceById = new Map((services ?? []).map((service) => [service.id, service]));
  const money = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: workspace.currency,
    }).format(amount);
  const updateAction = changeOrderStatus.bind(null, order.id);
  const createQuoteAction = createQuote.bind(null, order.id);
  const latestQuote = quotes?.[0] ?? null;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);
  const defaultValidUntil = [
    validUntil.getFullYear(),
    String(validUntil.getMonth() + 1).padStart(2, "0"),
    String(validUntil.getDate()).padStart(2, "0"),
  ].join("-");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            className="text-sm underline underline-offset-4"
            href="/dashboard"
          >
            Dashboard
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {order.order_number}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {customer.name} · {getOrderStatusLabel(order.status)}
          </p>
        </div>
      </header>

      <section className="grid gap-x-10 gap-y-5 border-b border-slate-200 pb-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Customer
          </h2>
          <p className="mt-1 text-sm font-medium">{customer.name}</p>
          <p className="mt-1 text-sm text-slate-600">
            {customer.phone || customer.email || "No contact details"}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Due date
          </h2>
          <p className="mt-1 text-sm">
            {order.due_date
              ? new Date(`${order.due_date}T00:00:00Z`).toLocaleDateString(
                  "en-IN",
                  { timeZone: "UTC" },
                )
              : "Not set"}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Balance due
          </h2>
          <p className="mt-1 text-sm font-semibold">
            {money(Number(order.balance_due))}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Line items</h2>
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-medium">Service</th>
                <th className="px-3 py-3 font-medium">Quantity</th>
                <th className="px-3 py-3 font-medium">Unit price</th>
                <th className="px-3 py-3 font-medium">Print size / bleed</th>
                <th className="px-3 py-3 text-right font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      {item.description ||
                        serviceById.get(item.service_id)?.name ||
                        "Service"}
                    </td>
                    <td className="px-3 py-3">{Number(item.quantity)}</td>
                    <td className="px-3 py-3">{money(Number(item.unit_price))}</td>
                    <td className="px-3 py-3">
                      {item.print_width !== null && item.print_height !== null
                        ? `${Number(item.print_width)} × ${Number(item.print_height)} ${item.print_unit}`
                        : "Not set"}
                      <span className="block text-xs text-slate-500">
                        {Number(item.bleed_mm)} mm bleed
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {money(Number(item.line_total))}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-3 pb-4" colSpan={5}>
                      <ArtworkManager
                        files={artworkByItem.get(item.id) ?? []}
                        orderItemId={item.id}
                      />
                    </td>
                  </tr>
                </Fragment>
              ))}
              <tr>
                <th className="px-3 py-3 text-left font-semibold" colSpan={4}>
                  Total
                </th>
                <td className="px-3 py-3 text-right font-semibold">
                  {money(Number(order.total_amount))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-5 border-y border-slate-200 py-5">
        <div>
          <h2 className="text-base font-semibold">Quote</h2>
          <p className="mt-1 text-sm text-slate-600">
            Each saved quote is a revision; the newest quote is active.
          </p>
        </div>
        <QuoteForm
          action={createQuoteAction}
          currency={workspace.currency}
          defaultValidUntil={defaultValidUntil}
          lineTotals={(items ?? []).map((item) => Number(item.line_total))}
        />
        {latestQuote && (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold">
              Latest quote: {latestQuote.quote_number}
            </h3>
            <p className="text-sm tabular-nums">
              Total: {money(Number(latestQuote.total))}
              {latestQuote.valid_until
                ? ` · Valid until ${new Date(
                    `${latestQuote.valid_until}T00:00:00Z`,
                  ).toLocaleDateString("en-IN", { timeZone: "UTC" })}`
                : ""}
            </p>
            {trackingToken?.token && (
              <QuoteActions
                customerName={customer.name}
                customerPhone={customer.phone}
                quoteId={latestQuote.id}
                quoteNumber={latestQuote.quote_number}
                total={Number(latestQuote.total)}
                trackingToken={trackingToken.token}
                validUntil={latestQuote.valid_until ?? ""}
                currency={workspace.currency}
              />
            )}
          </div>
        )}
        {quotes && quotes.length > 1 && (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-sm font-semibold">Earlier revisions</h3>
            <ul className="space-y-2 text-sm">
              {quotes.slice(1).map((quote) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3"
                  key={quote.id}
                >
                  <span>
                    {quote.quote_number} · {money(Number(quote.total))}
                  </span>
                  <a
                    className="underline underline-offset-4"
                    href={`/api/quotes/${quote.id}/pdf`}
                  >
                    Download PDF
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3 border-y border-slate-200 py-5">
        <h2 className="text-base font-semibold">Public tracking link</h2>
        <TrackingLinkActions
          initialToken={trackingToken?.token ?? null}
          orderId={order.id}
        />
      </section>

      {order.internal_notes && (
        <section>
          <h2 className="text-base font-semibold">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {order.internal_notes}
          </p>
        </section>
      )}

      <section className="space-y-4 border-y border-slate-200 py-5">
        <h2 className="text-base font-semibold">Update status</h2>
        <OrderStatusForm
          action={updateAction}
          currentStatus={order.status}
          hasFailedPreflight={hasFailedPreflight}
        />
      </section>

      <section>
        <h2 className="mb-4 text-base font-semibold">Status history</h2>
        {events?.length ? (
          <ol className="space-y-4 border-l border-slate-300 pl-5">
            {events.map((event, index) => (
              <li className="relative" key={`${event.created_at}-${index}`}>
                <span className="absolute -left-[25px] top-1.5 size-2 rounded bg-slate-700" />
                <p className="text-sm font-medium">{event.description}</p>
                {(event.from_status || event.to_status) && (
                  <p className="mt-1 text-sm text-slate-600">
                    {event.from_status && isOrderStatus(event.from_status)
                      ? getOrderStatusLabel(event.from_status)
                      : "Created"}
                    {" → "}
                    {event.to_status && isOrderStatus(event.to_status)
                      ? getOrderStatusLabel(event.to_status)
                      : event.new_status && isOrderStatus(event.new_status)
                        ? getOrderStatusLabel(event.new_status)
                        : ""}
                  </p>
                )}
                {event.reason && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    Reason: {event.reason}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {event.actor_id === user.id ? "You" : "Workspace member"}
                </p>
                <time
                  className="mt-1 block text-xs text-slate-500"
                  dateTime={event.created_at}
                >
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-600">No status history yet.</p>
        )}
      </section>
    </div>
  );
}
