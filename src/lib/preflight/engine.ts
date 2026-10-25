import { PREFLIGHT_THRESHOLDS } from "./config";

export type PrintUnit = "mm" | "cm" | "in" | "ft";
export type PreflightStatus = "pass" | "warn" | "fail";

export type PreflightCheck = {
  id: string;
  status: PreflightStatus;
  title: string;
  detail: string;
  fix: string;
};

export type PreflightImage = {
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  format: "png" | "jpeg" | "webp" | "unknown";
  colorSpace: string | undefined;
  hasAlpha: boolean;
  density: number | undefined;
  sharpnessVariance: number;
  pixels: {
    data: Uint8Array;
    width: number;
    height: number;
    channels: number;
  };
};

export type PreflightPrintSize = {
  width: number | null;
  height: number | null;
  unit: PrintUnit;
  bleedMm: number;
  isBanner: boolean;
  isPrintedProduct: boolean;
};

function inches(value: number, unit: PrintUnit) {
  switch (unit) {
    case "mm":
      return value / 25.4;
    case "cm":
      return value / 2.54;
    case "ft":
      return value * 12;
    case "in":
      return value;
  }
}

function result(
  id: string,
  status: PreflightStatus,
  title: string,
  detail: string,
  fix: string,
): PreflightCheck {
  return { id, status, title, detail, fix };
}

function getDominantBorderColor(image: PreflightImage["pixels"]) {
  const bins = new Map<string, { count: number; rgb: [number, number, number] }>();
  const borderWidth = Math.max(
    1,
    Math.round(
      Math.min(image.width, image.height) *
        PREFLIGHT_THRESHOLDS.borderSampleFraction,
    ),
  );
  const { data, width, height, channels } = image;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (
        x >= borderWidth &&
        x < width - borderWidth &&
        y >= borderWidth &&
        y < height - borderWidth
      ) {
        continue;
      }
      const offset = (y * width + x) * channels;
      const rgb: [number, number, number] = [
        data[offset],
        data[offset + 1],
        data[offset + 2],
      ];
      const quantized = rgb
        .map((channel) =>
          Math.floor(channel / PREFLIGHT_THRESHOLDS.backgroundColorQuantization),
        )
        .join(":");
      const entry = bins.get(quantized);
      if (entry) entry.count += 1;
      else bins.set(quantized, { count: 1, rgb });
    }
  }

  return [...bins.values()].sort((left, right) => right.count - left.count)[0]
    ?.rgb ?? [255, 255, 255];
}

function hasContentNearTrimEdge(
  image: PreflightImage,
  printWidthInches: number,
  printHeightInches: number,
  bleedMm: number,
) {
  const background = getDominantBorderColor(image.pixels);
  const bleedInches = bleedMm / 25.4;
  const safeZoneMm = PREFLIGHT_THRESHOLDS.safeZoneMillimeters;
  const totalWidthInches = printWidthInches + 2 * bleedInches;
  const totalHeightInches = printHeightInches + 2 * bleedInches;
  const trimLeft = Math.round(
    (bleedInches / totalWidthInches) * image.pixels.width,
  );
  const trimTop = Math.round(
    (bleedInches / totalHeightInches) * image.pixels.height,
  );
  const safeWidth = Math.max(
    1,
    Math.ceil(
      (safeZoneMm / 25.4 / totalWidthInches) *
        image.pixels.width,
    ),
  );
  const safeHeight = Math.max(
    1,
    Math.ceil(
      (safeZoneMm / 25.4 / totalHeightInches) *
        image.pixels.height,
    ),
  );
  const trimRight = image.pixels.width - trimLeft;
  const trimBottom = image.pixels.height - trimTop;
  const { data, channels, width } = image.pixels;

  for (let y = trimTop; y < trimBottom; y += 1) {
    for (let x = trimLeft; x < trimRight; x += 1) {
      if (
        x - trimLeft >= safeWidth &&
        trimRight - x > safeWidth &&
        y - trimTop >= safeHeight &&
        trimBottom - y > safeHeight
      ) {
        continue;
      }
      const offset = (y * width + x) * channels;
      const distance = Math.sqrt(
        (data[offset] - background[0]) ** 2 +
          (data[offset + 1] - background[1]) ** 2 +
          (data[offset + 2] - background[2]) ** 2,
      );
      if (distance > PREFLIGHT_THRESHOLDS.backgroundColorDistance) return true;
    }
  }
  return false;
}

