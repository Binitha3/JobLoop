import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";
import { extractOrderSchema } from "../src/lib/ai/extractOrder";

const baseUrl = process.env.JOBLOOP_URL ?? "http://127.0.0.1:3000";
const email = process.env.DEMO_EMAIL ?? "demo@jobloop.example";
const password = process.env.DEMO_PASSWORD ?? "";
const outputDirectory = path.resolve(process.cwd(), "public", "hero");
const maxBytes = 150 * 1024;
const seededBannerServiceId = "b64d6b57-0c01-4fa0-8c83-0d38b9c80106";
const demoOrderId = "00000000-0000-0000-0000-000000001004";
const screenshotNames = [
  "paste-message.webp",
  "extraction-review.webp",
  "customers-table.webp",
  "new-order.webp",
  "order-detail.webp",
  "quote-section.webp",
  "quote-pdf.webp",
  "order-timeline.webp",
  "public-tracking.webp",
  "dashboard.webp",
];

const sampleExtraction = {
  customer_name: { value: "Aarav Mehta", confidence: "high" },
  phone: { value: "+91 90000 00001", confidence: "high" },
  items: {
    value: [
      {
        service_id: { value: seededBannerServiceId, confidence: "high" },
        raw_text: { value: "Two frontlit banners, 5 by 3 feet", confidence: "high" },
        quantity: { value: 2, confidence: "high" },
        size: { value: "5 × 3 ft", confidence: "high" },
        material: { value: "Frontlit", confidence: "medium" },
        notes: { value: null, confidence: "low" },
      },
    ],
    confidence: "high",
  },
  deadline: { value: "2026-11-15", confidence: "medium" },
  delivery_address: { value: "Indiranagar, Bengaluru", confidence: "medium" },
  missing_fields: [],
  clarifying_questions: [],
};

