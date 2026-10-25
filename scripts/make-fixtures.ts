import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.join(process.cwd(), "public", "demo-artwork");

async function createImage(
  filename: string,
  width: number,
  height: number,
  content: string,
) {
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`,
  );
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite([{ input: svg }])
    .withMetadata({ density: 300 })
    .png()
    .toFile(path.join(outputDirectory, filename));
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const bleedInches = 2 * (3 / 25.4);
  const goodWidth = Math.round((5 + bleedInches) * 300);
  const goodHeight = Math.round((3 + bleedInches) * 300);
  await createImage(
    "good.png",
    goodWidth,
    goodHeight,
    `<rect x="100" y="100" width="${goodWidth - 200}" height="${goodHeight - 200}" fill="#2563eb"/><circle cx="${goodWidth / 2}" cy="${goodHeight / 2}" r="120" fill="#facc15"/>`,
  );

  await createImage(
    "low-resolution-banner.png",
    200,
    120,
    '<rect x="20" y="15" width="160" height="90" fill="#15803d"/>',
  );

  await createImage(
    "wrong-aspect-edge.png",
    1800,
    900,
    '<rect x="0" y="0" width="900" height="900" fill="#dc2626"/><rect x="950" y="250" width="700" height="400" fill="#1d4ed8"/>',
  );

  const cmykFixture = path.join(outputDirectory, "cmyk.jpg");
  await rm(cmykFixture, { force: true });
  try {
    await sharp({
      create: {
        width: 1600,
        height: 1000,
        channels: 3,
        background: "#ffffff",
      },
    })
      .withMetadata({ density: 300 })
      .withIccProfile("cmyk")
      .jpeg()
      .toFile(cmykFixture);
    console.info("Created optional CMYK JPEG fixture.");
  } catch (error) {
    console.info(
      `Sharp could not create the optional CMYK JPEG fixture: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.info(`Created demo artwork in ${outputDirectory}.`);
}

main().catch((error: unknown) => {
  console.error("Unable to create artwork fixtures.", error);
  process.exitCode = 1;
});
