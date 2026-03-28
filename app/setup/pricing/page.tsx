"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CoinsSwap,
  ShieldCheck,
  CheckCircle,
} from "iconoir-react";
import { ApiError } from "@/lib/api/errors";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  useCurrentSubscription,
  useCheckoutPayment,
  useSubscriptionPlanPricing,
} from "@/services/payment/hooks";
import { useBranches, useCurrentUserProfile } from "@/services";
import type { SubscriptionPlan } from "@/services/payment/types";
import type { Branch } from "@/services/branches/types";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function formatPriceValue(value: unknown) {
  const amount = toNumber(value);
  return `$${amount.toLocaleString()}`;
}

function sortPlanOrder(plans: SubscriptionPlan[]) {
  const order = { CORE: 1, INTELLIGENCE: 2, COMMAND: 3 } as const;
  return [...plans].sort((a, b) => {
    const aOrder = order[(a.plan_type as keyof typeof order) ?? "CORE"] ?? 99;
    const bOrder = order[(b.plan_type as keyof typeof order) ?? "CORE"] ?? 99;
    return aOrder - bOrder;
  });
}

function pricingModelLabel(mode?: string) {
  if (mode === "HYBRID_BASE_PLUS_CUSTOM") return "Published + custom quote";
  if (mode === "CUSTOM_ONLY") return "Custom quote";
  return "Published rates";
}

function maxBranchesLabel(plan: SubscriptionPlan) {
  const value = plan.plan_limits?.MAX_BRANCHES;
  if (typeof value !== "number") return "Unlimited branches";
  if (value <= 1) return "1 branch included";
  return `${value} branches included`;
}

function planSubtitle(planType?: string) {
  if (planType === "CORE") return "Daily branch operations";
  if (planType === "INTELLIGENCE") return "Forecasting and margin insights";
  if (planType === "COMMAND") return "Multi-branch command center";
  return "Operational plan";
}

