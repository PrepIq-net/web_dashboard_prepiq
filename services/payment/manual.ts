/**
 * Paying by bank transfer or mobile money.
 *
 * Card checkout is not available to every customer, and some prefer not to use
 * it. This flow lets them pay into one of our accounts and send proof; a PrepIQ
 * admin verifies the money arrived and activates the subscription, which issues
 * exactly the same invoice and receipt a card payment would.
 *
 * Nothing here changes a subscription. Submitting is a claim awaiting review.
 */

import { z } from "zod";

import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { paymentEndpoints } from "@/services/payment/endpoints";

export const amountHintSchema = z.object({
  currency: z.string(),
  amount: z.string(),
  // Rates move, so a converted figure is guidance rather than a number we
  // would hold anyone to. The UI has to say so.
  is_estimate: z.boolean(),
});

export const paymentInstructionSchema = z.object({
  id: z.string(),
  method: z.string(),
  method_label: z.string(),
  label: z.string(),
  account_details: z.record(z.string(), z.string()),
  instructions: z.string(),
  currency: z.string(),
  is_active: z.boolean(),
  display_order: z.number(),
  amount_hint: amountHintSchema.nullable().optional(),
});

export const paymentMethodOptionsSchema = z.object({
  online: z.object({ enabled: z.boolean() }),
  offline: z.object({
    enabled: z.boolean(),
    review_hours: z.number(),
    note: z.string(),
    instructions: z.array(paymentInstructionSchema),
  }),
});

export const manualPaymentRequestSchema = z.object({
  id: z.string(),
  reference_code: z.string(),
  organization_name: z.string(),
  branch: z.string(),
  branch_name: z.string(),
  plan_name: z.string(),
  billing_cycle: z.string(),
  method: z.string(),
  method_label: z.string(),
  declared_amount: z.string(),
  declared_currency: z.string(),
  expected_amount: z.string(),
  payer_reference: z.string(),
  proof_url: z.string().nullable(),
  customer_note: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  status_label: z.string(),
  review_note: z.string(),
  reviewed_at: z.string().nullable(),
  invoice_number: z.string().nullable(),
  created_at: z.string(),
});

export type PaymentInstruction = z.infer<typeof paymentInstructionSchema>;
export type PaymentMethodOptions = z.infer<typeof paymentMethodOptionsSchema>;
export type ManualPaymentRequest = z.infer<typeof manualPaymentRequestSchema>;

/**
 * What checkout is allowed to offer right now, and where to send an offline
 * payment. Passing the plan lets the backend tell each account how much to send
 * in its own currency, so nobody has to convert $49 into shillings themselves.
 */
export async function getPaymentMethodOptions(params?: {
  planId?: string;
  billingCycle?: string;
}) {
  const query = new URLSearchParams();
  if (params?.planId) query.set("plan_id", params.planId);
  if (params?.billingCycle) query.set("billing_cycle", params.billingCycle);
  return apiClientWithSchema(
    paymentEndpoints.paymentMethods(query.toString()),
    paymentMethodOptionsSchema,
    { method: "GET" },
  );
}

export async function listManualPaymentRequests() {
  const response = await apiClientWithSchema(
    paymentEndpoints.manualRequests(),
    z.object({ results: z.array(manualPaymentRequestSchema) }),
    { method: "GET" },
  );
  return response.results;
}

export interface SubmitManualPaymentInput {
  branchId: string;
  planId: string;
  billingCycle: string;
  method: string;
  declaredAmount: string;
  declaredCurrency: string;
  payerReference?: string;
  payerName?: string;
  payerPhone?: string;
  customerNote?: string;
  proofFile?: File | null;
}

export async function submitManualPayment(input: SubmitManualPaymentInput) {
  // multipart rather than JSON so the receipt image rides along in the same
  // request — a two-step "create then upload" would leave claims with no proof
  // whenever the second call failed.
  const form = new FormData();
  form.append("branch_id", input.branchId);
  form.append("plan_id", input.planId);
  form.append("billing_cycle", input.billingCycle);
  form.append("method", input.method);
  form.append("declared_amount", input.declaredAmount);
  form.append("declared_currency", input.declaredCurrency);
  if (input.payerReference) form.append("payer_reference", input.payerReference);
  if (input.payerName) form.append("payer_name", input.payerName);
  if (input.payerPhone) form.append("payer_phone", input.payerPhone);
  if (input.customerNote) form.append("customer_note", input.customerNote);
  if (input.proofFile) form.append("proof_file", input.proofFile);

  return apiClient<ManualPaymentRequest>(paymentEndpoints.manualRequests(), {
    method: "POST",
    body: form,
  });
}

export async function withdrawManualPayment(requestId: string) {
  return apiClient<void>(paymentEndpoints.manualRequestDetail(requestId), {
    method: "DELETE",
  });
}
