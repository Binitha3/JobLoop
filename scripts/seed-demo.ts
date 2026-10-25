import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const email = "demo@jobloop.example";
const workspaceSlug = "jobloop-demo";

const customers = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Aarav Mehta", phone: "9000000001", source_channel: "whatsapp" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Diya Nair", phone: "9000000002", source_channel: "instagram" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Rohan Iyer", phone: "9000000003", source_channel: "call" },
  { id: "00000000-0000-0000-0000-000000000004", name: "Ananya Shah", phone: "9000000004", source_channel: "walk_in" },
  { id: "00000000-0000-0000-0000-000000000005", name: "Kabir Rao", phone: "9000000005", source_channel: "whatsapp" },
  { id: "00000000-0000-0000-0000-000000000006", name: "Meera Joshi", phone: "9000000006", source_channel: "instagram" },
  { id: "00000000-0000-0000-0000-000000000007", name: "Arjun Patel", phone: "9000000007", source_channel: "call" },
  { id: "00000000-0000-0000-0000-000000000008", name: "Ishita Das", phone: "9000000008", source_channel: "walk_in" },
];

const services = [
  { id: "00000000-0000-0000-0000-000000000101", name: "Flyers", unit: "piece", base_price: 4, cost_price: 1.6 },
  { id: "00000000-0000-0000-0000-000000000102", name: "Business Cards", unit: "set", base_price: 300, cost_price: 125 },
  { id: "00000000-0000-0000-0000-000000000103", name: "Vinyl Banners", unit: "sq_ft", base_price: 45, cost_price: 22 },
  { id: "00000000-0000-0000-0000-000000000104", name: "T-shirt Printing", unit: "piece", base_price: 399, cost_price: 220 },
  { id: "00000000-0000-0000-0000-000000000105", name: "Custom Mugs", unit: "piece", base_price: 249, cost_price: 130 },
  { id: "b64d6b57-0c01-4fa0-8c83-0d38b9c80106", name: "Flex Banners", unit: "sq_ft", base_price: 45, cost_price: 22 },
];

