import { z } from "zod";

const moneyValueSchema = z.union([z.string(), z.number()]);

export const capabilitySchema = z
  .object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    decision_changing: z.boolean().optional(),
  })
  .passthrough();

export const planLimitSchema = z.record(z.string(), z.number());

export const pricingRecommendationSchema = z.object({
  recommended_plan_type: z.string(),
  reason: z.string(),
  branch_count: z.number(),
  organization_role: z.string().nullable().optional(),
  current_plan_type: z.string().nullable().optional(),
  current_subscription_active: z.boolean(),
});
export type PricingRecommendation = z.infer<typeof pricingRecommendationSchema>;

export const subscriptionPlanSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    plan_type: z.string(),
    description: z.string().optional(),
    tagline: z.string().optional(),
    monthly_price: moneyValueSchema,
    yearly_price: moneyValueSchema,
    features: z.array(z.unknown()).optional(),
    capabilities: z.array(capabilitySchema).optional(),
    is_popular: z.boolean().optional(),
    plan_limits: planLimitSchema.optional(),
    pricing_model: z.string().optional(),
    pricing_model_details: z.unknown().optional(),
  })
  .passthrough();
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionPlanPricingResponseSchema = z.object({
  plans: z.array(subscriptionPlanSchema),
  recommendation: pricingRecommendationSchema.optional(),
});
export type SubscriptionPlanPricingResponse = z.infer<
  typeof subscriptionPlanPricingResponseSchema
>;

export const addOnSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    monthly_price: moneyValueSchema.optional(),
    yearly_price: moneyValueSchema.optional(),
    per_location: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough();
export type AddOn = z.infer<typeof addOnSchema>;

export const subscriptionAddOnSchema = z
  .object({
    id: z.string().uuid(),
    add_on: addOnSchema,
    billing_cycle: z.string().optional(),
    quantity: z.number().int().optional(),
    unit_price_snapshot: moneyValueSchema.optional(),
    total_price_snapshot: moneyValueSchema.optional(),
    is_active: z.boolean().optional(),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
  })
  .passthrough();
export type SubscriptionAddOn = z.infer<typeof subscriptionAddOnSchema>;

export const subscriptionListSchema = z
  .object({
    id: z.string().uuid(),
    organization_name: z.string().optional(),
    branch: z.string().uuid().optional(),
    branch_name: z.string().optional(),
    plan_name: z.string().optional(),
    plan_type: z.string().optional(),
    status: z.string(),
    billing_cycle: z.string(),
    // Null while the subscription is PENDING (created at checkout, activated
    // once payment completes) or when a mid-trial purchase defers activation.
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    next_billing_date: z.string().nullable().optional(),
    contract_start: z.string().nullable().optional(),
    contract_end: z.string().nullable().optional(),
    minimum_term_months: z.number().nullable().optional(),
    early_termination_fee: moneyValueSchema.nullable().optional(),
    price_at_subscription: moneyValueSchema.optional(),
    pricing_snapshot: z.unknown().optional(),
    auto_renew: z.boolean().optional(),
    add_ons: z.array(subscriptionAddOnSchema).optional(),
    is_currently_active: z.boolean().optional(),
    days_until_renewal: z.number().nullable().optional(),
    created_at: z.string().optional(),
  })
  .passthrough();
export type SubscriptionList = z.infer<typeof subscriptionListSchema>;