const quotePdfPreview = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #e9edf1; color: #17212b; font: 14px/1.55 Arial, sans-serif; }
      main { min-height: 100vh; max-width: 860px; margin: 0 auto; padding: 34px 30px; background: #fff; }
      .business { font-size: 19px; font-weight: 700; }
      .muted { color: #687482; }
      h1 { margin: 36px 0 8px; font-size: 30px; }
      section { margin-top: 28px; }
      .label { margin-bottom: 6px; color: #687482; font-size: 11px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
      .meta p, .customer p { margin: 3px 0; }
      table { width: 100%; margin-top: 30px; border-collapse: collapse; text-align: left; }
      th { border-bottom: 1px solid #687482; color: #687482; font-size: 11px; text-transform: uppercase; }
      th, td { padding: 11px 6px; }
      td { border-bottom: 1px solid #e5e9ed; }
      .number { text-align: right; white-space: nowrap; }
      .totals { width: min(100%, 340px); margin: 24px 0 0 auto; }
      .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
      .grand-total { margin-top: 6px; border-top: 1px solid #17212b; font-size: 16px; font-weight: 700; }
      .terms { margin-top: 32px; }
    </style>
  </head>
  <body>
    <main>
      <div class="business">JobLoop Demo Print Studio</div>
      <div class="muted">08055550123 · hello@jobloop.example</div>
      <section class="meta">
        <h1>Quotation</h1>
        <p>Quote number: QT-2610-0003</p>
        <p>Date: 25 Oct 2026</p>
        <p>Valid until: 15 Nov 2026</p>
      </section>
      <section class="customer">
        <div class="label">Prepared for</div>
        <p><strong>Aarav Mehta</strong></p>
        <p>9000000001</p>
      </section>
      <table>
        <thead><tr><th>Service</th><th class="number">Qty</th><th class="number">Unit price</th><th class="number">Amount</th></tr></thead>
        <tbody><tr><td>2 frontlit banners · 5 × 3 ft each</td><td class="number">30</td><td class="number">₹45.00</td><td class="number">₹1,350.00</td></tr></tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><span>₹1,350.00</span></div>
        <div class="total-row"><span>Discount</span><span>−₹100.00</span></div>
        <div class="total-row"><span>GST (18%)</span><span>₹225.00</span></div>
        <div class="total-row"><span>Delivery</span><span>₹150.00</span></div>
        <div class="total-row grand-total"><span>Total</span><span>₹1,625.00</span></div>
      </div>
      <section class="terms">
        <div class="label">Terms</div>
        <p>Quote valid for 14 days. Production begins after artwork approval.</p>
      </section>
    </main>
  </body>
</html>`;

if (!password) {
  throw new Error("Set DEMO_PASSWORD before capturing screenshots.");
}

async function saveScreenshot(page: Page, name: string) {
  const screenshot = await page.screenshot({ type: "png", animations: "disabled" });
  const webp = await sharp(screenshot)
    .resize(960, 1588, { fit: "cover", position: "top" })
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toBuffer();
  if (webp.byteLength >= maxBytes) {
    throw new Error(`${name} is ${webp.byteLength} bytes; it must be below ${maxBytes} bytes.`);
  }
  await writeFile(path.join(outputDirectory, name), webp);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function hideSignedInEmail(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
  });
  const emailLabel = page.locator("header").getByText(email, { exact: true });
  if (await emailLabel.count()) {
    await emailLabel.first().evaluate((element) => {
      (element as HTMLElement).style.display = "none";
    });
  }
}

async function saveAndReportScreenshot(page: Page, name: string) {
  await settle(page);
  await hideSignedInEmail(page);
  await saveScreenshot(page, name);
}

async function open(page: Page, route: string) {
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
  await settle(page);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 480, height: 794 },
      deviceScaleFactor: 2,
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(baseUrl).origin,
    });
    const page = await context.newPage();
    await open(page, "/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in to JobLoop" }).click();
    await page.waitForURL("**/dashboard", {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });

    const sampleResult = extractOrderSchema.safeParse(sampleExtraction);
    if (!sampleResult.success) {
      const invalidFields = sampleResult.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ");
      throw new Error(`The saved extraction sample is invalid: ${invalidFields}.`);
    }

    await page.route("**/api/orders/extract", async (route) => {
      console.info("Using the saved sample extraction result for the hero capture.");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sampleExtraction),
      });
    });

    await open(page, "/orders/from-message");
    await page.getByLabel("Paste the customer's message").fill(
      "Bhai, 2 frontlit banner chahiye, 5 by 3 feet. Indiranagar mein deliver karna.",
    );
    await saveAndReportScreenshot(page, "paste-message.webp");
    await page.getByRole("button", { name: "Extract details" }).click();
    try {
      await page.getByRole("heading", { name: "Review extracted details" }).waitFor({
        timeout: 15_000,
      });
    } catch {
      const errors = (await page.getByRole("alert").allTextContents())
        .map((message) => message.trim())
        .filter(Boolean);
      throw new Error(
        `The extraction review screen did not appear${errors.length ? `: ${errors.join(" ")}` : "."}`,
      );
    }
    await page
      .getByRole("heading", { name: "Review extracted details" })
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await saveAndReportScreenshot(page, "extraction-review.webp");

    await open(page, "/customers");
    await page.getByRole("heading", { name: "Customers" }).waitFor();
    await saveAndReportScreenshot(page, "customers-table.webp");

    await open(page, "/orders/new");
    await page.getByRole("heading", { name: "New order" }).waitFor();
    await page.getByLabel("Choose customer").selectOption({ label: "Aarav Mehta" });
    await page.getByLabel("Service").selectOption({ label: "Vinyl Banners (sq_ft)" });
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel("Print width (optional)").fill("5");
    await page.getByLabel("Print height (optional)").fill("3");
    await page.getByLabel("Size unit").selectOption("ft");
    await page.getByRole("heading", { name: "Line items" }).scrollIntoViewIfNeeded();
    await saveAndReportScreenshot(page, "new-order.webp");

    await open(page, `/orders/${demoOrderId}`);
    await page.getByRole("heading", { name: "Update status" }).scrollIntoViewIfNeeded();
    await saveAndReportScreenshot(page, "order-detail.webp");
    await page.getByRole("heading", { name: "Quote", exact: true }).scrollIntoViewIfNeeded();
    await saveAndReportScreenshot(page, "quote-section.webp");

    const pdfLink = page.getByRole("link", { name: "Download PDF" }).first();
    await pdfLink.waitFor({ timeout: 15_000 });
    const pdfUrl = await pdfLink.getAttribute("href");
    if (!pdfUrl) throw new Error("The seeded demo order has no quote PDF link.");
    const pdfResponse = await context.request.get(new URL(pdfUrl, baseUrl).toString());
    if (!pdfResponse.ok()) throw new Error(`Quote PDF request failed: ${pdfResponse.status()}`);
    const pdfBytes = await pdfResponse.body();
    if (pdfBytes.subarray(0, 4).toString() !== "%PDF") {
      throw new Error("The quote PDF endpoint did not return a valid PDF.");
    }
    await page.setContent(quotePdfPreview, { waitUntil: "networkidle" });
    await settle(page);
    await page.waitForTimeout(1_000);
    await saveAndReportScreenshot(page, "quote-pdf.webp");

    await open(page, `/orders/${demoOrderId}`);
    await page.getByRole("heading", { name: "Status history" }).scrollIntoViewIfNeeded();
    await saveAndReportScreenshot(page, "order-timeline.webp");

    await page.getByRole("button", { name: "Copy tracking link" }).click();
    await page.getByText("Tracking link copied.", { exact: true }).waitFor();
    const copiedTrackingLink = await page.evaluate(() => navigator.clipboard.readText());
    const token = new URL(copiedTrackingLink).pathname.split("/").pop();
    if (!token) throw new Error("Could not read the demo tracking token from the copied link.");
    await open(page, `/track/${token}`);
    await page.getByText("Order progress").waitFor({ timeout: 15_000 });
    await saveAndReportScreenshot(page, "public-tracking.webp");

    await open(page, "/dashboard");
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    await saveAndReportScreenshot(page, "dashboard.webp");

    const report = await Promise.all(
      screenshotNames.map(async (name) => {
        const filePath = path.join(outputDirectory, name);
        const [fileSize, image] = await Promise.all([
          stat(filePath),
          sharp(filePath).metadata(),
        ]);
        if (image.width !== 960 || image.height !== 1588) {
          throw new Error(`${name} has unexpected dimensions ${image.width}x${image.height}.`);
        }
        if (fileSize.size >= maxBytes) {
          throw new Error(`${name} is ${fileSize.size} bytes; it must be below ${maxBytes} bytes.`);
        }
        return {
          file: name,
          size: `${(fileSize.size / 1024).toFixed(1)} KB`,
          status: "OK",
        };
      }),
    );
    console.table(report);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("Unable to capture the JobLoop hero screenshots.", error);
  process.exitCode = 1;
});
