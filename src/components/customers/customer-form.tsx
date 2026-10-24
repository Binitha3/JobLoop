"use client";

import { useActionState } from "react";
import type { CustomerActionState } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CustomerFormProps = {
  action: (
    state: CustomerActionState,
    formData: FormData,
  ) => Promise<CustomerActionState>;
  initialValues?: {
    name: string;
    phone: string | null;
    email: string | null;
    source_channel: string | null;
  };
  submitLabel: string;
};

export function CustomerForm({
  action,
  initialValues,
  submitLabel,
}: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, { message: "" });

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state.message && (
        <p className="text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="name">
          Name
        </label>
        <Input
          autoComplete="name"
          defaultValue={initialValues?.name ?? ""}
          id="name"
          maxLength={160}
          name="name"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="phone">
          Phone
        </label>
        <Input
          autoComplete="tel"
          defaultValue={initialValues?.phone ?? ""}
          id="phone"
          name="phone"
          type="tel"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <Input
          autoComplete="email"
          defaultValue={initialValues?.email ?? ""}
          id="email"
          name="email"
          type="email"
        />
      </div>
      <div>
        <label
          className="mb-1.5 block text-sm font-medium"
          htmlFor="source_channel"
        >
          Source channel
        </label>
        <select
          className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
          defaultValue={initialValues?.source_channel ?? ""}
          id="source_channel"
          name="source_channel"
        >
          <option value="">Not specified</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="call">Call</option>
          <option value="walk_in">Walk-in</option>
        </select>
      </div>
      <Button disabled={pending} type="submit">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
