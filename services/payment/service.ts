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
  return apiClientWithSchema(
    withQuery(paymentEndpoints.subscriptionCurrent(), params),
    subscriptionDetailSchema,
    { method: "GET" },
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
