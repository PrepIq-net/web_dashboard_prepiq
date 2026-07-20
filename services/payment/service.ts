import { z } from "zod";
import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { paymentEndpoints } from "@/services/payment/endpoints";
import {
  addOnSchema,
  attachSubscriptionAddOnPayloadSchema,
  cancelSubscriptionPayloadSchema,
  completePaymentPayloadSchema,
  createPaymentPayloadSchema,
  createSubscriptionPayloadSchema,
  createSubscriptionQuoteRequestPayloadSchema,
  detachSubscriptionAddOnPayloadSchema,
  failPaymentPayloadSchema,
  invoiceDownloadResponseSchema,
  invoiceSchema,
  paymentActionResponseSchema,
  paymentCheckoutPayloadSchema,
  paymentCheckoutResponseSchema,
  paymentSchema,
  subscriptionActivationRequestSchema,
  subscriptionDetailSchema,
  subscriptionListSchema,
  subscriptionPlanSchema,
  subscriptionPlanPricingResponseSchema,
  subscriptionQuoteRequestSchema,
  type AttachSubscriptionAddOnPayload,
  type CancelSubscriptionPayload,
  type CompletePaymentPayload,
  type CreatePaymentPayload,
  type CreateSubscriptionPayload,
  type CreateSubscriptionQuoteRequestPayload,
  type DetachSubscriptionAddOnPayload,
  type FailPaymentPayload,
  type PaymentCheckoutPayload,
} from "@/services/payment/types";

type QueryValue = string | number | boolean | null | undefined;

function withQuery(
  endpoint: string,
  params?: Record<string, QueryValue>,
): string {
  if (!params) return endpoint;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

function listResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.union([
    z.array(itemSchema),
    z.object({ results: z.array(itemSchema) }),
    z.object({
      data: z.object({
        results: z.array(itemSchema),
      }),
    }),
  ]);
}

function unwrapListResponse<T>(
  response:
    | T[]
    | { results: T[] }
    | {
        data: {
          results: T[];
        };
      },
) {
  if (Array.isArray(response)) return response;
  if ("results" in response) return response.results;
  return response.data.results;
}

const plansPricingResponseSchema = z.union([
  subscriptionPlanPricingResponseSchema,
  z.object({
    data: z.object({
      plans: z.array(subscriptionPlanSchema),
      recommendation:
        subscriptionPlanPricingResponseSchema.shape.recommendation,
    }),
  }),
]);

export async function getSubscriptionPlans() {
  const response = await apiClientWithSchema(
    paymentEndpoints.plans(),
    listResponseSchema(subscriptionPlanSchema),
    { method: "GET" },
  );

  return unwrapListResponse(response);
}

export async function getSubscriptionPlanPricing(params?: SubscriptionQuery) {
  const response = await apiClientWithSchema(
    withQuery(paymentEndpoints.plansPricing(), params),
    plansPricingResponseSchema,
    { method: "GET" },
  );

  if ("plans" in response) return response;
  return response.data;
}

const fxRatesResponseSchema = z.object({
  base: z.string(),
  rates: z.record(z.string(), z.string()),
});
export type FxRates = z.infer<typeof fxRatesResponseSchema>;

export async function getFxRates() {
  return apiClientWithSchema(paymentEndpoints.fxRates(), fxRatesResponseSchema, {
    method: "GET",
  });
}

export type SubscriptionQuery = {
  branch_id?: string;
};

export async function listSubscriptions(params?: SubscriptionQuery) {
  const response = await apiClientWithSchema(
    withQuery(paymentEndpoints.subscriptions(), params),
    listResponseSchema(subscriptionListSchema),
    { method: "GET" },
  );

  return unwrapListResponse(response);
}

export async function getSubscriptionDetail(subscriptionId: string) {
  return apiClientWithSchema(
    paymentEndpoints.subscriptionDetail(subscriptionId),
    subscriptionDetailSchema,
    { method: "GET" },
  );
}

export async function getCurrentSubscription(params?: SubscriptionQuery) {
  const url = withQuery(paymentEndpoints.subscriptionCurrent(), params);
  return apiClientWithSchema(url, subscriptionDetailSchema, { method: "GET" });
}

/**
 * Ask the branch's billing owners to activate a subscription. The only action
 * available to a member who cannot pay for the branch themselves.
 */
export async function requestSubscriptionActivation(params?: {
  branch_id?: string;
}) {
  return apiClientWithSchema(
    paymentEndpoints.subscriptionRequestActivation(),
    subscriptionActivationRequestSchema,
    { method: "POST", body: params?.branch_id ? { branch_id: params.branch_id } : {} },
  );
}

