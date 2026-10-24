import { createElement } from "react";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import {
  QuotePdfPage,
  type QuotePdfData,
} from "@/components/quotes/quote-pdf-document";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, order_id, quote_number, valid_until, subtotal, discount_amount, tax_percent, tax_amount, delivery_charge, total, terms, created_at",
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (quoteError) {
    throw new Error(`Unable to load quote PDF data: ${quoteError.message}`);
  }
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const [
    { data: workspace, error: workspaceError },
    { data: order, error: orderError },
  ] = await Promise.all([
    supabase
      .from("workspaces")
      .select("name, phone, email")
      .eq("id", workspaceId)
      .single(),
    supabase
      .from("orders")
      .select("customer_id")
      .eq("id", quote.order_id)
      .eq("workspace_id", workspaceId)
      .single(),
  ]);

  if (workspaceError) {
    throw new Error(`Unable to load workspace: ${workspaceError.message}`);
  }
  if (orderError) {
    throw new Error(`Unable to load order: ${orderError.message}`);
  }

  const [
    { data: customer, error: customerError },
    { data: items, error: itemsError },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("name, phone, email")
      .eq("id", order.customer_id)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .from("order_items")
      .select("service_id, description, quantity, unit_price, line_total")
      .eq("order_id", quote.order_id)
      .eq("workspace_id", workspaceId)
      .order("created_at"),
  ]);

  if (customerError) {
    throw new Error(`Unable to load customer: ${customerError.message}`);
  }
  if (itemsError) {
    throw new Error(`Unable to load order items: ${itemsError.message}`);
  }

  const serviceIds = [...new Set((items ?? []).map((item) => item.service_id))];
  const { data: services, error: servicesError } = serviceIds.length
    ? await supabase
        .from("services")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .in("id", serviceIds)
    : { data: [], error: null };

  if (servicesError) {
    throw new Error(`Unable to load services: ${servicesError.message}`);
  }

  const serviceNames = new Map((services ?? []).map((service) => [service.id, service.name]));
  const data: QuotePdfData = {
    businessName: workspace.name,
    businessPhone: workspace.phone,
    businessEmail: workspace.email,
    quoteNumber: quote.quote_number,
    date: quote.created_at,
    validUntil: quote.valid_until,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    items: (items ?? []).map((item) => ({
      service:
        item.description ||
        serviceNames.get(item.service_id) ||
        "Service",
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
    subtotal: Number(quote.subtotal),
    discount: Number(quote.discount_amount),
    taxPercent: Number(quote.tax_percent),
    taxAmount: Number(quote.tax_amount),
    deliveryCharge: Number(quote.delivery_charge),
    total: Number(quote.total),
    terms: quote.terms,
  };

  const pdf = await renderToBuffer(
    createElement(
      Document,
      { title: data.quoteNumber, author: data.businessName },
      createElement(QuotePdfPage, { quote: data }),
    ),
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quote_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
