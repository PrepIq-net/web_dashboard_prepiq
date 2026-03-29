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

function formatPriceValue(t: any, value: unknown) {
  const amount = toNumber(value);
  return t("setup.pricing.priceFormat", {
    amount: amount.toLocaleString(),
  });
}

function sortPlanOrder(plans: SubscriptionPlan[]) {
  const order = { CORE: 1, INTELLIGENCE: 2, COMMAND: 3 } as const;
  return [...plans].sort((a, b) => {
    const aOrder = order[(a.plan_type as keyof typeof order) ?? "CORE"] ?? 99;
    const bOrder = order[(b.plan_type as keyof typeof order) ?? "CORE"] ?? 99;
    return aOrder - bOrder;
  });
}

function pricingModelLabel(t: any, mode?: string) {
  if (mode === "HYBRID_BASE_PLUS_CUSTOM") return t("setup.pricing.publishedCustom");
  if (mode === "CUSTOM_ONLY") return t("setup.pricing.customQuote");
  return t("setup.pricing.publishedRates");
}

function maxBranchesLabel(t: any, plan: SubscriptionPlan) {
  const value = plan.plan_limits?.MAX_BRANCHES;
  if (typeof value !== "number") return t("setup.pricing.unlimitedBranches");
  if (value <= 1) return t("setup.pricing.oneBranch");
  return t("setup.pricing.nBranches", { count: value });
}

function planSubtitle(t: any, planType?: string) {
  if (planType === "CORE") return t("setup.pricing.dailyOps");
  if (planType === "INTELLIGENCE") return t("setup.pricing.forecastingInsights");
  if (planType === "COMMAND") return t("setup.pricing.multiBranchCommand");
  return t("setup.pricing.operationalPlan");
}

