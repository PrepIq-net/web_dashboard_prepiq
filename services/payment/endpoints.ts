const BASE = "/api/payment";

export const paymentEndpoints = {
  plans: () => `${BASE}/plans/`,
  plansPricing: () => `${BASE}/plans/pricing/`,

  subscriptions: () => `${BASE}/subscriptions/`,
  subscriptionDetail: (subscriptionId: string) =>
    `${BASE}/subscriptions/${subscriptionId}/`,
  subscriptionCurrent: () => `${BASE}/subscriptions/current/`,
  subscriptionCancel: (subscriptionId: string) =>
    `${BASE}/subscriptions/${subscriptionId}/cancel/`,
  subscriptionActivate: (subscriptionId: string) =>
    `${BASE}/subscriptions/${subscriptionId}/activate/`,
  subscriptionAvailableAddOns: (subscriptionId: string) =>
    `${BASE}/subscriptions/${subscriptionId}/available-add-ons/`,
  subscriptionAttachAddOn: (subscriptionId: string) =>
    `${BASE}/subscriptions/${subscriptionId}/add-ons/attach/`,
  subscriptionDetachAddOn: (subscriptionId: string) =>
    `${BASE}/subscriptions/${subscriptionId}/add-ons/detach/`,

  payments: () => `${BASE}/payments/`,
  paymentDetail: (paymentId: string) => `${BASE}/payments/${paymentId}/`,
  paymentsCheckout: () => `${BASE}/payments/checkout/`,
  paymentsHistory: () => `${BASE}/payments/history/`,
  paymentComplete: (paymentId: string) => `${BASE}/payments/${paymentId}/complete/`,
  paymentFail: (paymentId: string) => `${BASE}/payments/${paymentId}/fail/`,

  quoteRequests: () => `${BASE}/quote-requests/`,
  quoteRequestDetail: (quoteRequestId: string) =>
    `${BASE}/quote-requests/${quoteRequestId}/`,

  invoices: () => `${BASE}/invoices/`,
  invoiceDetail: (invoiceId: string) => `${BASE}/invoices/${invoiceId}/`,
  invoiceDownload: (invoiceId: string) => `${BASE}/invoices/${invoiceId}/download/`,
  invoiceBillingReport: () => `${BASE}/invoices/billing-report/`,
} as const;

