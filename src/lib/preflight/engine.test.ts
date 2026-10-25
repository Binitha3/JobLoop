import { describe, expect, it } from "vitest";
import {
  getOverallStatus,
  runPreflight,
  type PreflightImage,
  type PreflightPrintSize,
} from "./engine";

function createImage(overrides: Partial<PreflightImage> = {}): PreflightImage {
  const width = 1571;
  const height = 971;
  const sampleWidth = 100;
  const sampleHeight = 64;
  const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = 255;
  }
  return {
    widthPx: width,
    heightPx: height,
    sizeBytes: 2_000_000,
    format: "png",
    colorSpace: "srgb",
    hasAlpha: false,
    density: 300,
    sharpnessVariance: 100,
    pixels: { data: pixels, width: sampleWidth, height: sampleHeight, channels: 4 },
    ...overrides,
  };
}

const printSize: PreflightPrintSize = {
  width: 5,
  height: 3,
  unit: "in",
  bleedMm: 3,
  isBanner: false,
  isPrintedProduct: true,
};

describe("runPreflight", () => {
  it("passes resolution and bleed for a correctly sized high-resolution image", () => {
    const checks = runPreflight(createImage(), printSize);

    expect(checks.find((check) => check.id === "dpi")?.status).toBe("pass");
    expect(checks.find((check) => check.id === "bleed")?.status).toBe("pass");
  });

  it("uses the large-format thresholds only for wide banners", () => {
    const image = createImage({
      widthPx: 3300,
      heightPx: 1980,
      density: undefined,
    });
    const banner = runPreflight(image, {
      ...printSize,
      width: 5,
      height: 3,
      unit: "ft",
      isBanner: true,
    });
    const regular = runPreflight(image, {
      ...printSize,
      width: 5,
      height: 3,
      unit: "ft",
      isBanner: false,
    });

    expect(banner.find((check) => check.id === "dpi")?.status).toBe("warn");
    expect(banner.find((check) => check.id === "dpi")?.detail).toContain(
      "Large-format banners",
    );
    expect(regular.find((check) => check.id === "dpi")?.status).toBe("fail");
  });

  it.each([
    [150, "pass"],
    [149, "warn"],
    [100, "warn"],
    [99, "fail"],
  ] as const)("uses the regular-format DPI boundary at %i", (dpi, status) => {
    const checks = runPreflight(
      createImage({
        widthPx: dpi * 5,
        heightPx: dpi * 3,
        density: undefined,
      }),
      { ...printSize, bleedMm: 0 },
    );
    expect(checks.find((check) => check.id === "dpi")?.status).toBe(status);
  });

  it.each([
    [72, "pass"],
    [71, "warn"],
    [50, "warn"],
    [49, "fail"],
  ] as const)("uses the wide-banner DPI boundary at %i", (dpi, status) => {
    const checks = runPreflight(
      createImage({
        widthPx: dpi * 60,
        heightPx: dpi * 36,
        density: undefined,
      }),
      {
        ...printSize,
        width: 5,
        height: 3,
        unit: "ft",
        bleedMm: 0,
        isBanner: true,
      },
    );
    expect(checks.find((check) => check.id === "dpi")?.status).toBe(status);
  });

  it("fails an aspect ratio mismatch above ten percent", () => {
    const checks = runPreflight(
      createImage({ widthPx: 1800, heightPx: 900 }),
      printSize,
    );
    const aspect = checks.find((check) => check.id === "aspect-ratio");

    expect(aspect?.status).toBe("fail");
    expect(aspect?.detail).toContain("stretched or cropped");
  });

  it("warns for RGB, unknown colour space, transparency, and low sharpness", () => {
    const checks = runPreflight(
      createImage({
        colorSpace: "srgb",
        hasAlpha: true,
        sharpnessVariance: 2,
      }),
      printSize,
    );

    expect(checks.find((check) => check.id === "color-space")?.detail).toContain(
      "colours may look duller",
    );
    expect(checks.find((check) => check.id === "transparency")?.status).toBe("warn");
    expect(checks.find((check) => check.id === "sharpness")?.status).toBe("warn");
    expect(getOverallStatus(checks)).toBe("warn");
  });

  it("warns when print dimensions have not been provided", () => {
    const checks = runPreflight(createImage(), {
      ...printSize,
      width: null,
      height: null,
    });

    expect(checks.find((check) => check.id === "dpi")?.status).toBe("warn");
    expect(checks.find((check) => check.id === "aspect-ratio")?.status).toBe("warn");
  });

  it("warns when a small JPEG is used for a large print", () => {
    const checks = runPreflight(
      createImage({
        widthPx: 300,
        heightPx: 180,
        sizeBytes: 100_000,
        format: "jpeg",
        density: undefined,
      }),
      {
        ...printSize,
        width: 5,
        height: 3,
        unit: "ft",
        isBanner: true,
      },
    );

    expect(checks.find((check) => check.id === "file-sanity")?.status).toBe("warn");
  });
});
