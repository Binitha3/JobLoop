import { z } from "zod";

const trackingStatusSchema = z.enum([
  "enquiry",
  "quoted",
  "approved",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
]);

const publicTrackingDataSchema = z.object({
  business_name: z.string(),
  business_phone: z.string().nullable(),
  job_number: z.string(),
  customer_first_name: z.string(),
  status: trackingStatusSchema,
  timeline: z.array(
    z.object({
      status: trackingStatusSchema,
      date: z.string(),
    }),
  ),
  due_date: z.string().nullable(),
  line_items: z.array(
    z.object({
      service: z.string(),
      quantity: z.number(),
    }),
  ),
  latest_quote_total: z.number().nullable(),
  amount_paid: z.number(),
  balance_due: z.number(),
});

export type PublicTrackingData = z.infer<typeof publicTrackingDataSchema>;

export function sanitizePublicTrackingData(
  value: unknown,
): PublicTrackingData | null {
  const result = publicTrackingDataSchema.safeParse(value);
  return result.success ? result.data : null;
}