export async function createSubscription(payload: CreateSubscriptionPayload) {
  const body = createSubscriptionPayloadSchema.parse(payload);

  return apiClientWithSchema(
    paymentEndpoints.subscriptions(),
    subscriptionDetailSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function cancelSubscription(
  subscriptionId: string,
  payload: CancelSubscriptionPayload = {},
) {
  const body = cancelSubscriptionPayloadSchema.parse(payload);

  return apiClientWithSchema(
    paymentEndpoints.subscriptionCancel(subscriptionId),
    subscriptionDetailSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function activateSubscription(subscriptionId: string) {
  return apiClientWithSchema(
    paymentEndpoints.subscriptionActivate(subscriptionId),
    subscriptionDetailSchema,
    { method: "POST" },
  );
}

export async function getAvailableSubscriptionAddOns(subscriptionId: string) {
  const response = await apiClientWithSchema(
    paymentEndpoints.subscriptionAvailableAddOns(subscriptionId),
    listResponseSchema(addOnSchema),
    { method: "GET" },
  );

  return unwrapListResponse(response);
}

export async function attachSubscriptionAddOn(
  subscriptionId: string,
  payload: AttachSubscriptionAddOnPayload,
) {
  const body = attachSubscriptionAddOnPayloadSchema.parse(payload);

  return apiClientWithSchema(
    paymentEndpoints.subscriptionAttachAddOn(subscriptionId),
    z.unknown(),
    {
      method: "POST",
      body,
    },
  );
}

export async function detachSubscriptionAddOn(
  subscriptionId: string,
  payload: DetachSubscriptionAddOnPayload,
) {
  const body = detachSubscriptionAddOnPayloadSchema.parse(payload);

  return apiClient<void>(
    paymentEndpoints.subscriptionDetachAddOn(subscriptionId),
    {
      method: "POST",
      body,
    },
  );
}

export async function listPayments(params?: SubscriptionQuery) {
  const response = await apiClientWithSchema(
    withQuery(paymentEndpoints.payments(), params),
    listResponseSchema(paymentSchema),
    { method: "GET" },
  );

  return unwrapListResponse(response);
}

export async function getPaymentDetail(paymentId: string) {
  return apiClientWithSchema(
    paymentEndpoints.paymentDetail(paymentId),
    paymentSchema,
    { method: "GET" },
  );
}

export async function createPayment(payload: CreatePaymentPayload) {
  const body = createPaymentPayloadSchema.parse(payload);

  return apiClientWithSchema(paymentEndpoints.payments(), paymentSchema, {
    method: "POST",
    body,
  });
}

export type PaymentHistoryQuery = {
  status?: string;
  type?: string;
  branch_id?: string;
};

export async function listPaymentHistory(params?: PaymentHistoryQuery) {
  const response = await apiClientWithSchema(
    withQuery(paymentEndpoints.paymentsHistory(), params),
    listResponseSchema(paymentSchema),
    { method: "GET" },
  );

  return unwrapListResponse(response);
}

export async function checkoutPayment(payload: PaymentCheckoutPayload) {
  const body = paymentCheckoutPayloadSchema.parse(payload);

  return apiClientWithSchema(
    paymentEndpoints.paymentsCheckout(),
    paymentCheckoutResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function completePayment(
  paymentId: string,
  payload: CompletePaymentPayload,
) {
  const body = completePaymentPayloadSchema.parse(payload);

  return apiClientWithSchema(
    paymentEndpoints.paymentComplete(paymentId),
    paymentActionResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function failPayment(
  paymentId: string,
  payload: FailPaymentPayload,
) {
  const body = failPaymentPayloadSchema.parse(payload);

  return apiClientWithSchema(
    paymentEndpoints.paymentFail(paymentId),
    paymentActionResponseSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function listSubscriptionQuoteRequests() {
  const response = await apiClientWithSchema(
    paymentEndpoints.quoteRequests(),
    listResponseSchema(subscriptionQuoteRequestSchema),
    { method: "GET" },
  );

  return unwrapListResponse(response);
}

export async function createSubscriptionQuoteRequest(
  payload: CreateSubscriptionQuoteRequestPayload,
) {
  const body = createSubscriptionQuoteRequestPayloadSchema.parse(payload);

  return apiClientWithSchema(
    paymentEndpoints.quoteRequests(),
    subscriptionQuoteRequestSchema,
    {
      method: "POST",
      body,
    },
  );
}

export async function listInvoices(params?: SubscriptionQuery) {
  const response = await apiClientWithSchema(
    withQuery(paymentEndpoints.invoices(), params),
    listResponseSchema(invoiceSchema),
    { method: "GET" },
  );

  return unwrapListResponse(response);
}

export async function getInvoiceDetail(invoiceId: string) {
  return apiClientWithSchema(
    paymentEndpoints.invoiceDetail(invoiceId),
    invoiceSchema,
    { method: "GET" },
  );
}

export async function downloadInvoice(invoiceId: string) {
  return apiClientWithSchema(
    paymentEndpoints.invoiceDownload(invoiceId),
    invoiceDownloadResponseSchema,
    { method: "GET" },
  );
}

function proxyUrl(apiEndpoint: string): string {
  const withoutApiPrefix = apiEndpoint.replace(/^\/api(?=\/)/, "");
  return `/api/proxy${withoutApiPrefix}`;
}

async function triggerBlobDownload(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export async function downloadInvoicePDF(invoiceId: string): Promise<void> {
  await triggerBlobDownload(
    proxyUrl(paymentEndpoints.invoiceDownload(invoiceId)),
    `invoice-${invoiceId}.pdf`,
  );
}

export async function downloadBillingReport(): Promise<void> {
  await triggerBlobDownload(
    proxyUrl(paymentEndpoints.invoiceBillingReport()),
    `billing-report.pdf`,
  );
}
