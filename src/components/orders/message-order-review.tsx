"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  findDuplicateCustomer,
  normalizePhone,
} from "@/lib/ai/customers";
import {
  extractOrderSchema,
  type ExtractOrder,
} from "@/lib/ai/extractOrder";
import type { AIOrderActionState } from "@/server/actions/ai-orders";

type ServiceOption = {
  id: string;
  name: string;
  unit: string;
  base_price: number | null;
};

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

type LinePrintSize = {
  width: string;
  height: string;
  unit: "mm" | "cm" | "in" | "ft";
  bleedMm: string;
};

const emptyPrintSize: LinePrintSize = {
  width: "",
  height: "",
  unit: "mm",
  bleedMm: "3",
};

const emptyActionState: AIOrderActionState = { message: "" };

function CheckThis({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-2 inline-flex border border-amber-700 px-2 py-0.5 text-xs font-medium text-amber-900">
      Check this
    </span>
  );
}

export function MessageOrderReview({
  services,
  customers,
  createOrder,
}: {
  services: ServiceOption[];
  customers: CustomerOption[];
  createOrder: (
    state: AIOrderActionState,
    formData: FormData,
  ) => Promise<AIOrderActionState>;
}) {
  const [message, setMessage] = useState("");
  const [extracted, setExtracted] = useState<ExtractOrder | null>(null);
  const [prices, setPrices] = useState<string[]>([]);
  const [printSizes, setPrintSizes] = useState<LinePrintSize[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractErrorRetryable, setExtractErrorRetryable] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [state, formAction, creating] = useActionState(
    createOrder,
    emptyActionState,
  );

  const duplicate = findDuplicateCustomer(
    extracted?.phone.value,
    customers,
  );
  const knownCustomer = normalizePhone(extracted?.phone.value)
    ? duplicate
    : null;

  async function extractDetails() {
    setExtractError("");
    setExtractErrorRetryable(false);
    setCopyMessage("");
    setExtracted(null);
    setPrices([]);
    setPrintSizes([]);

    if (!message.trim()) {
      setExtractError("Paste the customer's message first.");
      return;
    }

    setExtracting(true);
    try {
      const response = await fetch("/api/orders/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const errorMessage = typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to extract order details. Please try again.";
        setExtractError(errorMessage);
        setExtractErrorRetryable(
          typeof result === "object" &&
          result !== null &&
          "retryable" in result &&
          result.retryable === true,
        );
        return;
      }

      const parsed = extractOrderSchema.safeParse(result);
      if (!parsed.success) {
        setExtractError("The AI returned invalid details. Your pasted message is still here.");
        return;
      }

      setExtracted(parsed.data);
      setPrices(
        parsed.data.items.value.map((item) => {
          const service = services.find(
            (option) => option.id === item.service_id.value,
          );
          return service?.base_price == null ? "" : String(service.base_price);
        }),
      );
      setPrintSizes(parsed.data.items.value.map(() => ({ ...emptyPrintSize })));
    } catch {
      setExtractError("Unable to reach the extraction service. Your pasted message is still here.");
      setExtractErrorRetryable(true);
    } finally {
      setExtracting(false);
    }
  }

  function updateExtracted(update: (current: ExtractOrder) => ExtractOrder) {
    setExtracted((current) => current ? update(current) : current);
  }

  function updateTextField(
    field: "customer_name" | "phone" | "deadline" | "delivery_address",
    value: string,
  ) {
    updateExtracted((current) => {
      const nullableValue = value.trim() ? value : null;
      const missingName = field;
      return {
        ...current,
        [field]: {
          ...current[field],
          value: nullableValue,
          confidence: nullableValue ? "high" : current[field].confidence,
        },
        missing_fields: nullableValue
          ? current.missing_fields.filter((missing) => missing !== missingName)
          : current.missing_fields,
      };
    });
  }

  function updateItem(
    index: number,
    field: "service_id" | "raw_text" | "quantity" | "size" | "material" | "notes",
    value: string,
  ) {
    updateExtracted((current) => {
      const items = current.items.value.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === "service_id") {
          return {
            ...item,
            service_id: {
              ...item.service_id,
              value: value || null,
              confidence: value ? "high" : item.service_id.confidence,
            },
          };
        }
        if (field === "quantity") {
          return {
            ...item,
            quantity: {
              ...item.quantity,
              value: value ? Number(value) : null,
              confidence: value ? "high" : item.quantity.confidence,
            },
          };
        }
        const nextValue = value.trim() ? value : null;
        return {
          ...item,
          [field]: {
            ...item[field],
            value: nextValue,
            confidence: nextValue ? "high" : item[field].confidence,
          },
        };
      });
      return { ...current, items: { ...current.items, value: items } };
    });
  }

  function addItem() {
    if (!extracted) return;
    updateExtracted((current) => ({
      ...current,
      items: {
        ...current.items,
        value: [
          ...current.items.value,
          {
            service_id: { value: null, confidence: "low" },
            raw_text: { value: "", confidence: "low" },
            quantity: { value: null, confidence: "low" },
            size: { value: null, confidence: "low" },
            material: { value: null, confidence: "low" },
            notes: { value: null, confidence: "low" },
          },
        ],
      },
      missing_fields: [
        ...current.missing_fields,
        `items[${current.items.value.length}].service_id`,
        `items[${current.items.value.length}].quantity`,
      ],
    }));
    setPrices((current) => [...current, ""]);
    setPrintSizes((current) => [...current, { ...emptyPrintSize }]);
  }

  function removeItem(index: number) {
    if (!extracted) return;
    updateExtracted((current) => ({
      ...current,
      items: {
        ...current.items,
        value: current.items.value.filter((_, itemIndex) => itemIndex !== index),
      },
    }));
    setPrices((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setPrintSizes((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function updatePrintSize(index: number, patch: Partial<LinePrintSize>) {
    setPrintSizes((current) =>
      current.map((size, sizeIndex) =>
        sizeIndex === index ? { ...size, ...patch } : size,
      ),
    );
  }

  async function copySuggestedReply() {
    if (!extracted) return;
    const text = extracted.clarifying_questions.join(" ");
    if (!text) {
      setCopyMessage("There are no suggested questions to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Suggested reply copied.");
    } catch {
      setCopyMessage("Unable to copy. Select and copy the suggested reply manually.");
    }
  }

  const questionMessage = extracted?.clarifying_questions.join(" ") ?? "";
  const missing = (
    confidence: string,
    value: string | number | null,
  ) => confidence === "low" || value === null || value === "";
  const usableItems =
    extracted?.items.value.filter(
      (item) =>
        item.service_id.value &&
        item.quantity.value &&
        item.quantity.value > 0 &&
        item.raw_text.value.trim(),
    ) ?? [];
  const canCreate =
    !!extracted &&
    !!extracted.customer_name.value?.trim() &&
    usableItems.length > 0 &&
    usableItems.length === extracted.items.value.length &&
    extracted.items.value.every((item, index) => {
      const service = services.find(
        (option) => option.id === item.service_id.value,
      );
      return !!service && (
        service.base_price !== null ||
        (!!prices[index] &&
          Number.isFinite(Number(prices[index])) &&
          Number(prices[index]) >= 0)
      );
    });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="customer-message">
          Paste the customer&apos;s message
        </label>
        <textarea
          className="min-h-48 w-full rounded border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          id="customer-message"
          maxLength={10_000}
          onChange={(event) => {
            setMessage(event.target.value);
            if (extracted) {
              setExtracted(null);
              setPrices([]);
              setPrintSizes([]);
              setExtractError("Message changed. Extract the updated message before creating an order.");
              setExtractErrorRetryable(false);
            }
          }}
          placeholder="Paste a WhatsApp message, email, or customer note..."
          value={message}
        />
        {extractError && (
          <p className="text-sm text-red-700" role="alert">
            {extractError}
          </p>
        )}
        <Button disabled={extracting} onClick={extractDetails} type="button">
          {extracting
            ? "Extracting details…"
            : extractErrorRetryable
              ? "Try again"
              : "Extract details"}
        </Button>
      </section>

      {extracted && (
        <div className="grid gap-8 border-t border-slate-200 pt-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 text-base font-semibold">Original message</h2>
            <blockquote className="whitespace-pre-wrap border-l-2 border-slate-300 pl-4 text-sm leading-6 text-slate-700">
              {message}
            </blockquote>
          </section>

          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="text-base font-semibold">Review extracted details</h2>
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="review-name">
                  Customer name
                  <CheckThis show={missing(extracted.customer_name.confidence, extracted.customer_name.value)} />
                </label>
                <Input
                  className={missing(extracted.customer_name.confidence, extracted.customer_name.value) ? "border-amber-700 bg-amber-50" : ""}
                  id="review-name"
                  onChange={(event) => updateTextField("customer_name", event.target.value)}
                  value={extracted.customer_name.value ?? ""}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="review-phone">
                  Phone
                  <CheckThis show={missing(extracted.phone.confidence, extracted.phone.value)} />
                </label>
                <Input
                  className={missing(extracted.phone.confidence, extracted.phone.value) ? "border-amber-700 bg-amber-50" : ""}
                  id="review-phone"
                  onChange={(event) => updateTextField("phone", event.target.value)}
                  type="tel"
                  value={extracted.phone.value ?? ""}
                />
              </div>
              {knownCustomer && (
                <p className="border-y border-slate-200 py-2 text-sm">
                  Existing customer:{" "}
                  <Link className="font-medium underline underline-offset-4" href={`/customers/${knownCustomer.id}/edit`}>
                    {knownCustomer.name}
                  </Link>
                </p>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="review-deadline">
                  Deadline
                  <CheckThis show={missing(extracted.deadline.confidence, extracted.deadline.value)} />
                </label>
                <Input
                  className={missing(extracted.deadline.confidence, extracted.deadline.value) ? "border-amber-700 bg-amber-50" : ""}
                  id="review-deadline"
                  onChange={(event) => updateTextField("deadline", event.target.value)}
                  type="date"
                  value={extracted.deadline.value ?? ""}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="review-address">
                  Delivery address
                  <CheckThis show={missing(extracted.delivery_address.confidence, extracted.delivery_address.value)} />
                </label>
                <Input
                  className={missing(extracted.delivery_address.confidence, extracted.delivery_address.value) ? "border-amber-700 bg-amber-50" : ""}
                  id="review-address"
                  onChange={(event) => updateTextField("delivery_address", event.target.value)}
                  value={extracted.delivery_address.value ?? ""}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Line items</h2>
                <button
                  className="text-sm font-medium underline underline-offset-4"
                  onClick={addItem}
                  type="button"
                >
                  Add item
                </button>
              </div>
              {extracted.items.value.length === 0 && (
                <p className="border-y border-amber-300 py-3 text-sm text-amber-900">
                  No items were identified. Add and review the order items before creating an order.
                </p>
              )}
              {extracted.items.value.map((item, index) => {
                const service = services.find(
                  (option) => option.id === item.service_id.value,
                );
                const serviceMissing =
                  !item.service_id.value ||
                  missing(item.service_id.confidence, item.service_id.value);
                const quantityMissing =
                  item.quantity.value === null ||
                  missing(item.quantity.confidence, item.quantity.value);
                const printSize = printSizes[index] ?? emptyPrintSize;
                return (
                  <div className="space-y-3 border-b border-slate-200 pb-4" key={index}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold">Item {index + 1}</h3>
                      <button
                        className="text-sm underline underline-offset-4"
                        onClick={() => removeItem(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-service-${index}`}>
                        Service
                        <CheckThis show={serviceMissing} />
                      </label>
                      <select
                        className={`h-11 w-full rounded border bg-white px-3 text-sm outline-none focus:border-slate-900 ${serviceMissing ? "border-amber-700 bg-amber-50" : "border-slate-300"}`}
                        id={`item-service-${index}`}
                        onChange={(event) => {
                          const nextService = services.find(
                            (option) => option.id === event.target.value,
                          );
                          updateItem(index, "service_id", event.target.value);
                          setPrices((current) =>
                            current.map((price, priceIndex) =>
                              priceIndex === index
                                ? nextService?.base_price == null
                                  ? ""
                                  : String(nextService.base_price)
                                : price,
                            ),
                          );
                        }}
                        value={item.service_id.value ?? ""}
                      >
                        <option value="">Select a service</option>
                        {services.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} ({option.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-raw-${index}`}>
                          Item description
                          <CheckThis show={missing(item.raw_text.confidence, item.raw_text.value)} />
                        </label>
                        <Input
                          className={missing(item.raw_text.confidence, item.raw_text.value) ? "border-amber-700 bg-amber-50" : ""}
                          id={`item-raw-${index}`}
                          onChange={(event) => updateItem(index, "raw_text", event.target.value)}
                          value={item.raw_text.value}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-quantity-${index}`}>
                          Quantity
                          <CheckThis show={quantityMissing} />
                        </label>
                        <Input
                          className={quantityMissing ? "border-amber-700 bg-amber-50" : ""}
                          id={`item-quantity-${index}`}
                          min="0.01"
                          onChange={(event) => updateItem(index, "quantity", event.target.value)}
                          step="0.01"
                          type="number"
                          value={item.quantity.value ?? ""}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-size-${index}`}>
                          Size
                          <CheckThis show={missing(item.size.confidence, item.size.value)} />
                        </label>
                        <Input
                          className={missing(item.size.confidence, item.size.value) ? "border-amber-700 bg-amber-50" : ""}
                          id={`item-size-${index}`}
                          onChange={(event) => updateItem(index, "size", event.target.value)}
                          value={item.size.value ?? ""}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-material-${index}`}>
                          Material
                          <CheckThis show={missing(item.material.confidence, item.material.value)} />
                        </label>
                        <Input
                          className={missing(item.material.confidence, item.material.value) ? "border-amber-700 bg-amber-50" : ""}
                          id={`item-material-${index}`}
                          onChange={(event) => updateItem(index, "material", event.target.value)}
                          value={item.material.value ?? ""}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-print-width-${index}`}>
                          Print width (optional)
                        </label>
                        <Input
                          id={`item-print-width-${index}`}
                          min="0.01"
                          onChange={(event) =>
                            updatePrintSize(index, { width: event.target.value })
                          }
                          step="any"
                          type="number"
                          value={printSize.width}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-print-height-${index}`}>
                          Print height (optional)
                        </label>
                        <Input
                          id={`item-print-height-${index}`}
                          min="0.01"
                          onChange={(event) =>
                            updatePrintSize(index, { height: event.target.value })
                          }
                          step="any"
                          type="number"
                          value={printSize.height}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-print-unit-${index}`}>
                          Size unit
                        </label>
                        <select
                          className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
                          id={`item-print-unit-${index}`}
                          onChange={(event) => {
                            const unit = (["mm", "cm", "in", "ft"] as const).find(
                              (candidate) => candidate === event.target.value,
                            );
                            if (unit) updatePrintSize(index, { unit });
                          }}
                          value={printSize.unit}
                        >
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="in">in</option>
                          <option value="ft">ft</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-bleed-${index}`}>
                          Bleed (mm)
                        </label>
                        <Input
                          id={`item-bleed-${index}`}
                          min="0"
                          onChange={(event) =>
                            updatePrintSize(index, { bleedMm: event.target.value })
                          }
                          step="any"
                          type="number"
                          value={printSize.bleedMm}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-notes-${index}`}>
                        Item notes
                        <CheckThis show={missing(item.notes.confidence, item.notes.value)} />
                      </label>
                      <Input
                        className={missing(item.notes.confidence, item.notes.value) ? "border-amber-700 bg-amber-50" : ""}
                        id={`item-notes-${index}`}
                        onChange={(event) => updateItem(index, "notes", event.target.value)}
                        value={item.notes.value ?? ""}
                      />
                    </div>
                    {service?.base_price == null && service && (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" htmlFor={`item-price-${index}`}>
                          Unit price (catalogue has no price)
                          <CheckThis show={!prices[index]} />
                        </label>
                        <Input
                          className={!prices[index] ? "border-amber-700 bg-amber-50" : ""}
                          id={`item-price-${index}`}
                          min="0"
                          onChange={(event) =>
                            setPrices((current) =>
                              current.map((price, priceIndex) =>
                                priceIndex === index ? event.target.value : price,
                              ),
                            )
                          }
                          step="0.01"
                          type="number"
                          value={prices[index] ?? ""}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <section>
              <div className="sm:col-span-2">
                <h2 className="mb-1.5 text-sm font-semibold">Suggested reply</h2>
                <div className="min-h-20 whitespace-pre-wrap border border-slate-300 bg-white px-3 py-3 text-sm leading-6">
                  {questionMessage || "No clarifying questions suggested."}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <Button onClick={copySuggestedReply} type="button" variant="outline">
                    Copy
                  </Button>
                  {copyMessage && <p className="text-sm text-slate-600">{copyMessage}</p>}
                </div>
              </div>
            </section>

            <form action={formAction} className="space-y-3 border-t border-slate-200 pt-5">
              <input
                name="orderPayload"
                type="hidden"
                value={JSON.stringify({
                  customerName: extracted.customer_name.value ?? "",
                  phone: extracted.phone.value,
                  dueDate: extracted.deadline.value,
                  deliveryAddress: extracted.delivery_address.value,
                  sourceMessage: message,
                  items: extracted.items.value.map((item, index) => {
                    const linePrintSize = printSizes[index] ?? emptyPrintSize;
                    return {
                      serviceId: item.service_id.value,
                      quantity: item.quantity.value,
                      unitPrice: prices[index] ? Number(prices[index]) : null,
                      rawText: item.raw_text.value,
                      size: item.size.value,
                      material: item.material.value,
                      notes: item.notes.value,
                      printWidth: linePrintSize.width
                        ? Number(linePrintSize.width)
                        : null,
                      printHeight: linePrintSize.height
                        ? Number(linePrintSize.height)
                        : null,
                      printUnit:
                        linePrintSize.width && linePrintSize.height
                          ? linePrintSize.unit
                          : null,
                      bleedMm: Number(linePrintSize.bleedMm || "3"),
                    };
                  }),
                })}
              />
              {state.message && (
                <p className="text-sm text-red-700" role="alert">{state.message}</p>
              )}
              <Button disabled={!canCreate || creating} type="submit">
                {creating ? "Creating order…" : "Create order"}
              </Button>
              <p className="text-xs text-slate-600">
                AI only prepares this review. The order is created after you confirm it.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
