"use client";

import { useState } from "react";

export function QuoteActions({
  quoteId,
  quoteNumber,
  total,
  validUntil,
  customerName,
  customerPhone,
  trackingToken,
  currency,
}: {
  quoteId: string;
  quoteNumber: string;
  total: number;
  validUntil: string;
  customerName: string;
  customerPhone: string | null;
  trackingToken: string;
  currency: string;
}) {
  const [message, setMessage] = useState("");

  function composeMessage() {
    const trackingLink = `${window.location.origin}/track/${trackingToken}`;
    const formattedTotal = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(total);
    const validity = new Date(`${validUntil}T00:00:00Z`).toLocaleDateString(
      "en-IN",
      { timeZone: "UTC" },
    );

    return `Hi ${customerName}, quote ${quoteNumber} totals ${formattedTotal} and is valid until ${validity}. Track your order: ${trackingLink}`;
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(composeMessage());
      setMessage("WhatsApp message copied.");
    } catch {
      setMessage("Could not copy the WhatsApp message. Check browser clipboard permissions.");
    }
  }

  const phoneDigits = (customerPhone ?? "").replace(/\D/g, "");
  const whatsappPhone =
    phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;

  function openWhatsApp() {
    const path = whatsappPhone ? `/${whatsappPhone}` : "/";
    const url = `https://wa.me${path}?text=${encodeURIComponent(composeMessage())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        className="inline-flex h-9 items-center rounded border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
        href={`/api/quotes/${quoteId}/pdf`}
      >
        Download PDF
      </a>
      <button
        className="h-9 rounded border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
        onClick={copyMessage}
        type="button"
      >
        Copy WhatsApp message
      </button>
      <button
        className="h-9 rounded border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
        onClick={openWhatsApp}
        type="button"
      >
        Open in WhatsApp
      </button>
      {message && (
        <p className="w-full text-sm text-slate-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