export default function PricingStepPage() {
  const { t } = useTranslation();
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
      setSubmitError(t("setup.pricing.fixErrors"));
      return;
    }
    if (!selectedBranchId) {
      setSubmitError(t("setup.pricing.selectBranchRequired"));
      return;
    }
    if (!businessName || !billingEmail || !phoneNumber) {
      setSubmitError(t("setup.pricing.billingRequired"));
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
            {t("setup.common.step", { step: 6 })} — {t("setup.common.pricing")}
          </span>
        </div>

        <h1 className="font-display text-[40px] leading-[48px] font-semibold text-text-primary mb-3">
          {t("setup.pricing.title")}
        </h1>
        <p className="text-[16px] leading-[24px] text-text-muted max-w-3xl mb-10">
          {t("setup.pricing.description")}
        </p>

        <section className="mb-10 rounded-card border border-border-default bg-surface-2 p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-4">
            {t("setup.pricing.yourWorkspace")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">{t("setup.pricing.activePlan")}</p>
              <p className="font-display text-[26px] leading-[34px] text-text-primary">
                {currentPlan?.name ?? "Core"}
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                {hasNoActiveSubscription
                  ? t("setup.pricing.noPaidSub")
                  : t("setup.pricing.subActive")}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">{t("setup.pricing.branchCoverage")}</p>
              <p className="font-display text-[26px] leading-[34px] text-text-primary">
                {currentPlan ? maxBranchesLabel(t, currentPlan) : t("setup.pricing.oneBranch")}
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                {t("setup.pricing.branchLimitsDesc")}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">{t("setup.pricing.billingModel")}</p>
              <p className="font-display text-[26px] leading-[34px] text-text-primary">
                {pricingModelLabel(t, currentPlan?.pricing_model)}
              </p>
              <p className="text-[13px] text-text-secondary mt-1">
                {t("setup.pricing.commandCustomQuote")}
              </p>
            </div>
          </div>
          {recommendationReason ? (
            <div className="mt-5 pt-5 border-t border-chart-grid">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-1">
                {t("setup.pricing.recommendationLogic")}
              </p>
              <p className="text-[13px] text-text-secondary">{recommendationReason}</p>
            </div>
          ) : null}
        </section>

        {plansQuery.isLoading ? (
          <div className="rounded-card border border-border-default bg-surface-2 p-8">
            <div className="flex items-center justify-center gap-3 text-text-secondary">
              <Spinner size="lg" />
              <span className="text-[14px]">{t("setup.pricing.loadingPlans")}</span>
            </div>
          </div>
        ) : plansQuery.isError ? (
          <div className="rounded-card border border-status-critical/60 bg-[#2A1E1E] p-5 text-[#F2B8B5]">
            {t("setup.pricing.failedPlans")}
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

              const monthlyPrice = formatPriceValue(t, plan.monthly_price);
              const yearlyPrice = formatPriceValue(t, plan.yearly_price);

              const cta = isCurrent
                ? t("setup.pricing.continueCurrent")
                : plan.plan_type === "COMMAND" && isHybridOrCustom
                  ? t("setup.pricing.selectCommand")
                  : t("setup.pricing.selectPlan", { name: plan.name });
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
                        {plan.tagline || planSubtitle(t, plan.plan_type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRecommended ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-status-info/20 text-[#8DB7E0] whitespace-nowrap">
                          {t("setup.pricing.recommended")}
                        </span>
                      ) : null}
                      {isCurrent ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-gold whitespace-nowrap">
                          {t("setup.pricing.current")}
                        </span>
                      ) : null}
                      {isSelected ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-brand-gold/15 text-brand-gold whitespace-nowrap">
                          {t("setup.pricing.selected")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-chart-grid">
                    <p className="text-[12px] uppercase tracking-[0.14em] text-text-muted mb-2">
                      {t("setup.pricing.monthly")}
                    </p>
                    <div className="flex items-end gap-2">
                      <p className="font-display text-[44px] leading-[44px] text-text-primary">
                        {isHybridOrCustom
                          ? t("setup.pricing.fromPrice", { price: monthlyPrice })
                          : monthlyPrice}
                      </p>
                      <p className="text-[14px] text-text-muted pb-1">
                        {t("setup.pricing.perMonth")}
                      </p>
                    </div>
                    <p className="text-[13px] text-text-muted mt-2">{t("setup.pricing.yearlyPrice", { amount: yearlyPrice })}</p>

                    {plan.plan_type === "CORE" ? (
                      <p className="text-[13px] text-status-success mt-2">{t("setup.pricing.trialIncluded")}</p>
                    ) : null}

                    {isHybridOrCustom ? (
                      <p className="text-[13px] text-status-warning mt-2">
                        {quoteThreshold
                          ? t("setup.pricing.quoteRequired", { count: quoteThreshold })
                          : t("setup.pricing.quoteAvailable")}
                      </p>
                    ) : null}
                  </div>

                  <div className="mb-6">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-2">{t("setup.pricing.capacity")}</p>
                    <p className="text-[15px] text-text-primary">{maxBranchesLabel(t, plan)}</p>
                    <p className="text-[12px] text-text-muted mt-1">{pricingModelLabel(t, pricingMode)}</p>
                  </div>

                  <div className="mb-7 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-3">{t("setup.pricing.whatsIncluded")}</p>
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
                      <p className="text-[14px] text-text-muted">{t("setup.pricing.featureDetailsUpdating")}</p>
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
              {t("setup.pricing.summary")}
            </p>
            <h2 className="font-display text-[28px] leading-[34px] text-text-primary">
              {t("setup.pricing.confirmPlanHeader")}
            </h2>
            <p className="text-[13px] text-text-secondary max-w-2xl">
              {t("setup.pricing.confirmPlanDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Select
                label={t("setup.pricing.selected")}
                options={plans.map((plan) => ({
                  value: plan.id,
                  label: `${plan.name} · ${planSubtitle(t, plan.plan_type)}`,
                }))}
                value={selectedPlanId}
                onChange={(value) => {
                  setSelectedPlanId(value);
                  setSubmitError("");
                }}
                placeholder={t("setup.pricing.choosePlan")}
              />

              <div className="space-y-3">
                <p className="text-sm font-medium text-text-secondary">
                  {t("setup.pricing.billingCycle")}
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
                    {t("setup.pricing.monthly")}
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
                    {t("setup.pricing.yearly")}
                  </button>
                </div>
              </div>

              <Select
                label={t("common.branch")}
                options={branches.map((branch: Branch) => ({
                  value: branch.id,
                  label: `${branch.name}${branch.is_primary ? ` · ${t("setup.pricing.primary")}` : ""}`,
                }))}
                value={selectedBranchId}
                onChange={(value) => {
                  setSelectedBranchId(value);
                  setSubmitError("");
                }}
                placeholder={
                  branchesQuery.isLoading
                    ? t("setup.pricing.loadingBranches")
                    : t("setup.pricing.selectBranch")
                }
                disabled={branchesQuery.isLoading || !branches.length}
              />

              <Select
                label={t("setup.pricing.paymentMethod")}
                options={[
                  { value: "CARD", label: t("setup.pricing.cardStripe") },
                  { value: "MOBILE_MONEY", label: t("setup.pricing.mobileMoney") },
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
                label={t("setup.pricing.businessName")}
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="PrepIQ HQ"
              />
              <Input
                label={t("setup.pricing.billingEmail")}
                type="email"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
                placeholder="finance@prepiq.com"
              />
              <Input
                label={t("setup.pricing.billingPhone")}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+256 700 123 456"
              />

              <div className="rounded-card border border-chart-grid bg-surface-3 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-2">
                  {t("setup.pricing.summary")}
                </p>
                <p className="text-[14px] text-text-secondary">
                  {t("setup.pricing.activePlan")}:{" "}
                  <span className="text-text-primary">
                    {selectedPlan?.name ?? t("common.none")}
                  </span>
                </p>
                <p className="text-[14px] text-text-secondary">
                  {t("setup.pricing.billingCycle")}:{" "}
                  <span className="text-text-primary">
                    {billingCycle === "MONTHLY"
                      ? t("setup.pricing.monthly")
                      : t("setup.pricing.yearly")}
                  </span>
                </p>
                <p className="text-[14px] text-text-secondary">
                  {t("common.branch")}:{" "}
                  <span className="text-text-primary">
                    {branches.find((branch) => branch.id === selectedBranchId)
                      ?.name ?? t("common.none")}
                  </span>
                </p>
                <p className="text-[14px] text-text-secondary">
                  {t("setup.pricing.paymentMethod")}:{" "}
                  <span className="text-text-primary">
                    {paymentMethod === "CARD"
                      ? t("setup.pricing.cardStripe")
                      : t("setup.pricing.mobileMoney")}
                  </span>
                </p>
                <p className="text-[13px] text-text-muted mt-3">
                  {t("setup.pricing.paymentGatewayRedirect")}
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
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending
                  ? t("setup.pricing.startingCheckout")
                  : t("setup.pricing.proceedToPayment")}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
