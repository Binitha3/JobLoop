import type { Metadata } from "next";
import { getPublicTrackingData } from "@/lib/tracking/data";
import { getOrderStatusLabel } from "@/lib/orders/status";

export const metadata: Metadata = {
  title: "Order tracking | JobLoop",
  robots: { index: false, follow: false },
};

const trackingSteps = [
  "enquiry",
  "quoted",
  "approved",
  "in_progress",
  "ready",
  "delivered",
] as const;

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value);

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    dateStyle: "medium",
  });
}

export default async function PublicTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tracking = await getPublicTrackingData(token);

  if (!tracking) {
    return (
      <main className="min-h-screen bg-white px-5 py-10 text-slate-950">
        <p className="mx-auto w-full max-w-[480px] text-sm">
          This link isn&apos;t valid
        </p>
      </main>
    );
  }

  const dateByStatus = new Map(
    tracking.timeline.map((event) => [event.status, event.date]),
  );
  const currentIndex = trackingSteps.indexOf(
    tracking.status as (typeof trackingSteps)[number],
  );

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-slate-950">
      <article className="mx-auto w-full max-w-[480px] space-y-8">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-medium">{tracking.business_name}</p>
          {tracking.business_phone && (
            <p className="mt-1 text-sm text-slate-600">
              {tracking.business_phone}
            </p>
          )}
          <p className="mt-5 text-xs uppercase tracking-wide text-slate-500">
            Order tracking
          </p>
          <h1 className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {tracking.job_number}
          </h1>
          <p className="mt-3 inline-flex rounded border border-slate-400 px-2 py-1 text-sm">
            {getOrderStatusLabel(tracking.status)}
          </p>
          <p className="mt-4 text-sm">
            Hello {tracking.customer_first_name}
          </p>
        </header>

        {tracking.status === "cancelled" ? (
          <section className="border-y border-slate-200 py-4">
            <h2 className="text-base font-semibold">This order is cancelled</h2>
          </section>
        ) : (
          <section>
            <h2 className="mb-4 text-sm font-semibold">Order progress</h2>
            <ol className="space-y-0">
              {trackingSteps.map((status, index) => {
                const completed = index < currentIndex;
                const current = index === currentIndex;
                const eventDate = dateByStatus.get(status);

                return (
                  <li
                    aria-current={current ? "step" : undefined}
                    className="relative min-h-14 border-l border-slate-300 pl-5"
                    key={status}
                  >
                    <span
                      className={`absolute -left-1 top-1 size-2 rounded ${
                        current || completed ? "bg-slate-900" : "bg-white ring-1 ring-slate-400"
                      }`}
                    />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span
                        className={
                          current
                            ? "text-sm font-semibold"
                            : completed
                              ? "text-sm text-slate-700"
                              : "text-sm text-slate-500"
                        }
                      >
                        {getOrderStatusLabel(status)}
                        {current ? " · Current" : ""}
                      </span>
                      {completed && eventDate && (
                        <time className="text-xs text-slate-500" dateTime={eventDate}>
                          {formatDate(eventDate)}
                        </time>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-semibold">Items</h2>
          <div className="border-y border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 font-medium">Service</th>
                  <th className="py-2 text-right font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {tracking.line_items.map((item, index) => (
                  <tr className="border-b border-slate-100 last:border-0" key={index}>
                    <td className="py-3">{item.service}</td>
                    <td className="py-3 text-right tabular-nums">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2 border-y border-slate-200 py-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Due date</span>
            <span>{formatDate(tracking.due_date)}</span>
          </div>
          {tracking.latest_quote_total !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-600">Latest quote</span>
              <span className="tabular-nums">
                {money(tracking.latest_quote_total)}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Amount paid</span>
            <span className="tabular-nums">{money(tracking.amount_paid)}</span>
          </div>
          <div className="flex justify-between gap-4 font-semibold">
            <span>Balance due</span>
            <span className="tabular-nums">{money(tracking.balance_due)}</span>
          </div>
        </section>
      </article>
    </main>
  );
}
