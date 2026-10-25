"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PREFLIGHT_THRESHOLDS } from "@/lib/preflight/config";
import type {
  PreflightCheck,
  PreflightStatus,
} from "@/lib/preflight/engine";
import {
  completeArtworkUpload,
  createArtworkUploadUrl,
  deleteArtworkFile,
} from "@/server/actions/artwork";

type ArtworkView = {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  createdAt: string;
  thumbnailUrl: string;
  overall: PreflightStatus;
  checks: PreflightCheck[];
  aiNotes: string[];
};

function StatusTag({ status }: { status: PreflightStatus }) {
  const color =
    status === "fail"
      ? "border-red-700 bg-red-50 text-red-800"
      : status === "warn"
        ? "border-amber-700 bg-amber-50 text-amber-900"
        : "border-emerald-700 bg-emerald-50 text-emerald-800";
  return (
    <span className={`inline-flex border px-2 py-0.5 text-xs font-semibold uppercase ${color}`}>
      {status}
    </span>
  );
}

function imageMimeFromSignature(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function ArtworkManager({
  orderItemId,
  files,
}: {
  orderItemId: string;
  files: ArtworkView[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadArtwork() {
    setMessage("");
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setMessage("Choose an artwork file first.");
      return;
    }

    if (file.size > PREFLIGHT_THRESHOLDS.maxUploadBytes) {
      setMessage("Artwork must be 25 MB or smaller.");
      return;
    }

    setBusy(true);
    try {
      const fileSignature = new Uint8Array(
        await file.slice(0, 12).arrayBuffer(),
      );
      if (String.fromCharCode(...fileSignature.subarray(0, 5)) === "%PDF-") {
        setMessage("PDF preflight coming later.");
        return;
      }
      const signatureMime = imageMimeFromSignature(fileSignature);
      if (!signatureMime) {
        setMessage("Upload a PNG, JPG, or WebP image. PDF preflight coming later.");
        return;
      }

      const signed = await createArtworkUploadUrl({
        orderItemId,
        originalName: file.name,
      });
      if (!signed.storagePath || !signed.token) {
        setMessage(signed.message ?? "Unable to prepare artwork upload.");
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("artwork")
        .uploadToSignedUrl(signed.storagePath, signed.token, file, {
          contentType: signatureMime,
          upsert: false,
        });
      if (uploadError) {
        setMessage(`Unable to upload artwork: ${uploadError.message}`);
        return;
      }

      const completed = await completeArtworkUpload({
        orderItemId,
        storagePath: signed.storagePath,
        originalName: file.name,
      });
      if (completed.message) {
        setMessage(completed.message);
        router.refresh();
        return;
      }

      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Unable to upload artwork: ${error.message}`
          : "Unable to upload artwork.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(file: ArtworkView) {
    if (!window.confirm(`Delete ${file.originalName}?`)) return;
    setMessage("");
    setBusy(true);
    try {
      const result = await deleteArtworkFile({
        orderItemId,
        artworkFileId: file.id,
      });
      if (result.message) {
        setMessage(result.message);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Unable to delete artwork: ${error.message}`
          : "Unable to delete artwork.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="mb-1.5 block text-sm font-medium" htmlFor={`artwork-${orderItemId}`}>
            Artwork file
          </label>
          <input
            accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
            className="block w-full text-sm file:mr-3 file:h-10 file:border file:border-slate-300 file:bg-white file:px-3 file:text-sm file:font-medium"
            disabled={busy}
            id={`artwork-${orderItemId}`}
            ref={fileInput}
            type="file"
          />
        </div>
        <button
          className="h-10 border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          disabled={busy}
          onClick={uploadArtwork}
          type="button"
        >
          {busy ? "Working…" : files.length ? "Upload / replace artwork" : "Upload artwork"}
        </button>
      </div>
      <p className="text-xs text-slate-600">PNG, JPG, or WebP · up to 25 MB. PDF preflight coming later.</p>
      {message && (
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-slate-600">No artwork uploaded.</p>
      ) : (
        files.map((file) => {
          const orderedChecks = [...file.checks].sort(
            (left, right) =>
              (left.status === "fail" ? 0 : left.status === "warn" ? 1 : 2) -
              (right.status === "fail" ? 0 : right.status === "warn" ? 1 : 2),
          );
          return (
            <section className="space-y-3 border-y border-slate-200 py-4" key={file.id}>
              <div className="flex flex-wrap items-center gap-3">
                <a href={file.thumbnailUrl} rel="noreferrer" target="_blank">
                  {/* Private signed assets are loaded directly instead of through the Next image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`Thumbnail of ${file.originalName}`}
                    className="h-24 w-36 border border-slate-200 object-contain"
                    height={96}
                    src={file.thumbnailUrl}
                    width={144}
                  />
                </a>
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-medium">{file.originalName}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {file.widthPx} × {file.heightPx} px ·{" "}
                    {(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB · {file.mime}
                  </p>
                </div>
                <StatusTag status={file.overall} />
                <button
                  className="h-9 border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => deleteFile(file)}
                  type="button"
                >
                  Delete
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-medium">Check</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Explanation</th>
                      <th className="px-3 py-2 font-medium">Suggested fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedChecks.map((check) => (
                      <tr className="border-b border-slate-100" key={check.id}>
                        <td className="px-3 py-2 font-medium">{check.title}</td>
                        <td className="px-3 py-2">
                          <StatusTag status={check.status} />
                        </td>
                        <td className="px-3 py-2">{check.detail}</td>
                        <td className="px-3 py-2">{check.fix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="text-sm font-semibold">AI notes (not verified)</h4>
                <p className="mt-1 text-xs text-slate-600">
                  These are suggestions only and have not been verified. They never change preflight status.
                </p>
                {file.aiNotes.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {file.aiNotes.map((note, index) => (
                      <li key={`${file.id}-ai-${index}`}>{note}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No AI notes are available.</p>
                )}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
