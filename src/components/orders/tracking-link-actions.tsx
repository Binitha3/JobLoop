"use client";

import { useState, useTransition } from "react";
import { regenerateTrackingLink } from "@/server/actions/tracking";

export function TrackingLinkActions({
  orderId,
  initialToken,
}: {
  orderId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const trackingLink =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/track/${token}`
      : null;

  async function copyLink() {
    if (!trackingLink) return;
    try {
      await navigator.clipboard.writeText(trackingLink);
      setMessage("Tracking link copied.");
    } catch {
      setMessage("Could not copy the link. Check browser clipboard permissions.");
    }
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateTrackingLink(orderId);
      if (!result.token) {
        setMessage(result.message);
        return;
      }
      setToken(result.token);
      setMessage(result.message);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          className="h-9 rounded border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          disabled={!token}
          onClick={copyLink}
          type="button"
        >
          Copy tracking link
        </button>
        <button
          className="h-9 rounded border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          disabled={pending}
          onClick={regenerate}
          type="button"
        >
          {pending ? "Regenerating…" : "Regenerate link"}
        </button>
      </div>
      {message && (
        <p className="text-sm text-slate-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
