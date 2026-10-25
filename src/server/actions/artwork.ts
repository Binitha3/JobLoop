"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import sharp from "sharp";
import { analyzeArtworkImage } from "@/lib/preflight/analyze";
import { PREFLIGHT_THRESHOLDS } from "@/lib/preflight/config";
import { detectArtworkFormat } from "@/lib/preflight/signature";
import {
  getOverallStatus,
  runPreflight,
  type PrintUnit,
} from "@/lib/preflight/engine";
import { generateStructured } from "@/lib/ai/generateStructured";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/supabase/workspace";

const uploadInputSchema = z.object({
  orderItemId: z.string().uuid(),
  originalName: z.string().trim().min(1).max(255),
});

const completeInputSchema = z.object({
  orderItemId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  originalName: z.string().trim().min(1).max(255),
});

const deleteInputSchema = z.object({
  orderItemId: z.string().uuid(),
  artworkFileId: z.string().uuid(),
});

const aiNotesSchema = z.object({
  notes: z.array(z.string().trim().min(1).max(300)).max(5),
});

async function getAuthenticatedWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "Sign in to manage artwork." } as const;
  const workspaceId = await getWorkspaceId(supabase, user.id);
  return { supabase, user, workspaceId } as const;
}

async function rejectUploadedFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
  message: string,
) {
  const { error } = await supabase.storage.from("artwork").remove([storagePath]);
  return {
    message: error
      ? `${message} Cleanup failed: ${error.message}`
      : message,
  };
}

export async function createArtworkUploadUrl(input: {
  orderItemId: string;
  originalName: string;
}): Promise<{ storagePath?: string; token?: string; message?: string }> {
  const parsed = uploadInputSchema.safeParse(input);
  if (!parsed.success) {
    return { message: "Choose a valid image file for this order item." };
  }

  const auth = await getAuthenticatedWorkspace();
  if ("message" in auth) return auth;
  const { data: item, error: itemError } = await auth.supabase
    .from("order_items")
    .select("id")
    .eq("id", parsed.data.orderItemId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (itemError) return { message: `Unable to load order item: ${itemError.message}` };
  if (!item) return { message: "Order item not found in this workspace." };

  const storagePath = `${auth.workspaceId}/${item.id}/${crypto.randomUUID()}`;
  const { data, error } = await auth.supabase.storage
    .from("artwork")
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error) {
    return { message: `Unable to prepare artwork upload: ${error.message}` };
  }
  return { storagePath: data.path, token: data.token };
}

async function createAiNotes(buffer: Buffer) {
  try {
    const preview = await sharp(buffer)
      .rotate()
      .resize(
        PREFLIGHT_THRESHOLDS.maxVisionDimensionPixels,
        PREFLIGHT_THRESHOLDS.maxVisionDimensionPixels,
        { fit: "inside", withoutEnlargement: true },
      )
      .jpeg()
      .toBuffer();
    const { notes } = await generateStructured({
      system:
        "Review this print artwork and return a JSON object with a notes array. Only report visually apparent tiny text, low contrast, a visible watermark, or pixelation. If none are apparent, return an empty array. These are suggestions, not verified findings.",
      user: "List concise visual observations about this artwork.",
      image: { mimeType: "image/jpeg", base64: preview.toString("base64") },
      schema: aiNotesSchema,
    });
    return notes;
  } catch {
    return [];
  }
}

