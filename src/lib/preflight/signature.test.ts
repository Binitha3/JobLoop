import { describe, expect, it } from "vitest";
import { detectArtworkFormat } from "./signature";

describe("detectArtworkFormat", () => {
  it.each([
    [
      "PNG",
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      { mime: "image/png", format: "png" },
    ],
    [
      "JPEG",
      Buffer.from([255, 216, 255, 0]),
      { mime: "image/jpeg", format: "jpeg" },
    ],
    [
      "WebP",
      Buffer.from("RIFFxxxxWEBP", "ascii"),
      { mime: "image/webp", format: "webp" },
    ],
  ])("detects %s by its signature", (_label, bytes, expected) => {
    expect(detectArtworkFormat(bytes)).toEqual(expected);
  });

  it("does not trust a filename or declared MIME type", () => {
    expect(detectArtworkFormat(Buffer.from("not an image"))).toBeNull();
    expect(detectArtworkFormat(Buffer.from("%PDF-1.7"))).toBeNull();
  });
});