export default function PricingStepPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const plansQuery = useSubscriptionPlanPricing();
  const currentSubscriptionQuery = useCurrentSubscription();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const checkoutMutation = useCheckoutPayment();

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(
    "MONTHLY",
  );
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [businessName, setBusinessName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitError, setSubmitError] = useState("");

  const currentSubscriptionError = currentSubscriptionQuery.error as ApiError | null;
  const hasNoActiveSubscription = currentSubscriptionError?.status === 404;
  const currentPlanType = hasNoActiveSubscription
    ? "CORE"
    : currentSubscriptionQuery.data?.plan?.plan_type;

  const plans = useMemo(
    () => sortPlanOrder(plansQuery.data?.plans ?? []),
    [plansQuery.data?.plans],
  );
  const branches = useMemo(
    () => (branchesQuery.data ?? []).filter((branch) => branch.is_active),
    [branchesQuery.data],
  );
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const currentPlan = plans.find((plan) => plan.plan_type === currentPlanType);
  const recommendedPlanType = plansQuery.data?.recommendation?.recommended_plan_type;
  const recommendationReason = plansQuery.data?.recommendation?.reason;

  useEffect(() => {
    if (userLoading || !user) return;
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    setBusinessName((prev) => prev || user.organization_name || fullName);
    setBillingEmail((prev) => prev || user.email);
    setPhoneNumber((prev) => prev || user.phone || "");
  }, [userLoading, user]);

  useEffect(() => {
    if (!branches.length) return;
    if (selectedBranchId) return;
    const primary = branches.find((branch) => branch.is_primary);
    setSelectedBranchId(primary?.id ?? branches[0]?.id ?? "");
  }, [branches, selectedBranchId]);

  function handleContinueCurrent() {
    router.push("/");
  }

  function handleUpgrade(plan: SubscriptionPlan) {
    setSelectedPlanId(plan.id);
    setSubmitError("");
  }

  function handleCheckout() {
    setSubmitError("");
    if (!selectedPlanId) {
      setSubmitError("Select a plan to continue.");
      return;
    }
    if (!selectedBranchId) {
      setSubmitError("Select a branch to attach this subscription.");
      return;
    }
    if (!businessName || !billingEmail || !phoneNumber) {
      setSubmitError("Business name, billing email, and phone are required.");
      return;
    }

    checkoutMutation.mutate(
      {
        plan_id: selectedPlanId,
        branch_id: selectedBranchId,
        billing_cycle: billingCycle,
        payment_method: paymentMethod,
        business_name: businessName,
        billing_email: billingEmail,
        phone_number: phoneNumber,
      },
      {
        onSuccess: (response) => {
          const redirect = response.payment_link;
          if (redirect) {
            window.location.href = redirect;
          }
        },
        onError: (error: any) => {
          setSubmitError(error?.message || "Checkout failed. Try again.");
        },
      },
    );
  }

  return (
    <div className="min-h-screen bg-surface-1 p-6">
      <div className="mx-auto w-full max-w-[1440px] py-8">
        <div className="flex items-center gap-2 mb-8">
          <CoinsSwap className="h-4 w-4 text-brand-gold" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Final Step - Pricing
          </span>
        </div>

        <h1 className="font-display text-[40px] leading-[48px] font-semibold text-text-primary mb-3">
          Choose the plan that matches your operation.
        </h1>
        <p className="text-[16px] leading-[24px] text-text-muted max-w-3xl mb-10">
          Start with your current plan, or upgrade now to unlock broader controls and deeper intelligence.
        </p>

        <section className="mb-10 rounded-card border border-border-default bg-surface-2 p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-4">
            Your workspace today
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">Active plan</p>
              <p className="font-display text-[26px] leading-[34px] text-text-primary">
                {currentPlan?.name ?? "Core"}
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                {hasNoActiveSubscription
                  ? "No paid subscription yet. You are on the default Core path."
                  : "A subscription is already active for this workspace."}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">Branch coverage</p>
              <p className="font-display text-[26px] leading-[34px] text-text-primary">
                {currentPlan ? maxBranchesLabel(currentPlan) : "1 branch included"}
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                Branch limits come from the selected commercial plan.
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">Billing model</p>
              <p className="font-display text-[26px] leading-[34px] text-text-primary">
                {pricingModelLabel(currentPlan?.pricing_model)}
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                Command may switch to custom quote at higher location counts.
              </p>
            </div>
          </div>
          {recommendationReason ? (
            <div className="mt-5 pt-5 border-t border-chart-grid">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">
                Recommendation Logic
              </p>
              <p className="text-[13px] text-text-secondary">{recommendationReason}</p>
            </div>
          ) : null}
        </section>

        {plansQuery.isLoading ? (
          <div className="rounded-card border border-border-default bg-surface-2 p-8">
            <div className="flex items-center justify-center gap-3 text-text-secondary">
              <Spinner size="lg" />
              <span className="text-[14px]">Loading pricing plans...</span>
            </div>
          </div>
        ) : plansQuery.isError ? (
          <div className="rounded-card border border-status-critical/60 bg-[#2A1E1E] p-5 text-[#F2B8B5]">
            Failed to load pricing plans. Please refresh.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = currentPlanType === plan.plan_type;
              const pricingMode = plan.pricing_model;
              const pricingDetails =
                (plan.pricing_model_details as
                  | { custom_quote_required_above_locations?: number }
                  | undefined) ?? {};
              const isHybridOrCustom =
                pricingMode === "HYBRID_BASE_PLUS_CUSTOM" ||
                pricingMode === "CUSTOM_ONLY";
              const quoteThreshold =
                pricingDetails.custom_quote_required_above_locations;
              const features = asStringArray(plan.features);

              const monthlyPrice = formatPriceValue(plan.monthly_price);
              const yearlyPrice = formatPriceValue(plan.yearly_price);

              const cta = isCurrent
                ? "Continue with current plan"
                : plan.plan_type === "COMMAND" && isHybridOrCustom
                  ? "Select Command"
                  : `Select ${plan.name}`;
              const isRecommended = plan.plan_type === recommendedPlanType;
              const isSelected = selectedPlanId === plan.id;

              return (
                <section
                  key={plan.id}
                  className={`rounded-card border bg-surface-2 p-6 h-full flex flex-col ${
                    isSelected
                      ? "border-brand-gold shadow-[0_0_0_1px_rgba(168,130,31,0.45)]"
                      : isCurrent
                        ? "border-brand-gold/60"
                        : "border-border-default"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div>
                      <p className="font-display text-[28px] leading-[34px] font-semibold text-text-primary">
                        {plan.name}
                      </p>
                      <p className="text-[13px] text-text-muted mt-1">
                        {plan.tagline || planSubtitle(plan.plan_type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRecommended ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-status-info/20 text-[#8DB7E0] whitespace-nowrap">
                          Recommended
                        </span>
                      ) : null}
                      {isCurrent ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-gold whitespace-nowrap">
                          Current
                        </span>
                      ) : null}
                      {isSelected ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-gold whitespace-nowrap">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-chart-grid">
                    <p className="text-[12px] uppercase tracking-[0.14em] text-text-muted mb-2">
                      Monthly
                    </p>
                    <div className="flex items-end gap-2">
                      <p className="font-display text-[44px] leading-[44px] text-text-primary">
                        {isHybridOrCustom ? `From ${monthlyPrice}` : monthlyPrice}
                      </p>
                      <p className="text-[14px] text-text-muted pb-1">/month</p>
                    </div>
                    <p className="text-[13px] text-text-muted mt-2">Yearly: {yearlyPrice}/year</p>

                    {plan.plan_type === "CORE" ? (
                      <p className="text-[13px] text-status-success mt-2">30-day trial included.</p>
                    ) : null}

                    {isHybridOrCustom ? (
                      <p className="text-[13px] text-status-warning mt-2">
                        {quoteThreshold
                          ? `Custom quote required above ${quoteThreshold} locations.`
                          : "Custom quote available for larger rollouts."}
                      </p>
                    ) : null}
                  </div>

                  <div className="mb-6">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-2">Capacity</p>
                    <p className="text-[15px] text-text-primary">{maxBranchesLabel(plan)}</p>
                    <p className="text-[12px] text-text-muted mt-1">{pricingModelLabel(pricingMode)}</p>
                  </div>

                  <div className="mb-7 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-3">What&apos;s included</p>
                    {features.length ? (
                      <ul className="space-y-3">
                        {features.map((feature) => (
                          <li
                            key={feature}
                            className="text-[14px] leading-[22px] text-text-secondary flex items-start gap-2.5"
                          >
                            <ShieldCheck className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[14px] text-text-muted">Feature details are being updated.</p>
                    )}
                  </div>

                  <Button
                    variant={isCurrent ? "primary" : "secondary"}
                    fullWidth
                    leftIcon={isCurrent ? <CheckCircle className="h-4 w-4" /> : undefined}
                    onClick={() => (isCurrent ? handleContinueCurrent() : handleUpgrade(plan))}
                  >
                    <span className="inline-flex items-center gap-2">
                      {cta}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Button>
                </section>
              );
            })}
          </div>
        )}

        <section className="mt-12 rounded-card border border-border-default bg-surface-2 p-6">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Checkout
            </p>
            <h2 className="font-display text-[28px] leading-[34px] text-text-primary">
              Confirm plan, branch, and payment method.
            </h2>
            <p className="text-[13px] text-text-secondary max-w-2xl">
              Select the branch the subscription should cover. Payments are routed
              to Stripe for cards and PawaPay for mobile money.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Select
                label="Selected plan"
                options={plans.map((plan) => ({
                  value: plan.id,
                  label: `${plan.name} · ${planSubtitle(plan.plan_type)}`,
                }))}
                value={selectedPlanId}
                onChange={(value) => {
                  setSelectedPlanId(value);
                  setSubmitError("");
                }}
                placeholder="Choose a plan"
              />

              <div className="space-y-3">
                <p className="text-sm font-medium text-text-secondary">
                  Billing cycle
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBillingCycle("MONTHLY")}
                    className={`h-11 rounded-button border text-sm font-medium transition-colors ${
                      billingCycle === "MONTHLY"
                        ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
                        : "border-border-default bg-surface-3 text-text-secondary hover:bg-surface-4"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle("YEARLY")}
                    className={`h-11 rounded-button border text-sm font-medium transition-colors ${
                      billingCycle === "YEARLY"
                        ? "border-brand-gold bg-brand-gold/15 text-brand-gold"
                        : "border-border-default bg-surface-3 text-text-secondary hover:bg-surface-4"
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              <Select
                label="Branch"
                options={branches.map((branch: Branch) => ({
                  value: branch.id,
                  label: `${branch.name}${branch.is_primary ? " · Primary" : ""}`,
                }))}
                value={selectedBranchId}
                onChange={(value) => {
                  setSelectedBranchId(value);
                  setSubmitError("");
                }}
                placeholder={
                  branchesQuery.isLoading
                    ? "Loading branches..."
                    : "Select a branch"
                }
                disabled={branchesQuery.isLoading || !branches.length}
              />

              <Select
                label="Payment method"
                options={[
                  { value: "CARD", label: "Card (Stripe)" },
                  { value: "MOBILE_MONEY", label: "Mobile money (PawaPay)" },
                ]}
                value={paymentMethod}
                onChange={(value) => {
                  setPaymentMethod(value);
                  setSubmitError("");
                }}
              />
            </div>

            <div className="space-y-6">
              <Input
                label="Business name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="PrepIQ HQ"
              />
              <Input
                label="Billing email"
                type="email"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
                placeholder="finance@prepiq.com"
              />
              <Input
                label="Billing phone"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+256 700 123 456"
              />

              <div className="rounded-card border border-chart-grid bg-surface-3 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-2">
                  Summary
                </p>
                <p className="text-[14px] text-text-secondary">
                  Plan:{" "}
                  <span className="text-text-primary">
                    {selectedPlan?.name ?? "Not selected"}
                  </span>
                </p>
                <p className="text-[14px] text-text-secondary">
                  Billing:{" "}
                  <span className="text-text-primary">
                    {billingCycle === "MONTHLY" ? "Monthly" : "Yearly"}
                  </span>
                </p>
                <p className="text-[14px] text-text-secondary">
                  Branch:{" "}
                  <span className="text-text-primary">
                    {branches.find((branch) => branch.id === selectedBranchId)
                      ?.name ?? "Not selected"}
                  </span>
                </p>
                <p className="text-[14px] text-text-secondary">
                  Payment rail:{" "}
                  <span className="text-text-primary">
                    {paymentMethod === "CARD" ? "Stripe" : "PawaPay"}
                  </span>
                </p>
                <p className="text-[13px] text-text-muted mt-3">
                  You will be redirected to the payment gateway to complete the
                  charge.
                </p>
              </div>

              {submitError ? (
                <div className="rounded-card border border-status-critical/50 bg-[#2A1E1E] p-3 text-[13px] text-[#F2B8B5]">
                  {submitError}
                </div>
              ) : null}

              <Button
                fullWidth
                onClick={handleCheckout}
                disabled={checkoutMutation.isLoading}
              >
                {checkoutMutation.isLoading
                  ? "Starting checkout..."
                  : "Proceed to payment"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
