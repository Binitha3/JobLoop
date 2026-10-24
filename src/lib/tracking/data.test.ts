import { describe, expect, it } from "vitest";
import { sanitizePublicTrackingData } from "./public-data";

describe("sanitizePublicTrackingData", () => {
  it("returns only public tracking fields and strips internal fields", () => {
    const result = sanitizePublicTrackingData({
      business_name: "Paper & Press",
      business_phone: "+911234567890",
      job_number: "JOB-260101-ABC123",
      customer_first_name: "Asha",
      status: "in_progress",
      timeline: [{ status: "enquiry", date: "2026-10-20" }],
      due_date: "2026-10-30",
      line_items: [{ service: "Business Cards", quantity: 100 }],
      latest_quote_total: 2500,
      amount_paid: 500,
      balance_due: 2000,
      id: "internal-order-id",
      workspace_id: "internal-workspace-id",
      customer_id: "internal-customer-id",
      internal_notes: "Do not disclose",
      reason: "Private cancellation reason",
      staff_name: "Private staff name",
      other_orders: [{ job_number: "private-job" }],
    });

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("workspace_id");
    expect(result).not.toHaveProperty("customer_id");
    expect(result).not.toHaveProperty("internal_notes");
    expect(result).not.toHaveProperty("reason");
    expect(result).not.toHaveProperty("staff_name");
    expect(JSON.stringify(result)).not.toContain("Do not disclose");
    expect(JSON.stringify(result)).not.toContain("Private staff name");
    expect(JSON.stringify(result)).not.toContain("internal-order-id");
  });

  it("returns null for malformed tracking data", () => {
    expect(
      sanitizePublicTrackingData({
        job_number: "JOB-1",
        internal_notes: "not public",
      }),
    ).toBeNull();
  });
});
