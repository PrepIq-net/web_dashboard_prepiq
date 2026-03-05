"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CoinsSwap,
  ShieldCheck,
  CheckCircle,
} from "iconoir-react";
import { ApiError } from "@/lib/api/errors";
import { Spinner } from "@/components/ui/spinner";
import {
  useCurrentSubscription,
  useSubscriptionPlanPricing,
} from "@/services/payment/hooks";
import type { SubscriptionPlan } from "@/services/payment/types";

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
  const plansQuery = useSubscriptionPlanPricing();
  const currentSubscriptionQuery = useCurrentSubscription();

  const currentSubscriptionError = currentSubscriptionQuery.error as ApiError | null;
  const hasNoActiveSubscription = currentSubscriptionError?.status === 404;
  const currentPlanType = hasNoActiveSubscription
    ? "CORE"
    : currentSubscriptionQuery.data?.plan?.plan_type;

  const plans = useMemo(
    () => sortPlanOrder(plansQuery.data?.plans ?? []),
    [plansQuery.data?.plans],
  );
  const currentPlan = plans.find((plan) => plan.plan_type === currentPlanType);
  const recommendedPlanType = plansQuery.data?.recommendation?.recommended_plan_type;
  const recommendationReason = plansQuery.data?.recommendation?.reason;

  function handleContinueCurrent() {
    router.push("/");
  }

  function handleUpgrade(planType: string) {
    router.push(`/?upgrade=${encodeURIComponent(planType)}`);
  }

  return (
    <div className="min-h-screen bg-[#141416] p-6">
      <div className="mx-auto w-full max-w-6xl py-8">
        <div className="flex items-center gap-2 mb-8">
          <CoinsSwap className="h-4 w-4 text-[#A8821F]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Final Step - Pricing
          </span>
        </div>

        <h1 className="font-display text-[40px] leading-[48px] font-semibold text-[#F5F5F7] mb-3">
          Choose the plan that matches your operation.
        </h1>
        <p className="text-[16px] leading-[24px] text-[#8E8E93] max-w-3xl mb-10">
          Start with your current plan, or upgrade now to unlock broader controls and deeper intelligence.
        </p>

        <section className="mb-10 rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8E8E93] mb-4">
            Your workspace today
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-1">Active plan</p>
              <p className="font-display text-[26px] leading-[34px] text-[#F5F5F7]">
                {currentPlan?.name ?? "Core"}
              </p>
              <p className="text-[13px] text-[#C7C7CC] mt-1">
                {hasNoActiveSubscription
                  ? "No paid subscription yet. You are on the default Core path."
                  : "A subscription is already active for this workspace."}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-1">Branch coverage</p>
              <p className="font-display text-[26px] leading-[34px] text-[#F5F5F7]">
                {currentPlan ? maxBranchesLabel(currentPlan) : "1 branch included"}
              </p>
              <p className="text-[13px] text-[#C7C7CC] mt-1">
                Branch limits come from the selected commercial plan.
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-1">Billing model</p>
              <p className="font-display text-[26px] leading-[34px] text-[#F5F5F7]">
                {pricingModelLabel(currentPlan?.pricing_model)}
              </p>
              <p className="text-[13px] text-[#C7C7CC] mt-1">
                Command may switch to custom quote at higher location counts.
              </p>
            </div>
          </div>
          {recommendationReason ? (
            <div className="mt-5 pt-5 border-t border-[#2A2A2E]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-1">
                Recommendation Logic
              </p>
              <p className="text-[13px] text-[#C7C7CC]">{recommendationReason}</p>
            </div>
          ) : null}
        </section>

        {plansQuery.isLoading ? (
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-8">
            <div className="flex items-center justify-center gap-3 text-[#C7C7CC]">
              <Spinner size="lg" />
              <span className="text-[14px]">Loading pricing plans...</span>
            </div>
          </div>
        ) : plansQuery.isError ? (
          <div className="rounded-[12px] border border-[#6B2A2A] bg-[#2A1E1E] p-5 text-[#F2B8B5]">
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
                  ? "Upgrade to Command"
                  : `Upgrade to ${plan.name}`;
              const isRecommended = plan.plan_type === recommendedPlanType;

              return (
                <section
                  key={plan.id}
                  className={`rounded-[12px] border bg-[#1C1C1F] p-6 h-full flex flex-col ${
                    isCurrent ? "border-[#A8821F]" : "border-[#2E2E33]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div>
                      <p className="font-display text-[28px] leading-[34px] font-semibold text-[#F5F5F7]">
                        {plan.name}
                      </p>
                      <p className="text-[13px] text-[#8E8E93] mt-1">
                        {plan.tagline || planSubtitle(plan.plan_type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRecommended ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-[#3A6EA5]/20 text-[#8DB7E0] whitespace-nowrap">
                          Recommended
                        </span>
                      ) : null}
                      {isCurrent ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-[#A8821F]/15 text-[#A8821F] whitespace-nowrap">
                          Current
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-6 pb-6 border-b border-[#2A2A2E]">
                    <p className="text-[12px] uppercase tracking-[0.14em] text-[#8E8E93] mb-2">
                      Monthly
                    </p>
                    <div className="flex items-end gap-2">
                      <p className="font-display text-[44px] leading-[44px] text-[#F5F5F7]">
                        {isHybridOrCustom ? `From ${monthlyPrice}` : monthlyPrice}
                      </p>
                      <p className="text-[14px] text-[#8E8E93] pb-1">/month</p>
                    </div>
                    <p className="text-[13px] text-[#8E8E93] mt-2">Yearly: {yearlyPrice}/year</p>

                    {plan.plan_type === "CORE" ? (
                      <p className="text-[13px] text-[#3F8F68] mt-2">30-day trial included.</p>
                    ) : null}

                    {isHybridOrCustom ? (
                      <p className="text-[13px] text-[#C48B2A] mt-2">
                        {quoteThreshold
                          ? `Custom quote required above ${quoteThreshold} locations.`
                          : "Custom quote available for larger rollouts."}
                      </p>
                    ) : null}
                  </div>

                  <div className="mb-6">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-2">Capacity</p>
                    <p className="text-[15px] text-[#F5F5F7]">{maxBranchesLabel(plan)}</p>
                    <p className="text-[12px] text-[#8E8E93] mt-1">{pricingModelLabel(pricingMode)}</p>
                  </div>

                  <div className="mb-7 flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-3">What&apos;s included</p>
                    {features.length ? (
                      <ul className="space-y-3">
                        {features.map((feature) => (
                          <li
                            key={feature}
                            className="text-[14px] leading-[22px] text-[#C7C7CC] flex items-start gap-2.5"
                          >
                            <ShieldCheck className="h-4 w-4 text-[#3F8F68] shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[14px] text-[#8E8E93]">Feature details are being updated.</p>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      isCurrent ? handleContinueCurrent() : handleUpgrade(plan.plan_type)
                    }
                    className={`mt-auto w-full h-11 rounded-[8px] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150 ${
                      isCurrent
                        ? "bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416]"
                        : "bg-transparent border border-[#2E2E33] hover:bg-[#232327] text-[#F5F5F7]"
                    }`}
                  >
                    {isCurrent ? <CheckCircle className="h-4 w-4" /> : null}
                    {cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
