import { NextResponse } from "next/server";
import { buildExtractOrderPrompt, extractOrderSchema, extractOrderSystemPrompt } from "@/lib/ai/extractOrder";
import { generateStructured } from "@/lib/ai/generateStructured";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";
import { z } from "zod";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to extract order details." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Paste a message up to 10,000 characters long." },
      { status: 400 },
    );
  }

  const { data: allowed, error: rateLimitError } = await supabase.rpc(
    "consume_ai_extraction_request",
  );
  if (rateLimitError) {
    return NextResponse.json(
      { error: `Unable to check the extraction limit: ${rateLimitError.message}` },
      { status: 500 },
    );
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "You've reached the limit of 10 extractions per minute. Try again shortly." },
      { status: 429 },
    );
  }

  const workspaceId = await getWorkspaceId(supabase, user.id);
  const [
    { data: services, error: servicesError },
    { data: workspace, error: workspaceError },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, unit")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("workspaces")
      .select("timezone")
      .eq("id", workspaceId)
      .single(),
  ]);

  if (servicesError) {
    return NextResponse.json(
      { error: `Unable to load the workspace service catalogue: ${servicesError.message}` },
      { status: 500 },
    );
  }
  if (workspaceError) {
    return NextResponse.json(
      { error: `Unable to load workspace settings: ${workspaceError.message}` },
      { status: 500 },
    );
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: workspace.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  try {
    const extracted = await generateStructured({
      system: extractOrderSystemPrompt,
      user: buildExtractOrderPrompt({
        message: parsedRequest.data.message,
        today,
        services: services ?? [],
      }),
      schema: extractOrderSchema,
    });
    const knownServiceIds = new Set((services ?? []).map((service) => service.id));
    const missingFields = new Set(extracted.missing_fields);
    const nullableFields = [
      ["customer_name", extracted.customer_name.value],
      ["phone", extracted.phone.value],
      ["deadline", extracted.deadline.value],
      ["delivery_address", extracted.delivery_address.value],
    ] as const;
    for (const [field, value] of nullableFields) {
      if (value === null) missingFields.add(field);
    }
    if (extracted.items.value.length === 0) missingFields.add("items");

    const sanitized = {
      ...extracted,
      items: {
        ...extracted.items,
        value: extracted.items.value.map((item, index) => {
          const itemFields = [
            ["service_id", item.service_id.value],
            ["raw_text", item.raw_text.value],
            ["quantity", item.quantity.value],
            ["size", item.size.value],
            ["material", item.material.value],
            ["notes", item.notes.value],
          ] as const;
          for (const [field, value] of itemFields) {
            if (value === null || value === "") {
              missingFields.add(`items[${index}].${field}`);
            }
          }
          if (item.service_id.value && !knownServiceIds.has(item.service_id.value)) {
            missingFields.add(`items[${index}].service_id`);
            return {
              ...item,
              service_id: { value: null, confidence: "low" as const },
            };
          }
          return item;
        }),
      },
      missing_fields: [...missingFields],
    };

    return NextResponse.json(sanitized);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The AI service could not extract the order details.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
