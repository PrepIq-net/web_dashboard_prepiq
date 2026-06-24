"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateSubscription,
  attachSubscriptionAddOn,
  cancelSubscription,
  checkoutPayment,
  completePayment,
  createPayment,
  createSubscription,
  createSubscriptionQuoteRequest,
  detachSubscriptionAddOn,
  downloadInvoice,
  failPayment,
  getAvailableSubscriptionAddOns,
  getCurrentSubscription,
  getInvoiceDetail,
  getPaymentDetail,
  getSubscriptionDetail,
  getSubscriptionPlanPricing,
  getSubscriptionPlans,
  listInvoices,
  listPaymentHistory,
  listPayments,
  listSubscriptionQuoteRequests,
  listSubscriptions,
  type PaymentHistoryQuery,
  type SubscriptionQuery,
} from "./service";
import type {
  AttachSubscriptionAddOnPayload,
  CancelSubscriptionPayload,
  CompletePaymentPayload,
  CreatePaymentPayload,
  CreateSubscriptionPayload,
  CreateSubscriptionQuoteRequestPayload,
  DetachSubscriptionAddOnPayload,
  FailPaymentPayload,
  PaymentCheckoutPayload,
} from "@/services/payment/types";

export const paymentQueryKeys = {
  root: ["payment"] as const,

  plans: () => [...paymentQueryKeys.root, "plans"] as const,
  plansPricing: (params?: SubscriptionQuery) =>
    [...paymentQueryKeys.root, "plans-pricing", params] as const,

  subscriptions: (params?: SubscriptionQuery) =>
    [...paymentQueryKeys.root, "subscriptions", params] as const,
  subscriptionDetail: (subscriptionId: string) =>
    [...paymentQueryKeys.subscriptions(), subscriptionId] as const,
  currentSubscription: (params?: SubscriptionQuery) =>
    [...paymentQueryKeys.subscriptions(), "current", params] as const,
  subscriptionAddOns: (subscriptionId: string) =>
    [
      ...paymentQueryKeys.subscriptionDetail(subscriptionId),
      "add-ons",
    ] as const,

  payments: (params?: SubscriptionQuery) =>
    [...paymentQueryKeys.root, "payments", params] as const,
  paymentDetail: (paymentId: string) =>
    [...paymentQueryKeys.payments(), paymentId] as const,
  paymentHistory: (params?: PaymentHistoryQuery) =>
    [
      ...paymentQueryKeys.payments(),
      "history",
      params?.status ?? "",
      params?.type ?? "",
    ] as const,

  quoteRequests: () => [...paymentQueryKeys.root, "quote-requests"] as const,

  invoices: (params?: SubscriptionQuery) =>
    [...paymentQueryKeys.root, "invoices", params] as const,
  invoiceDetail: (invoiceId: string) =>
    [...paymentQueryKeys.invoices(), invoiceId] as const,
};

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: paymentQueryKeys.plans(),
    queryFn: getSubscriptionPlans,
  });
}

export function useSubscriptionPlanPricing(params?: SubscriptionQuery) {
  return useQuery({
    queryKey: paymentQueryKeys.plansPricing(params),
    queryFn: () => getSubscriptionPlanPricing(params),
  });
}

export function useSubscriptions(params?: SubscriptionQuery) {
  return useQuery({
    queryKey: paymentQueryKeys.subscriptions(params),
    queryFn: () => listSubscriptions(params),
  });
}

export function useSubscriptionDetail(subscriptionId: string) {
  return useQuery({
    queryKey: paymentQueryKeys.subscriptionDetail(subscriptionId),
    queryFn: () => getSubscriptionDetail(subscriptionId),
    enabled: Boolean(subscriptionId),
  });
}

export function useCurrentSubscription(params?: SubscriptionQuery) {
  return useQuery({
    queryKey: paymentQueryKeys.currentSubscription(params),
    queryFn: () => getCurrentSubscription(params),
  });
}

const PLAN_TIER_MAP: Record<string, number> = {
  CORE: 1,
  INTELLIGENCE: 2,
  COMMAND: 3,
};

/**
 * Returns subscription tier + block state for a specific branch.
 * branchId must be the branch the current page is operating on.
 * Without branchId the backend falls back to the org's primary branch.
 */
