import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeArtworkImage } from "./analyze";
import {
  getOverallStatus,
  runPreflight,
  type PreflightPrintSize,
} from "./engine";

const fixtureDirectory = path.join(process.cwd(), "public", "demo-artwork");

async function checkFixture(
  filename: string,
  printSize: PreflightPrintSize,
) {
  const buffer = await readFile(path.join(fixtureDirectory, filename));
  const image = await analyzeArtworkImage(buffer);
  return runPreflight(image, printSize);
}

describe("demo artwork fixtures", () => {
  it("passes resolution, ratio, and bleed for the good artwork", async () => {
    const printSize = {
      width: 5,
      height: 3,
      unit: "in",
      bleedMm: 3,
      isBanner: false,
      isPrintedProduct: true,
    } as const;
    const image = await analyzeArtworkImage(
      await readFile(path.join(fixtureDirectory, "good.png")),
    );
    const checks = runPreflight(image, printSize);

    expect(image.colorSpace?.toLowerCase()).toContain("rgb");
    expect(checks.find((check) => check.id === "dpi")?.status).toBe("pass");
    expect(checks.find((check) => check.id === "aspect-ratio")?.status).toBe("pass");
    expect(checks.find((check) => check.id === "bleed")?.status).toBe("pass");
  });

  it("fails the small-pixel 5 by 3 foot banner fixture", async () => {
    const checks = await checkFixture("low-resolution-banner.png", {
      width: 5,
      height: 3,
      unit: "ft",
      bleedMm: 3,
      isBanner: true,
      isPrintedProduct: true,
    });

    expect(checks.find((check) => check.id === "dpi")?.status).toBe("fail");
    expect(getOverallStatus(checks)).toBe("fail");
  });

  it("fails the wrong ratio artwork and warns about edge content", async () => {
    const checks = await checkFixture("wrong-aspect-edge.png", {
      width: 5,
      height: 3,
      unit: "in",
      bleedMm: 3,
      isBanner: false,
      isPrintedProduct: true,
    });

    expect(checks.find((check) => check.id === "aspect-ratio")?.status).toBe("fail");
    expect(checks.find((check) => check.id === "safe-zone")?.status).toBe("warn");
  });

  it.skipIf(!existsSync(path.join(fixtureDirectory, "cmyk.jpg")))(
    "recognizes the optional CMYK JPEG fixture",
    async () => {
    const buffer = await readFile(path.join(fixtureDirectory, "cmyk.jpg"));
    const image = await analyzeArtworkImage(buffer);
    const checks = runPreflight(image, {
      width: 5,
      height: 3,
      unit: "in",
      bleedMm: 3,
      isBanner: false,
      isPrintedProduct: true,
    });

    expect(image.colorSpace?.toLowerCase()).toContain("cmyk");
    expect(checks.find((check) => check.id === "color-space")?.status).toBe("pass");
    },
  );
});