export const subscriptionDetailSchema = z
  .object({
    id: z.string().uuid(),
    organization_name: z.string().optional(),
    branch: z.string().uuid().optional(),
    branch_name: z.string().optional(),
    plan: subscriptionPlanSchema,
    status: z.string(),
    billing_cycle: z.string(),
    // Null while the subscription is PENDING (created at checkout, activated
    // once payment completes) or when a mid-trial purchase defers activation.
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    next_billing_date: z.string().nullable().optional(),
    contract_start: z.string().nullable().optional(),
    contract_end: z.string().nullable().optional(),
    minimum_term_months: z.number().nullable().optional(),
    early_termination_fee: moneyValueSchema.nullable().optional(),
    price_at_subscription: moneyValueSchema.optional(),
    pricing_snapshot: z.unknown().optional(),
    auto_renew: z.boolean().optional(),
    add_ons: z.array(subscriptionAddOnSchema).optional(),
    cancelled_at: z.string().nullable().optional(),
    cancellation_reason: z.string().nullable().optional(),
    cancelled_by_name: z.string().nullable().optional(),
    is_currently_active: z.boolean().optional(),
    is_trial: z.boolean().optional(),
    trial_ends_at: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();
export type SubscriptionDetail = z.infer<typeof subscriptionDetailSchema>;

export const createSubscriptionPayloadSchema = z.object({
  plan_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  billing_cycle: z.string().optional(),
  auto_renew: z.boolean().optional(),
});
export type CreateSubscriptionPayload = z.infer<
  typeof createSubscriptionPayloadSchema
>;

export const cancelSubscriptionPayloadSchema = z.object({
  reason: z.string().optional(),
});
export type CancelSubscriptionPayload = z.infer<
  typeof cancelSubscriptionPayloadSchema
>;

export const attachSubscriptionAddOnPayloadSchema = z.object({
  add_on_id: z.string().uuid(),
  billing_cycle: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
});
export type AttachSubscriptionAddOnPayload = z.infer<
  typeof attachSubscriptionAddOnPayloadSchema
>;

export const detachSubscriptionAddOnPayloadSchema = z.object({
  add_on_id: z.string().uuid(),
});
export type DetachSubscriptionAddOnPayload = z.infer<
  typeof detachSubscriptionAddOnPayloadSchema
>;

export const paymentSchema = z
  .object({
    id: z.string().uuid(),
    payment_type: z.string(),
    reference_number: z.string(),
    organization_name: z.string().optional(),
    branch: z.string().uuid().optional(),
    branch_name: z.string().optional(),
    subscription: z.string().uuid().nullable().optional(),
    subscription_plan: z.string().nullable().optional(),
    amount: moneyValueSchema,
    currency: z.string(),
    payment_method: z.string(),
    status: z.string(),
    payer_name: z.string(),
    payer_email: z.string().email(),
    payer_phone: z.string(),
    gateway_transaction_id: z.string().nullable().optional(),
    initiated_at: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional(),
    failed_at: z.string().nullable().optional(),
    failure_reason: z.string().nullable().optional(),
    notes: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();
export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentPayloadSchema = z.object({
  payment_type: z.string(),
  subscription_id: z.string().uuid().optional().nullable(),
  renewal_pricing_policy: z.string().optional(),
  payment_method: z.string(),
  payer_name: z.string().min(1),
  payer_email: z.string().email(),
  payer_phone: z.string().min(1),
  notes: z.string().optional(),
});
export type CreatePaymentPayload = z.infer<typeof createPaymentPayloadSchema>;

export const paymentCheckoutPayloadSchema = z.object({
  plan_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  billing_cycle: z.string().optional(),
  payment_method: z.string(),
  business_name: z.string().min(1),
  billing_email: z.string().email(),
  phone_number: z.string().min(1),
});
export type PaymentCheckoutPayload = z.infer<
  typeof paymentCheckoutPayloadSchema
>;

export const paymentCheckoutResponseSchema = z
  .object({
    subscription: subscriptionDetailSchema,
    payment: paymentSchema,
    invoice: z.unknown(),
    total_amount: moneyValueSchema,
    payment_link: z.string().url().or(z.string()),
    message: z.string(),
  })
  .passthrough();
export type PaymentCheckoutResponse = z.infer<
  typeof paymentCheckoutResponseSchema
>;

export const completePaymentPayloadSchema = z.object({
  gateway_transaction_id: z.string().optional(),
  gateway_response: z.record(z.string(), z.unknown()).optional(),
});
export type CompletePaymentPayload = z.infer<typeof completePaymentPayloadSchema>;

export const failPaymentPayloadSchema = z.object({
  reason: z.string().optional(),
});
export type FailPaymentPayload = z.infer<typeof failPaymentPayloadSchema>;

export const paymentActionResponseSchema = z
  .object({
    payment: paymentSchema,
    message: z.string(),
  })
  .passthrough();
export type PaymentActionResponse = z.infer<typeof paymentActionResponseSchema>;

export const invoiceLineItemSchema = z.record(z.string(), z.unknown());

export const invoiceSchema = z
  .object({
    id: z.string().uuid(),
    invoice_number: z.string(),
    organization_name: z.string().optional(),
    branch: z.string().uuid().optional(),
    branch_name: z.string().optional(),
    payment_reference: z.string().optional(),
    payment_status: z.string().optional(),
    issue_date: z.string().optional(),
    due_date: z.string().optional(),
    subtotal: moneyValueSchema.optional(),
    tax_amount: moneyValueSchema.optional(),
    total_amount: moneyValueSchema.optional(),
    line_items: z.array(invoiceLineItemSchema).optional(),
    is_paid: z.boolean().optional(),
    paid_at: z.string().nullable().optional(),
    pdf_file: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceDownloadResponseSchema = z
  .object({
    invoice: invoiceSchema,
    message: z.string(),
  })
  .passthrough();
export type InvoiceDownloadResponse = z.infer<typeof invoiceDownloadResponseSchema>;

export const subscriptionQuoteRequestSchema = z
  .object({
    id: z.string().uuid(),
    organization: z.string().uuid().optional(),
    organization_name: z.string().optional(),
    plan: z.string().uuid(),
    plan_name: z.string().optional(),
    requested_by: z.string().uuid().optional(),
    requested_by_email: z.string().email().optional(),
    billing_cycle: z.string().optional(),
    billable_locations: z.number().int().optional(),
    status: z.string().optional(),
    contact_name: z.string().optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().optional(),
    notes: z.string().optional(),
    pricing_snapshot: z.unknown().optional(),
    quoted_price: moneyValueSchema.nullable().optional(),
    handled_by: z.string().uuid().nullable().optional(),
    handled_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();
export type SubscriptionQuoteRequest = z.infer<
  typeof subscriptionQuoteRequestSchema
>;

export const createSubscriptionQuoteRequestPayloadSchema = z.object({
  plan: z.string().uuid(),
  billing_cycle: z.string().optional(),
  contact_name: z.string().min(1),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateSubscriptionQuoteRequestPayload = z.infer<
  typeof createSubscriptionQuoteRequestPayloadSchema
>;
