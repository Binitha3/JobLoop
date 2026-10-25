"use client";

import { useActionState, useState } from "react";
import type { OrderActionState } from "@/server/actions/orders";
import {
  getAllowedOrderStatusTransitions,
  getForwardOrderStatus,
  getOrderStatusActionLabel,
  getOrderStatusLabel,
  requiresOrderStatusConfirmation,
  type OrderStatus,
} from "@/lib/orders/status";

export function OrderStatusForm({
  action,
  currentStatus,
  hasFailedPreflight,
}: {
  action: (state: OrderActionState, formData: FormData) => Promise<OrderActionState>;
  currentStatus: OrderStatus;
  hasFailedPreflight: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  const [confirmationStatus, setConfirmationStatus] =
    useState<OrderStatus | null>(null);
  const allowedTransitions = getAllowedOrderStatusTransitions(currentStatus);
  const forwardStatus = getForwardOrderStatus(currentStatus);
  const secondaryTransitions = allowedTransitions.filter(
    (status) => status !== forwardStatus,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {forwardStatus && (
          hasFailedPreflight && forwardStatus === "in_progress" ? (
            <button
              className="h-10 rounded bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              disabled={pending}
              onClick={() => setConfirmationStatus(forwardStatus)}
              type="button"
            >
              {getOrderStatusActionLabel(forwardStatus)}
            </button>
          ) : (
            <form action={formAction}>
              <button
                className="h-10 rounded bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                disabled={pending}
                name="status"
                type="submit"
                value={forwardStatus}
              >
                {pending
                  ? "Updating…"
                  : getOrderStatusActionLabel(forwardStatus)}
              </button>
            </form>
          )
        )}
        {currentStatus === "delivered" && (
          <p className="text-sm text-slate-600">
            This order is delivered and its status is final.
          </p>
        )}
        {secondaryTransitions.length > 0 && (
          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center rounded border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">
              More
            </summary>
            <div className="absolute left-0 top-full z-10 mt-1 min-w-44 rounded border border-slate-200 bg-white p-1 shadow-lg">
              {secondaryTransitions.map((status) =>
                requiresOrderStatusConfirmation(currentStatus, status) ? (
                  <button
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100"
                    key={status}
                    onClick={() => setConfirmationStatus(status)}
                    type="button"
                  >
                    {status === "cancelled"
                      ? "Cancel order"
                      : `Move to ${getOrderStatusLabel(status).toLowerCase()}`}
                  </button>
                ) : (
                  <form action={formAction} key={status}>
                    <button
                      className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100"
                      disabled={pending}
                      name="status"
                      type="submit"
                      value={status}
                    >
                      {status === "enquiry" && currentStatus === "cancelled"
                        ? "Reopen order"
                        : `Move to ${getOrderStatusLabel(status).toLowerCase()}`}
                    </button>
                  </form>
                ),
              )}
            </div>
          </details>
        )}
      </div>

      {confirmationStatus && (
        <form
          action={formAction}
          className="max-w-md space-y-3 rounded border border-slate-200 bg-white p-4"
        >
          <input
            name="status"
            type="hidden"
            value={confirmationStatus}
          />
          <p className="text-sm font-medium">
            {hasFailedPreflight && confirmationStatus === "in_progress"
              ? "Artwork preflight has failed. Confirm that you want to override the warning and start production?"
              : "Confirm moving this order to "}
            {!(hasFailedPreflight && confirmationStatus === "in_progress") && (
              <>
            {getOrderStatusLabel(confirmationStatus).toLowerCase()}?
              </>
            )}
          </p>
          <label
            className="block text-sm font-medium"
            htmlFor="status-change-reason"
          >
            Reason{" "}
            <span className="font-normal text-slate-500">
              {hasFailedPreflight && confirmationStatus === "in_progress"
                ? "(required)"
                : "(optional)"}
            </span>
          </label>
          <textarea
            className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            id="status-change-reason"
            maxLength={500}
            name="reason"
            required={
              hasFailedPreflight && confirmationStatus === "in_progress"
            }
          />
          <div className="flex gap-2">
            <button
              className="h-9 rounded bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Updating…" : "Confirm"}
            </button>
            <button
              className="h-9 rounded border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
              onClick={() => setConfirmationStatus(null)}
              type="button"
            >
              Keep current status
            </button>
          </div>
        </form>
      )}
      {state.message && (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
