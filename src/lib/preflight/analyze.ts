import sharp from "sharp";
import { PREFLIGHT_THRESHOLDS } from "./config";
import type { PreflightImage } from "./engine";

export async function analyzeArtworkImage(buffer: Buffer): Promise<PreflightImage> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("The image has no usable pixel dimensions.");
  }

  const sampled = await sharp(buffer)
    .rotate()
    .resize(
      PREFLIGHT_THRESHOLDS.pixelSampleDimension,
      PREFLIGHT_THRESHOLDS.pixelSampleDimension,
      { fit: "inside", withoutEnlargement: true },
    )
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const greyscale = await sharp(buffer)
    .rotate()
    .resize(
      PREFLIGHT_THRESHOLDS.sharpnessSampleDimension,
      PREFLIGHT_THRESHOLDS.sharpnessSampleDimension,
      { fit: "inside", withoutEnlargement: true },
    )
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = greyscale.info.width;
  const height = greyscale.info.height;
  let sum = 0;
  let sumSquared = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const laplacian =
        greyscale.data[index - 1] +
        greyscale.data[index + 1] +
        greyscale.data[index - width] +
        greyscale.data[index + width] -
        4 * greyscale.data[index];
      sum += laplacian;
      sumSquared += laplacian ** 2;
      count += 1;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const sharpnessVariance =
    count > 0 ? sumSquared / count - mean ** 2 : 0;
  const format =
    metadata.format === "jpeg" || metadata.format === "png" || metadata.format === "webp"
      ? metadata.format
      : "unknown";

  return {
    widthPx: metadata.width,
    heightPx: metadata.height,
    sizeBytes: buffer.byteLength,
    format,
    colorSpace: metadata.space,
    hasAlpha: metadata.hasAlpha ?? false,
    density: metadata.density,
    sharpnessVariance,
    pixels: {
      data: sampled.data,
      width: sampled.info.width,
      height: sampled.info.height,
      channels: sampled.info.channels,
    },
  };
}