const orderRows = [
  { id: "00000000-0000-0000-0000-000000001001", customer: 0, service: 0, status: "enquiry", quantity: 250, unitPrice: 4, dueDate: "2026-11-02" },
  { id: "00000000-0000-0000-0000-000000001002", customer: 1, service: 1, status: "quoted", quantity: 2, unitPrice: 300, dueDate: "2026-10-30" },
  { id: "00000000-0000-0000-0000-000000001003", customer: 2, service: 2, status: "approved", quantity: 24, unitPrice: 45, dueDate: "2026-10-29" },
  { id: "00000000-0000-0000-0000-000000001004", customer: 0, service: 2, status: "delivered", quantity: 30, unitPrice: 45, dueDate: "2026-10-23" },
  { id: "00000000-0000-0000-0000-000000001005", customer: 4, service: 3, status: "in_progress", quantity: 12, unitPrice: 399, dueDate: "2026-10-28" },
  { id: "00000000-0000-0000-0000-000000001006", customer: 5, service: 4, status: "ready", quantity: 8, unitPrice: 249, dueDate: "2026-10-27" },
  { id: "00000000-0000-0000-0000-000000001007", customer: 6, service: 0, status: "cancelled", quantity: 500, unitPrice: 4, dueDate: "2026-10-26" },
  { id: "00000000-0000-0000-0000-000000001008", customer: 7, service: 1, status: "enquiry", quantity: 1, unitPrice: 300, dueDate: "2026-11-04" },
];

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running scripts/seed-demo.ts.`);
  return value;
}

async function main() {
  const password = requireEnvironment("DEMO_PASSWORD");
  if (password.length < 8) throw new Error("DEMO_PASSWORD must be at least 8 characters.");

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL before seeding demo data.");

  const supabase = createClient(
    supabaseUrl,
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: listedUsers, error: listError } =
    await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw new Error(`Unable to find demo user: ${listError.message}`);

  let demoUser = listedUsers.users.find(
    (user) => user.email?.toLowerCase() === email,
  );
  if (!demoUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { workspace_name: "JobLoop Demo Print Studio" },
    });
    if (error) throw new Error(`Unable to create demo user: ${error.message}`);
    demoUser = data.user;
  }

  const { data: existingWorkspace, error: workspaceLookupError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (workspaceLookupError) {
    throw new Error(`Unable to find demo workspace: ${workspaceLookupError.message}`);
  }

  const workspace = {
    id: existingWorkspace?.id ?? randomUUID(),
    name: "JobLoop Demo Print Studio",
    slug: workspaceSlug,
    phone: "08055550123",
    email: "hello@jobloop.example",
    instagram_handle: "@jobloopdemostudio",
    address: "12 Market Road, Indiranagar, Bengaluru, Karnataka",
    currency: "INR",
    timezone: "Asia/Kolkata",
  };

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .upsert(workspace, { onConflict: "id" });
  if (workspaceError) throw new Error(`Unable to save demo workspace: ${workspaceError.message}`);

  const { error: memberError } = await supabase.from("workspace_members").upsert(
    { workspace_id: workspace.id, user_id: demoUser.id, role: "owner" },
    { onConflict: "workspace_id,user_id" },
  );
  if (memberError) throw new Error(`Unable to add demo workspace owner: ${memberError.message}`);

  const demoCustomers = customers.map((customer) => ({
    ...customer,
    workspace_id: workspace.id,
    notes: "Fictional demo customer.",
  }));
  const { error: customersError } = await supabase
    .from("customers")
    .upsert(demoCustomers, { onConflict: "id" });
  if (customersError) throw new Error(`Unable to save demo customers: ${customersError.message}`);

  const demoServices = services.map((service) => ({
    ...service,
    workspace_id: workspace.id,
    active: true,
  }));
  const { error: servicesError } = await supabase
    .from("services")
    .upsert(demoServices, { onConflict: "workspace_id,name" })
    .select("id, name");
  if (servicesError) throw new Error(`Unable to save demo services: ${servicesError.message}`);
  const { data: savedServices, error: serviceLookupError } = await supabase
    .from("services")
    .select("id, name")
    .eq("workspace_id", workspace.id);
  if (serviceLookupError) {
    throw new Error(`Unable to load demo services: ${serviceLookupError.message}`);
  }
  const serviceIds = new Map(savedServices.map((service) => [service.name, service.id]));

  const demoOrders = orderRows.map((order, index) => {
    const subtotal = order.quantity * order.unitPrice;
    const discountAmount = index === 3 ? 100 : 0;
    const deliveryCharge = index === 3 ? 150 : index % 2 === 0 ? 75 : 0;
    const taxAmount = Math.round((subtotal - discountAmount) * 0.18 * 100) / 100;
    const totalAmount = subtotal - discountAmount + taxAmount + deliveryCharge;
    const advancePaid =
      order.status === "delivered"
        ? totalAmount
        : ["approved", "in_progress", "ready"].includes(order.status)
          ? Math.round(totalAmount * 0.4 * 100) / 100
          : 0;

    return {
      id: order.id,
      workspace_id: workspace.id,
      customer_id: customers[order.customer].id,
      order_number: `JL-2610-${String(index + 1).padStart(4, "0")}`,
      status: order.status,
      priority: index === 4 ? "high" : "normal",
      due_date: order.dueDate,
      delivery_address: `${["Indiranagar", "Koramangala", "Jubilee Hills", "Baner"][index % 4]}, Bengaluru`,
      internal_notes: index === 3 ? "Artwork approved by customer; delivered and signed off." : null,
      currency: "INR",
      subtotal,
      discount_amount: discountAmount,
      tax_rate: 18,
      tax_amount: taxAmount,
      delivery_charge: deliveryCharge,
      total_amount: totalAmount,
      advance_paid: advancePaid,
      balance_due: totalAmount - advancePaid,
      payment_status:
        advancePaid === totalAmount
          ? "paid"
          : advancePaid > 0
            ? "partially_paid"
            : "unpaid",
      created_at:
        index === 3
          ? "2026-10-16T05:30:00.000Z"
          : new Date(Date.UTC(2026, 9, 16 + index, 5, 30)).toISOString(),
    };
  });

  const { error: ordersError } = await supabase
    .from("orders")
    .upsert(demoOrders, { onConflict: "id" });
  if (ordersError) throw new Error(`Unable to save demo orders: ${ordersError.message}`);

  const items = orderRows.map((order, index) => {
    const isHeroOrder = index === 3;
    return {
      id: `00000000-0000-0000-0000-${String(6001 + index).padStart(12, "0")}`,
      workspace_id: workspace.id,
      order_id: order.id,
      service_id: serviceIds.get(services[order.service].name),
      description: isHeroOrder
        ? "2 frontlit banners · 5 × 3 ft each"
        : services[order.service].name,
      quantity: order.quantity,
      unit_price: order.unitPrice,
      line_total: order.quantity * order.unitPrice,
      print_width: isHeroOrder ? 5 : null,
      print_height: isHeroOrder ? 3 : null,
      print_unit: isHeroOrder ? "ft" : null,
      bleed_mm: 3,
      selected_options: isHeroOrder
        ? [{ group: "material", value: "Frontlit" }, { group: "finish", value: "Eyelets" }]
        : [],
    };
  });
  const { error: itemsError } = await supabase
    .from("order_items")
    .upsert(items, { onConflict: "id" });
  if (itemsError) throw new Error(`Unable to save demo order items: ${itemsError.message}`);

  const quoteOrderIndexes = [1, 2, 3];
  const quotes = quoteOrderIndexes.map((index, quoteIndex) => {
    const order = demoOrders[index];
    return {
      id: `00000000-0000-0000-0000-${String(7001 + quoteIndex).padStart(12, "0")}`,
      workspace_id: workspace.id,
      order_id: order.id,
      quote_number: `QT-2610-${String(quoteIndex + 1).padStart(4, "0")}`,
      version: 1,
      status: order.status === "quoted" ? "sent" : "accepted",
      valid_until: "2026-11-15",
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      tax_rate: order.tax_rate,
      tax_percent: order.tax_rate,
      tax_amount: order.tax_amount,
      delivery_charge: order.delivery_charge,
      total_amount: order.total_amount,
      total: order.total_amount,
      terms: "Quote valid for 14 days. Production begins after artwork approval.",
    };
  });
  const { error: quotesError } = await supabase
    .from("quotes")
    .upsert(quotes, { onConflict: "id" });
  if (quotesError) throw new Error(`Unable to save demo quotes: ${quotesError.message}`);

  const heroOrder = demoOrders[3];
  const heroHistory = [
    { from: null, to: "enquiry", description: "New WhatsApp enquiry received.", at: "2026-10-16T05:30:00.000Z" },
    { from: "enquiry", to: "quoted", description: "Quote sent to Aarav for review.", at: "2026-10-16T07:15:00.000Z" },
    { from: "quoted", to: "approved", description: "Customer approved the quote.", at: "2026-10-17T04:45:00.000Z" },
    { from: "approved", to: "in_progress", description: "Banner production started.", at: "2026-10-17T06:00:00.000Z" },
    { from: "in_progress", to: "ready", description: "Print quality checked; ready for pickup.", at: "2026-10-22T08:20:00.000Z" },
    { from: "ready", to: "delivered", description: "Order delivered to Indiranagar.", at: "2026-10-23T10:10:00.000Z" },
  ];
  const events = orderRows.flatMap((order, index) => {
    if (index === 3) {
      return heroHistory.map((event, historyIndex) => ({
        id: `00000000-0000-0000-0000-${String(9001 + historyIndex).padStart(12, "0")}`,
        workspace_id: workspace.id,
        order_id: heroOrder.id,
        actor_id: demoUser.id,
        event_type: "status_changed",
        previous_status: event.from,
        new_status: event.to,
        from_status: event.from,
        to_status: event.to,
        description: event.description,
        created_at: event.at,
      }));
    }
    return [{
      id: `00000000-0000-0000-0000-${String(9010 + index).padStart(12, "0")}`,
      workspace_id: workspace.id,
      order_id: order.id,
      actor_id: demoUser.id,
      event_type: "order_created",
      new_status: order.status,
      to_status: order.status,
      description: `Demo order added as ${order.status.replaceAll("_", " ")}.`,
      created_at: demoOrders[index].created_at,
    }];
  });
  const { error: eventsError } = await supabase
    .from("order_events")
    .upsert(events, { onConflict: "id" });
  if (eventsError) throw new Error(`Unable to save demo order history: ${eventsError.message}`);

  const { data: activeTrackingToken, error: trackingLookupError } = await supabase
    .from("tracking_tokens")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("order_id", heroOrder.id)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (trackingLookupError) {
    throw new Error(`Unable to check the demo tracking link: ${trackingLookupError.message}`);
  }
  if (!activeTrackingToken) {
    const { randomBytes, createHash } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    const { error } = await supabase.from("tracking_tokens").insert({
      workspace_id: workspace.id,
      order_id: heroOrder.id,
      token,
      token_hash: createHash("sha256").update(token).digest("hex"),
    });
    if (error) throw new Error(`Unable to create demo tracking link: ${error.message}`);
  }

  console.log(
    `Seeded ${email}: one workspace, ${customers.length} customers, ${services.length} services, and ${demoOrders.length} orders.`,
  );
}

main().catch((error: unknown) => {
  console.error("Unable to seed JobLoop demo data.", error);
  process.exitCode = 1;
});