export async function completeArtworkUpload(input: {
  orderItemId: string;
  storagePath: string;
  originalName: string;
}): Promise<{ message?: string }> {
  const parsed = completeInputSchema.safeParse(input);
  if (!parsed.success) return { message: "The uploaded artwork details are invalid." };

  const auth = await getAuthenticatedWorkspace();
  if ("message" in auth) return auth;
  const { data: item, error: itemError } = await auth.supabase
    .from("order_items")
    .select(
      "id, order_id, service_id, print_width, print_height, print_unit, bleed_mm",
    )
    .eq("id", parsed.data.orderItemId)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  if (itemError) return { message: `Unable to load order item: ${itemError.message}` };
  if (!item) return { message: "Order item not found in this workspace." };

  const segments = parsed.data.storagePath.split("/");
  const pathFileId = segments[2];
  if (
    segments.length !== 3 ||
    segments[0] !== auth.workspaceId ||
    segments[1] !== item.id ||
    !pathFileId ||
    !z.string().uuid().safeParse(pathFileId).success
  ) {
    return { message: "The uploaded file does not belong to this order item." };
  }

  const { data: imageFile, error: downloadError } = await auth.supabase.storage
    .from("artwork")
    .download(parsed.data.storagePath);
  if (downloadError) {
    return { message: `Unable to verify uploaded artwork: ${downloadError.message}` };
  }
  if (imageFile.size > PREFLIGHT_THRESHOLDS.maxUploadBytes) {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      "Artwork must be 25 MB or smaller.",
    );
  }

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
  const signature = detectArtworkFormat(imageBuffer);
  if (!signature) {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      "Upload a PNG, JPG, or WebP image. PDF preflight coming later.",
    );
  }

  let imageMetadata;
  try {
    imageMetadata = await sharp(imageBuffer).metadata();
  } catch {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      "The uploaded file is not a readable image.",
    );
  }
  if (imageMetadata.format !== signature.format) {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      "The image signature and encoded format do not match.",
    );
  }

  let image: Awaited<ReturnType<typeof analyzeArtworkImage>>;
  try {
    image = await analyzeArtworkImage(imageBuffer);
  } catch (error) {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      `Unable to analyze artwork: ${
        error instanceof Error ? error.message : "Unknown image error."
      }`,
    );
  }

  const { data: previousFiles, error: previousError } = await auth.supabase
    .from("artwork_files")
    .select("id, storage_path")
    .eq("workspace_id", auth.workspaceId)
    .eq("order_item_id", item.id);
  if (previousError) {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      `Unable to load existing artwork: ${previousError.message}`,
    );
  }

  const { data: service, error: serviceError } = await auth.supabase
    .from("services")
    .select("name")
    .eq("workspace_id", auth.workspaceId)
    .eq("id", item.service_id)
    .maybeSingle();
  if (serviceError) {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      `Unable to load item service: ${serviceError.message}`,
    );
  }

  const checks = runPreflight(image, {
    width: item.print_width == null ? null : Number(item.print_width),
    height: item.print_height == null ? null : Number(item.print_height),
    unit: (item.print_unit ?? "mm") as PrintUnit,
    bleedMm: Number(item.bleed_mm),
    isBanner: service?.name.toLowerCase().includes("banner") ?? false,
    isPrintedProduct: true,
  });
  const overall = getOverallStatus(checks);
  const aiNotes = await createAiNotes(imageBuffer);

  const { data: artworkId, error: saveError } = await auth.supabase.rpc(
    "save_artwork_upload",
    {
      p_workspace_id: auth.workspaceId,
      p_order_item_id: item.id,
      p_storage_path: parsed.data.storagePath,
      p_original_name: parsed.data.originalName,
      p_mime: signature.mime,
      p_size_bytes: imageFile.size,
      p_width_px: image.widthPx,
      p_height_px: image.heightPx,
      p_results: checks,
      p_overall: overall,
      p_ai_notes: aiNotes,
    },
  );
  if (saveError) {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      `Unable to save artwork and preflight report: ${saveError.message}`,
    );
  }
  if (typeof artworkId !== "string") {
    return rejectUploadedFile(
      auth.supabase,
      parsed.data.storagePath,
      "Supabase returned an invalid artwork result.",
    );
  }

  const previousPaths = (previousFiles ?? []).map((file) => file.storage_path);
  const previousIds = (previousFiles ?? []).map((file) => file.id);
  if (previousPaths.length > 0) {
    const { error: removeError } = await auth.supabase.storage
      .from("artwork")
      .remove(previousPaths);
    if (removeError) {
      return { message: `Unable to replace prior artwork: ${removeError.message}` };
    }
    const { error: deleteError } = await auth.supabase
      .from("artwork_files")
      .delete()
      .eq("workspace_id", auth.workspaceId)
      .in("id", previousIds);
    if (deleteError) {
      return { message: `Unable to remove prior artwork records: ${deleteError.message}` };
    }
  }

  revalidatePath(`/orders/${item.order_id}`);
  return {};
}

export async function deleteArtworkFile(input: {
  orderItemId: string;
  artworkFileId: string;
}): Promise<{ message?: string }> {
  const parsed = deleteInputSchema.safeParse(input);
  if (!parsed.success) return { message: "Choose a valid artwork file to delete." };

  const auth = await getAuthenticatedWorkspace();
  if ("message" in auth) return auth;
  const { data: artwork, error: artworkError } = await auth.supabase
    .from("artwork_files")
    .select("storage_path, original_name, order_item_id")
    .eq("id", parsed.data.artworkFileId)
    .eq("workspace_id", auth.workspaceId)
    .eq("order_item_id", parsed.data.orderItemId)
    .maybeSingle();
  if (artworkError) {
    return { message: `Unable to load artwork: ${artworkError.message}` };
  }
  if (!artwork) return { message: "Artwork file not found in this workspace." };

  const { data: item, error: itemError } = await auth.supabase
    .from("order_items")
    .select("order_id")
    .eq("id", artwork.order_item_id)
    .eq("workspace_id", auth.workspaceId)
    .single();
  if (itemError) return { message: `Unable to load order item: ${itemError.message}` };

  const { error: removeError } = await auth.supabase.storage
    .from("artwork")
    .remove([artwork.storage_path]);
  if (removeError) return { message: `Unable to delete artwork file: ${removeError.message}` };

  const { error: deleteError } = await auth.supabase
    .from("artwork_files")
    .delete()
    .eq("id", parsed.data.artworkFileId)
    .eq("workspace_id", auth.workspaceId);
  if (deleteError) {
    return { message: `Unable to delete artwork record: ${deleteError.message}` };
  }

  const { error: eventError } = await auth.supabase.from("order_events").insert({
    workspace_id: auth.workspaceId,
    order_id: item.order_id,
    actor_id: auth.user.id,
    event_type: "artwork_deleted",
    description: `Artwork deleted: ${artwork.original_name}`,
    metadata: { order_item_id: artwork.order_item_id },
  });
  if (eventError) return { message: `Unable to log artwork deletion: ${eventError.message}` };

  revalidatePath(`/orders/${item.order_id}`);
  return {};
}