export function runPreflight(
  image: PreflightImage,
  printSize: PreflightPrintSize,
): PreflightCheck[] {
  const { width, height, unit, bleedMm } = printSize;
  const hasPrintSize = width !== null && height !== null && width > 0 && height > 0;
  const printWidthInches = hasPrintSize ? inches(width, unit) : null;
  const printHeightInches = hasPrintSize ? inches(height, unit) : null;
  const bleedInches = bleedMm / 25.4;
  const checks: PreflightCheck[] = [];

  if (!hasPrintSize || printWidthInches === null || printHeightInches === null) {
    checks.push(
      result(
        "dpi",
        "warn",
        "Resolution",
        "Add the item's print width and height to calculate effective DPI.",
        "Enter the trim size on this line item.",
      ),
    );
    checks.push(
      result(
        "aspect-ratio",
        "warn",
        "Aspect ratio",
        "The artwork and trim ratio cannot be compared until a print size is set.",
        "Enter the trim size on this line item.",
      ),
    );
    checks.push(
      result(
        "bleed",
        "warn",
        "Bleed",
        "Bleed cannot be checked until a print size is set.",
        "Enter the trim size on this line item.",
      ),
    );
    checks.push(
      result(
        "safe-zone",
        "warn",
        "Safe zone",
        "The trim edge cannot be located until a print size is set.",
        "Enter the trim size on this line item.",
      ),
    );
  } else {
    const isLargeBanner =
      printSize.isBanner &&
      printWidthInches > PREFLIGHT_THRESHOLDS.largeBannerWidthFeet * 12;
    const dpi = Math.min(
      image.widthPx / printWidthInches,
      image.heightPx / printHeightInches,
    );
    const passDpi = isLargeBanner
      ? PREFLIGHT_THRESHOLDS.largeBannerPassDpi
      : PREFLIGHT_THRESHOLDS.passDpi;
    const warnDpi = isLargeBanner
      ? PREFLIGHT_THRESHOLDS.largeBannerWarnDpi
      : PREFLIGHT_THRESHOLDS.warnDpi;
    checks.push(
      result(
        "dpi",
        dpi >= passDpi ? "pass" : dpi >= warnDpi ? "warn" : "fail",
        "Resolution",
        isLargeBanner
          ? `Effective resolution is ${Math.round(dpi)} DPI. Large-format banners use a ${PREFLIGHT_THRESHOLDS.largeBannerPassDpi} DPI pass threshold and ${PREFLIGHT_THRESHOLDS.largeBannerWarnDpi} DPI warning threshold.`
          : `Effective resolution is ${Math.round(dpi)} DPI; ${PREFLIGHT_THRESHOLDS.passDpi} DPI or more passes, ${PREFLIGHT_THRESHOLDS.warnDpi}–${PREFLIGHT_THRESHOLDS.passDpi - 1} DPI warns, and below ${PREFLIGHT_THRESHOLDS.warnDpi} DPI fails.`,
        "Supply a higher-resolution image or reduce the print size.",
      ),
    );

    const targetRatio =
      (printWidthInches + 2 * bleedInches) /
      (printHeightInches + 2 * bleedInches);
    const artworkRatio = image.widthPx / image.heightPx;
    const ratioDifference =
      (Math.abs(artworkRatio - targetRatio) / targetRatio) * 100;
    checks.push(
      result(
        "aspect-ratio",
        ratioDifference > PREFLIGHT_THRESHOLDS.aspectFailPercent
          ? "fail"
          : ratioDifference > PREFLIGHT_THRESHOLDS.aspectWarnPercent
            ? "warn"
            : "pass",
        "Aspect ratio",
        `${ratioDifference.toFixed(1)}% difference from the trim ratio${bleedMm > 0 ? " including bleed" : ""}. It may be stretched or cropped to fit.`,
        "Resize or re-export the artwork to match the trim ratio.",
      ),
    );

    const expectedWidthPx =
      (printWidthInches + 2 * bleedInches) * (image.density ?? 0);
    const expectedHeightPx =
      (printHeightInches + 2 * bleedInches) * (image.density ?? 0);
    const widthDifference = expectedWidthPx
      ? Math.abs(image.widthPx - expectedWidthPx) / expectedWidthPx
      : Number.POSITIVE_INFINITY;
    const heightDifference = expectedHeightPx
      ? Math.abs(image.heightPx - expectedHeightPx) / expectedHeightPx
      : Number.POSITIVE_INFINITY;
    const hasBleed =
      image.density !== undefined &&
      widthDifference <= PREFLIGHT_THRESHOLDS.bleedTolerancePercent / 100 &&
      heightDifference <= PREFLIGHT_THRESHOLDS.bleedTolerancePercent / 100;
    checks.push(
      result(
        "bleed",
        hasBleed ? "pass" : "warn",
        "Bleed",
        hasBleed
          ? `Pixel dimensions match the trim size plus ${bleedMm} mm bleed on each side within ${PREFLIGHT_THRESHOLDS.bleedTolerancePercent}%.`
          : "No bleed was detected around the trim; the print may show a white edge after cutting.",
        `Add ${bleedMm} mm of bleed on every side and export at the image's recorded resolution.`,
      ),
    );

    const contentNearEdge = hasContentNearTrimEdge(
      image,
      printWidthInches,
      printHeightInches,
      bleedMm,
    );
    checks.push(
      result(
        "safe-zone",
        contentNearEdge ? "warn" : "pass",
        "Safe zone",
        contentNearEdge
          ? `Non-background content was found within ${PREFLIGHT_THRESHOLDS.safeZoneMillimeters} mm of a trim edge.`
          : `No non-background content was detected within ${PREFLIGHT_THRESHOLDS.safeZoneMillimeters} mm of a trim edge.`,
          `Move text and important artwork at least ${PREFLIGHT_THRESHOLDS.safeZoneMillimeters} mm inside the trim edge.`,
      ),
    );
  }

  checks.push(
    result(
      "color-space",
      image.colorSpace?.toLowerCase().includes("cmyk")
        ? "pass"
        : image.colorSpace?.toLowerCase().includes("rgb")
          ? "warn"
          : "warn",
      "Colour space",
      image.colorSpace?.toLowerCase().includes("cmyk")
        ? "The artwork is in CMYK."
        : image.colorSpace?.toLowerCase().includes("rgb")
          ? "RGB will shift when converted to CMYK; colours may look duller."
          : "The artwork's colour space is unknown.",
      "Convert the artwork to the print shop's CMYK profile and review the proof.",
    ),
  );

  checks.push(
    result(
      "sharpness",
      image.sharpnessVariance < PREFLIGHT_THRESHOLDS.sharpnessWarningVariance
        ? "warn"
        : "pass",
      "Sharpness",
      image.sharpnessVariance < PREFLIGHT_THRESHOLDS.sharpnessWarningVariance
        ? `The image sharpness score is low (${image.sharpnessVariance.toFixed(1)}).`
        : `The image sharpness score is ${image.sharpnessVariance.toFixed(1)}.`,
      "Check the original file at full size before printing.",
    ),
  );

  checks.push(
    result(
      "transparency",
      image.hasAlpha && printSize.isPrintedProduct ? "warn" : "pass",
      "Transparency",
      image.hasAlpha && printSize.isPrintedProduct
        ? "The image has transparency; it will print on white or on the material."
        : "No print-affecting transparency was detected.",
      "Add a background matching the intended material if transparency is not desired.",
    ),
  );

  const largePrint =
    hasPrintSize &&
    printWidthInches !== null &&
    printWidthInches > PREFLIGHT_THRESHOLDS.largePrintWidthInches;
  const smallJpeg =
    image.format === "jpeg" &&
    largePrint &&
    image.sizeBytes < PREFLIGHT_THRESHOLDS.smallJpegBytes;
  const unknownFormat = image.format === "unknown";
  checks.push(
    result(
      "file-sanity",
      smallJpeg || unknownFormat ? "warn" : "pass",
      "File size and format",
      unknownFormat
        ? "The image format could not be identified."
        : smallJpeg
          ? "This JPEG is very small for a large print and may show compression artefacts."
        : `The ${image.format.toUpperCase()} image format is supported.`,
      unknownFormat
        ? "Upload a PNG, JPG, or WebP image."
        : "Use the original export at a higher quality rather than a compressed preview.",
    ),
  );

  return checks;
}

export function getOverallStatus(checks: PreflightCheck[]) {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}
