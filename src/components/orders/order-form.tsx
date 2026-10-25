"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import type { OrderActionState } from "@/server/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CustomerOption = {
  id: string;
  name: string;
};

type ServiceOption = {
  id: string;
  name: string;
  unit: string;
  base_price: number | null;
};

type LineItem = {
  serviceId: string;
  quantity: string;
  unitPrice: string;
  printWidth: string;
  printHeight: string;
  printUnit: "mm" | "cm" | "in" | "ft";
  bleedMm: string;
};

const sourceChannels = [
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["call", "Call"],
  ["walk_in", "Walk-in"],
];

export function OrderForm({
  action,
  customers,
  services,
}: {
  action: (
    state: OrderActionState,
    formData: FormData,
  ) => Promise<OrderActionState>;
  customers: CustomerOption[];
  services: ServiceOption[];
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  const [isNewCustomer, setIsNewCustomer] = useState(customers.length === 0);
  const [items, setItems] = useState<LineItem[]>([
    {
      serviceId: "",
      quantity: "1",
      unitPrice: "",
      printWidth: "",
      printHeight: "",
      printUnit: "mm",
      bleedMm: "3",
    },
  ]);
  const total = items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      {state.message && (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Customer</h2>
        {!isNewCustomer && customers.length > 0 ? (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="customerId">
                Choose customer
              </label>
              <select
                className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
                id="customerId"
                name="customerId"
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="text-sm font-medium underline underline-offset-4"
              onClick={() => setIsNewCustomer(true)}
              type="button"
            >
              Use a new customer instead
            </button>
          </>
        ) : (
          <div className="space-y-4">
            {customers.length > 0 && (
              <button
                className="text-sm font-medium underline underline-offset-4"
                onClick={() => setIsNewCustomer(false)}
                type="button"
              >
                Choose an existing customer
              </button>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="newCustomerName">
                Customer name
              </label>
              <Input
                autoComplete="name"
                id="newCustomerName"
                maxLength={160}
                name="newCustomerName"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="newCustomerPhone">
                Phone
              </label>
              <Input
                autoComplete="tel"
                id="newCustomerPhone"
                name="newCustomerPhone"
                type="tel"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="newCustomerEmail">
                Email
              </label>
              <Input
                autoComplete="email"
                id="newCustomerEmail"
                name="newCustomerEmail"
                type="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="newCustomerSource">
                Source channel
              </label>
              <select
                className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
                defaultValue=""
                id="newCustomerSource"
                name="newCustomerSource"
              >
                <option value="">Not specified</option>
                {sourceChannels.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {customers.length === 0 && (
          <p className="text-sm text-slate-600">
            This customer will also be saved to{" "}
            <Link className="underline underline-offset-4" href="/customers">
              Customers
            </Link>
            .
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Line items</h2>
          <button
            className="text-sm font-medium underline underline-offset-4"
            onClick={() =>
              setItems((current) => [
                ...current,
                {
                  serviceId: "",
                  quantity: "1",
                  unitPrice: "",
                  printWidth: "",
                  printHeight: "",
                  printUnit: "mm",
                  bleedMm: "3",
                },
              ])
            }
            type="button"
          >
            Add line item
          </button>
        </div>
        {services.length === 0 ? (
          <p className="border-y border-amber-300 py-4 text-sm text-amber-900">
            There are no active services in this workspace. Add a service in
            Supabase before creating an order.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                className="grid gap-3 border-b border-slate-200 pb-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"
                key={index}
              >
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    htmlFor={`service-${index}`}
                  >
                    Service
                  </label>
                  <select
                    className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
                    id={`service-${index}`}
                    onChange={(event) => {
                      const selected = services.find(
                        (service) => service.id === event.target.value,
                      );
                      updateItem(index, {
                        serviceId: event.target.value,
                        unitPrice:
                          selected?.base_price == null
                            ? ""
                            : String(selected.base_price),
                      });
                    }}
                    required
                    value={item.serviceId}
                  >
                    <option value="">Select a service</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} ({service.unit})
                        {service.base_price === null ? " — price not set" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    htmlFor={`quantity-${index}`}
                  >
                    Quantity
                  </label>
                  <Input
                    id={`quantity-${index}`}
                    min="0.01"
                    onChange={(event) =>
                      updateItem(index, { quantity: event.target.value })
                    }
                    required
                    step="0.01"
                    type="number"
                    value={item.quantity}
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-medium"
                    htmlFor={`price-${index}`}
                  >
                    Unit price
                  </label>
                  <Input
                    id={`price-${index}`}
                    min="0"
                    onChange={(event) =>
                      updateItem(index, { unitPrice: event.target.value })
                    }
                    required
                    step="0.01"
                    type="number"
                    value={item.unitPrice}
                  />
                </div>
                {items.length > 1 && (
                  <button
                    aria-label={`Remove line item ${index + 1}`}
                    className="self-end pb-3 text-sm underline underline-offset-4"
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                )}
                <div className="grid gap-3 sm:col-span-4 sm:grid-cols-4">
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium"
                      htmlFor={`print-width-${index}`}
                    >
                      Print width (optional)
                    </label>
                    <Input
                      id={`print-width-${index}`}
                      min="0.01"
                      onChange={(event) =>
                        updateItem(index, { printWidth: event.target.value })
                      }
                      step="any"
                      type="number"
                      value={item.printWidth}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium"
                      htmlFor={`print-height-${index}`}
                    >
                      Print height (optional)
                    </label>
                    <Input
                      id={`print-height-${index}`}
                      min="0.01"
                      onChange={(event) =>
                        updateItem(index, { printHeight: event.target.value })
                      }
                      step="any"
                      type="number"
                      value={item.printHeight}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium"
                      htmlFor={`print-unit-${index}`}
                    >
                      Size unit
                    </label>
                    <select
                      className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
                      id={`print-unit-${index}`}
                      onChange={(event) => {
                        const unit = (["mm", "cm", "in", "ft"] as const).find(
                          (candidate) => candidate === event.target.value,
                        );
                        if (unit) updateItem(index, { printUnit: unit });
                      }}
                      value={item.printUnit}
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                      <option value="ft">ft</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-medium"
                      htmlFor={`bleed-${index}`}
                    >
                      Bleed (mm)
                    </label>
                    <Input
                      id={`bleed-${index}`}
                      min="0"
                      onChange={(event) =>
                        updateItem(index, { bleedMm: event.target.value })
                      }
                      step="any"
                      type="number"
                      value={item.bleedMm}
                    />
                  </div>
                </div>
              </div>
            ))}
            <input
              name="items"
              type="hidden"
              value={JSON.stringify(
                items.map((item) => ({
                  service_id: item.serviceId,
                  quantity: Number(item.quantity),
                  unit_price: Number(item.unitPrice),
                  print_width: item.printWidth ? Number(item.printWidth) : null,
                  print_height: item.printHeight ? Number(item.printHeight) : null,
                  print_unit:
                    item.printWidth && item.printHeight ? item.printUnit : null,
                  bleed_mm: Number(item.bleedMm || "3"),
                })),
              )}
            />
            <p className="text-right text-sm font-semibold">
              Total: {new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
              }).format(total)}
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="dueDate">
            Due date
          </label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium" htmlFor="notes">
            Notes
          </label>
          <textarea
            className="min-h-28 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
            id="notes"
            maxLength={5000}
            name="notes"
          />
        </div>
      </section>
      <Button disabled={pending || services.length === 0} type="submit">
        {pending ? "Creating order…" : "Create order"}
      </Button>
    </form>
  );
}