export function useSubscriptionTier(branchId?: string) {
  const params = branchId ? ({ branch_id: branchId } satisfies SubscriptionQuery) : undefined;
  // retry:false so a 404 (no active subscription) is detected immediately, not after 3 retries
  const { data, isLoading, isError } = useQuery({
    queryKey: paymentQueryKeys.currentSubscription(params),
    queryFn: () => getCurrentSubscription(params),
    retry: false,
    throwOnError: false,
  });
  const planType = data?.plan?.plan_type?.toUpperCase() ?? null;
  const tier =
    data?.is_currently_active && planType
      ? (PLAN_TIER_MAP[planType] ?? 0)
      : 0;

  const loaded = !isLoading;
  const hasNoSubscription = loaded && (!data || isError);
  const isExpired = loaded && Boolean(data && !data.is_currently_active && !data.is_trial);
  const isTrialExpired = loaded && Boolean(data && !data.is_currently_active && data.is_trial);
  const shouldBlockAccess = hasNoSubscription || isExpired || isTrialExpired;
  const gateVariant: "none" | "expired" | "trial_expired" = hasNoSubscription
    ? "none"
    : isTrialExpired
      ? "trial_expired"
      : "expired";

  return { tier, planType, isLoading, shouldBlockAccess, gateVariant };
}

export function useSubscriptionAvailableAddOns(subscriptionId: string) {
  return useQuery({
    queryKey: paymentQueryKeys.subscriptionAddOns(subscriptionId),
    queryFn: () => getAvailableSubscriptionAddOns(subscriptionId),
    enabled: Boolean(subscriptionId),
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSubscriptionPayload) =>
      createSubscription(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.currentSubscription(),
      });
    },
  });
}

export function useCancelSubscription(subscriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CancelSubscriptionPayload) =>
      cancelSubscription(subscriptionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptionDetail(subscriptionId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.currentSubscription(),
      });
    },
  });
}

export function useActivateSubscription(subscriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => activateSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptionDetail(subscriptionId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.currentSubscription(),
      });
    },
  });
}

export function useDetachSubscriptionAddOn(subscriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: DetachSubscriptionAddOnPayload) =>
      detachSubscriptionAddOn(subscriptionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptionDetail(subscriptionId),
      });
    },
  });
}

export function useAttachSubscriptionAddOn(subscriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AttachSubscriptionAddOnPayload) =>
      attachSubscriptionAddOn(subscriptionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptionDetail(subscriptionId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptionAddOns(subscriptionId),
      });
    },
  });
}

export function usePayments(params?: SubscriptionQuery) {
  return useQuery({
    queryKey: paymentQueryKeys.payments(params),
    queryFn: () => listPayments(params),
  });
}

export function usePaymentDetail(paymentId: string) {
  return useQuery({
    queryKey: paymentQueryKeys.paymentDetail(paymentId),
    queryFn: () => getPaymentDetail(paymentId),
    enabled: Boolean(paymentId),
  });
}

export function usePaymentHistory(params?: PaymentHistoryQuery) {
  return useQuery({
    queryKey: paymentQueryKeys.paymentHistory(params),
    queryFn: () => listPaymentHistory(params),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePaymentPayload) => createPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.payments() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
    },
  });
}

export function useCheckoutPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PaymentCheckoutPayload) => checkoutPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.payments() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.currentSubscription(),
      });
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.invoices() });
    },
  });
}

export function useCompletePayment(paymentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CompletePaymentPayload) =>
      completePayment(paymentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.payments() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.paymentDetail(paymentId),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.subscriptions(),
      });
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.invoices() });
    },
  });
}

export function useFailPayment(paymentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FailPaymentPayload) =>
      failPayment(paymentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.payments() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.paymentDetail(paymentId),
      });
    },
  });
}

export function useSubscriptionQuoteRequests() {
  return useQuery({
    queryKey: paymentQueryKeys.quoteRequests(),
    queryFn: listSubscriptionQuoteRequests,
  });
}

export function useCreateSubscriptionQuoteRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSubscriptionQuoteRequestPayload) =>
      createSubscriptionQuoteRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.quoteRequests(),
      });
    },
  });
}

export function useInvoices(params?: SubscriptionQuery) {
  return useQuery({
    queryKey: paymentQueryKeys.invoices(params),
    queryFn: () => listInvoices(params),
  });
}

export function useInvoiceDetail(invoiceId: string) {
  return useQuery({
    queryKey: paymentQueryKeys.invoiceDetail(invoiceId),
    queryFn: () => getInvoiceDetail(invoiceId),
    enabled: Boolean(invoiceId),
  });
}

export function useDownloadInvoice() {
  return useMutation({
    mutationFn: (invoiceId: string) => downloadInvoice(invoiceId),
  });
}
