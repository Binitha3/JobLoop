import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.JOBLOOP_URL ?? "http://127.0.0.1:3000";
const email = process.env.DEMO_EMAIL ?? "demo@jobloop.local";
const password = process.env.DEMO_PASSWORD ?? "";
const outputDirectory = path.resolve(process.cwd(), "public", "hero");
const maxBytes = 150 * 1024;
const seededBannerServiceId = "00000000-0000-0000-0000-000000000103";
const demoOrderId = "00000000-0000-0000-0000-000000001004";

if (!password) {
  throw new Error("Set DEMO_PASSWORD to the password for the seeded demo workspace.");
}

async function saveScreenshot(page: Page, name: string) {
  const screenshot = await page.screenshot({ type: "png", animations: "disabled" });
  const webp = await sharp(screenshot)
    .resize(960, 1588, { fit: "cover", position: "top" })
    .webp({ quality: 80, effort: 9, smartSubsample: true })
    .toBuffer();
  if (webp.byteLength >= maxBytes) {
    throw new Error(`${name} is ${webp.byteLength} bytes; it must be below ${maxBytes} bytes.`);
  }
  await writeFile(path.join(outputDirectory, name), webp);
  console.log(`Saved ${name} (${webp.byteLength} bytes)`);
}

async function open(page: Page, route: string) {
  await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 480, height: 794 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await open(page, "/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in to JobLoop" }).click();
    await page.waitForURL("**/dashboard", { timeout: 30_000 });

    await page.route("**/api/orders/extract", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
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
        }),
      });
    });

    await open(page, "/orders/from-message");
    await page.getByLabel("Paste the customer's message").fill(
      "Bhai, 2 frontlit banner chahiye, 5 by 3 feet. Indiranagar mein deliver karna.",
    );
    await saveScreenshot(page, "paste-message.webp");
    await page.getByRole("button", { name: "Extract details" }).click();
    await page.getByRole("heading", { name: "Review extracted details" }).waitFor();
    await saveScreenshot(page, "extraction-review.webp");

    await open(page, "/customers");
    await page.getByRole("heading", { name: "Customers" }).waitFor();
    await saveScreenshot(page, "customers-table.webp");

    await open(page, "/orders/new");
    await page.getByRole("heading", { name: "New order" }).waitFor();
    await page.getByLabel("Choose customer").selectOption({ label: "Aarav Mehta" });
    await page.getByLabel("Service").selectOption({ label: "Vinyl Banners (sq_ft)" });
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel("Print width (optional)").fill("5");
    await page.getByLabel("Print height (optional)").fill("3");
    await page.getByLabel("Size unit").selectOption("ft");
    await page.getByRole("heading", { name: "Line items" }).scrollIntoViewIfNeeded();
    await saveScreenshot(page, "new-order.webp");

    await open(page, `/orders/${demoOrderId}`);
    await page.getByRole("heading", { name: "Update status" }).scrollIntoViewIfNeeded();
    await saveScreenshot(page, "order-detail.webp");
    await page.getByRole("heading", { name: "Quote", exact: true }).scrollIntoViewIfNeeded();
    await saveScreenshot(page, "quote-section.webp");

    const pdfLink = page.getByRole("link", { name: "Download PDF" }).first();
    await pdfLink.waitFor({ timeout: 15_000 });
    const pdfUrl = await pdfLink.getAttribute("href");
    if (!pdfUrl) throw new Error("The seeded demo order has no quote PDF link.");
    const pdfResponse = await context.request.get(new URL(pdfUrl, baseUrl).toString());
    if (!pdfResponse.ok()) throw new Error(`Quote PDF request failed: ${pdfResponse.status()}`);
    const pdfBytes = await pdfResponse.body();
    await page.route(new URL(pdfUrl, baseUrl).toString(), async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/pdf", "content-disposition": "inline" },
        body: pdfBytes,
      });
    });
    await page.goto(new URL(pdfUrl, baseUrl).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_000);
    await saveScreenshot(page, "quote-pdf.webp");

    await open(page, `/orders/${demoOrderId}`);
    await page.getByRole("heading", { name: "Status history" }).scrollIntoViewIfNeeded();
    await saveScreenshot(page, "order-timeline.webp");

    const trackingResponse = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      response.request().headers()["next-action"] !== undefined,
    );
    await page.getByRole("button", { name: "Regenerate link" }).click();
    const actionText = await (await trackingResponse).text();
    const token = actionText.match(/"token"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1];
    if (!token) throw new Error("Could not read the generated demo tracking token from the action response.");
    await open(page, `/track/${token}`);
    await page.getByText("Order progress").waitFor({ timeout: 15_000 });
    await saveScreenshot(page, "public-tracking.webp");

    await open(page, "/dashboard");
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    await saveScreenshot(page, "dashboard.webp");
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("Unable to capture the JobLoop hero screenshots.", error);
  process.exitCode = 1;
});
