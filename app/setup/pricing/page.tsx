"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CoinsSwap,
  ShieldCheck,
  CheckCircle,
  DoubleCheck,
  MultiplePages,
  InfoCircle,
} from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  useCurrentSubscription,
  useSubscriptionPlanPricing,
} from "@/services/payment/hooks";
import { useCurrentUserProfile } from "@/services";
import { useTranslation } from "@/lib/i18n";
import type { SubscriptionPlan } from "@/services/payment/types";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatPriceValue(value: unknown) {
  const amount = toNumber(value);
  return `$${amount.toLocaleString()}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function sortPlanOrder(plans: SubscriptionPlan[]) {
  const order = { CORE: 1, INTELLIGENCE: 2, COMMAND: 3 } as const;
  return [...plans].sort((a, b) => {
    const aOrder = order[(a.plan_type as keyof typeof order) ?? "CORE"] ?? 99;
    const bOrder = order[(b.plan_type as keyof typeof order) ?? "CORE"] ?? 99;
    return aOrder - bOrder;
  });
}

const PLAN_TIERS = {
  CORE: 1,
  INTELLIGENCE: 2,
  COMMAND: 3,
} as const;

export default function PricingStepPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const plansQuery = useSubscriptionPlanPricing();
  const currentSubscriptionQuery = useCurrentSubscription();

  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(
    "YEARLY",
  );

  const plans = useMemo(
    () => sortPlanOrder(plansQuery.data?.plans ?? []),
    [plansQuery.data?.plans],
  );

  const currentPlanType =
    currentSubscriptionQuery.data?.plan?.plan_type || null;
  const currentTier = currentPlanType
    ? PLAN_TIERS[currentPlanType as keyof typeof PLAN_TIERS] || 0
    : 0;

  const recommendedPlanType =
    plansQuery.data?.recommendation?.recommended_plan_type;
  const recommendationReason = plansQuery.data?.recommendation?.reason;

  function handleSelect(plan: SubscriptionPlan) {
    router.push(`/setup/checkout?planId=${plan.id}&cycle=${billingCycle}`);
  }

  function handleContinue() {
    router.push("/");
  }

  if (plansQuery.isLoading || userLoading) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-text-secondary animate-pulse">
            {t("setup.pricing.loading")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1 text-text-primary px-6 py-16">
      <div className="mx-auto max-w-[1240px]">
        {/* Header Section */}
        <section className="text-center mb-16 space-y-4">
          <div className="flex items-center justify-center gap-2 text-brand-gold font-semibold uppercase tracking-[0.2em] text-[12px] mb-6 animate-fade-in">
            <CoinsSwap className="h-4 w-4" />
            <span>{t("setup.pricing.onboardingInfra")}</span>
          </div>

          <h1 className="font-display text-[48px] md:text-[60px] leading-[1.1] font-semibold tracking-tight max-w-4xl mx-auto">
            {t("setup.pricing.heroTitle")} <br />
            <span className="text-brand-gold">{t("setup.pricing.heroSubtitle")}</span>
          </h1>

          <p className="text-text-muted text-[17px] max-w-2xl mx-auto leading-relaxed pt-2">
            {t("setup.pricing.heroDescription")}
          </p>
        </section>

        {/* Global Summary Info - Recommendation */}
        {recommendationReason && (
          <div className="max-w-3xl mx-auto mb-16 p-4 rounded-xl border border-brand-gold/20 bg-brand-gold/5 flex items-start gap-4">
            <InfoCircle className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-brand-gold uppercase tracking-wider">
                {t("setup.pricing.analysisResult")}
              </p>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                {recommendationReason}
              </p>
            </div>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-6 mb-16">
          <button
            onClick={() => setBillingCycle("MONTHLY")}
            className={`text-[15px] font-medium transition-all ${billingCycle === "MONTHLY" ? "text-text-primary" : "text-text-muted opacity-40 hover:opacity-60"}`}
          >
            {t("setup.pricing.monthly")}
          </button>

          <button
            onClick={() =>
              setBillingCycle(billingCycle === "MONTHLY" ? "YEARLY" : "MONTHLY")
            }
            className="group relative h-7 w-12 rounded-full border border-border-default bg-surface-3 transition-colors duration-300 hover:border-brand-gold/50"
          >
            <div
              className={`absolute top-1 left-1 h-5 w-5 rounded-full transition-all duration-300 transform ${billingCycle === "YEARLY" ? "translate-x-5 bg-brand-gold" : "bg-text-muted"}`}
            />
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setBillingCycle("YEARLY")}
              className={`text-[15px] font-medium transition-all ${billingCycle === "YEARLY" ? "text-text-primary" : "text-text-muted opacity-40 hover:opacity-60"}`}
            >
              {t("setup.pricing.yearly")}
            </button>
            <span className="text-[11px] font-bold uppercase tracking-widest text-status-success bg-status-success/10 px-2.5 py-1 rounded-full border border-status-success/20">
              {t("setup.pricing.save15")}
            </span>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20 animate-slide-up">
          {plans.map((plan) => {
            const isCurrent = currentPlanType === plan.plan_type;
            const planTier =
              PLAN_TIERS[plan.plan_type as keyof typeof PLAN_TIERS] || 0;
            const isRecommended = plan.plan_type === recommendedPlanType;

            const price =
              billingCycle === "MONTHLY"
                ? formatPriceValue(plan.monthly_price)
                : formatPriceValue(plan.yearly_price);

            const features = asStringArray(plan.features);

            // Logic for button label and state
            let buttonLabel = "Select Plan";
            let isDisabled = false;
            let showArrow = true;

            if (isCurrent) {
              buttonLabel = t("setup.pricing.currentTier");
              isDisabled = false; // Allow "Continue" logic
              showArrow = false;
            } else if (planTier > currentTier) {
              buttonLabel = currentTier === 0 ? t("setup.pricing.getStarted") : t("setup.pricing.upgradeNow");
            } else {
              buttonLabel = t("setup.pricing.downgradeRestricted");
              isDisabled = true;
              showArrow = false;
            }

            return (
              <div
                key={plan.id}
                className={`relative group rounded-card border transition-all duration-500 overflow-hidden flex flex-col p-8 ${
                  isRecommended
                    ? "border-brand-gold bg-surface-2 shadow-[0_12px_45px_-12px_rgba(168,130,31,0.25)] scale-[1.03] z-10"
                    : isCurrent
                      ? "border-brand-gold/40 bg-surface-2"
                      : "border-border-default bg-surface-2 hover:border-text-muted/40"
                }`}
              >
                {/* Popular / Recommended Badge */}
                {isRecommended && (
                  <div className="absolute top-0 right-0 left-0 bg-brand-gold h-[2px] z-20">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-brand-gold px-4 py-1.5 rounded-b-xl text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap">
                      {t("setup.pricing.aiRecommended")}
                    </div>
                  </div>
                )}

                <div className="mb-10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-[26px] font-semibold tracking-tight">
                      {plan.name}
                    </h3>
                    {isCurrent && (
                      <DoubleCheck className="h-5 w-5 text-brand-gold" />
                    )}
                  </div>
                  <p className="text-text-muted text-[14px]">
                    {plan.tagline || t("setup.pricing.baseEngine")}
                  </p>
                </div>

                <div className="mb-10 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[44px] font-semibold font-display tracking-tight">
                      {price}
                    </span>
                    <span className="text-text-muted text-[15px]">
                      {billingCycle === "MONTHLY" ? t("setup.pricing.perMo") : t("setup.pricing.perYr")}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-muted opacity-60 font-medium">
                    {t("setup.pricing.billedPerBranch", { cycle: billingCycle === "MONTHLY" ? t("setup.pricing.monthly").toLowerCase() : t("setup.pricing.yearly").toLowerCase() })}
                  </p>
                </div>

                {/* Capacity Info */}
                <div className="mb-10 p-4 rounded-xl bg-surface-3/50 border border-border-default/50 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <MultiplePages className="h-4 w-4 text-text-muted" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-medium">
                        {plan.plan_limits?.MAX_BRANCHES
                          ? t("setup.pricing.upToBranches", { limit: plan.plan_limits.MAX_BRANCHES })
                          : t("setup.pricing.unlimitedBranches")}
                      </span>
                      <span className="text-[11px] text-text-muted uppercase tracking-wider">
                        {t("setup.pricing.enterpriseCapacity")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-5 mb-10">
                  <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-text-muted">
                    {t("setup.pricing.intelligenceTier")}
                  </p>
                  <ul className="space-y-4">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 group/feat"
                      >
                        <CheckCircle className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
                        <span className="text-[14px] text-text-secondary leading-tight">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  fullWidth
                  variant={isRecommended || isCurrent ? "primary" : "secondary"}
                  className={`h-14 font-semibold text-[15px] ${isDisabled ? "opacity-30 cursor-not-allowed grayscale" : ""}`}
                  disabled={isDisabled}
                  onClick={() =>
                    isCurrent ? handleContinue() : handleSelect(plan)
                  }
                >
                  <span className="flex items-center gap-2">
                    {buttonLabel}
                    {showArrow && (
                      <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                    )}
                  </span>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Brand Assurance */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-16 border-t border-chart-grid">
          <div className="space-y-4">
            <h4 className="flex items-center gap-3 font-display font-semibold text-[17px]">
              <ShieldCheck className="h-5 w-5 text-brand-gold" />
              {t("setup.pricing.secureInfra")}
            </h4>
            <p className="text-[13px] text-text-muted leading-relaxed">
              {t("setup.pricing.secureInfraDesc")}
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="flex items-center gap-3 font-display font-semibold text-[17px]">
              <DoubleCheck className="h-5 w-5 text-brand-gold" />
              {t("setup.pricing.uptime")}
            </h4>
            <p className="text-[13px] text-text-muted leading-relaxed">
              {t("setup.pricing.uptimeDesc")}
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="flex items-center gap-3 font-display font-semibold text-[17px]">
              <div className="h-5 w-5 rounded-full border-2 border-brand-gold flex items-center justify-center text-[10px] font-bold">
                Q
              </div>
              {t("setup.pricing.prioritySupport")}
            </h4>
            <p className="text-[13px] text-text-muted leading-relaxed">
              {t("setup.pricing.prioritySupportDesc")}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
