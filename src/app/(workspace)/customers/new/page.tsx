import type { Metadata } from "next";
import Link from "next/link";
import { CustomerForm } from "@/components/customers/customer-form";
import { createCustomer } from "@/server/actions/customers";

export const metadata: Metadata = { title: "Add customer" };

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <Link
          className="text-sm underline underline-offset-4"
          href="/customers"
        >
          Customers
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Add customer
        </h1>
      </header>
      <CustomerForm action={createCustomer} submitLabel="Save customer" />
    </div>
  );
}
