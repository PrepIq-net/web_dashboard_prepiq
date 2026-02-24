"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CoinsSwap, ShieldCheck, Spark } from "iconoir-react";
import { ApiError } from "@/lib/api/errors";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentSubscription, useSubscriptionPlanPricing } from "@/services/payment/hooks";
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

function formatMoney(value: unknown, suffix: "mo" | "yr") {
  const amount = toNumber(value);
  return `$${amount.toLocaleString()}/${suffix}`;
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
  if (mode === "HYBRID_BASE_PLUS_CUSTOM") return "Published + Custom Quote";
  if (mode === "CUSTOM_ONLY") return "Custom Quote";
  return "Published";
}

function maxBranchesLabel(plan: SubscriptionPlan) {
  const value = plan.plan_limits?.MAX_BRANCHES;
  if (typeof value !== "number") return "Unlimited branches";
  if (value <= 1) return "1 branch";
  return `${value} branches`;
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

  const plans = sortPlanOrder(plansQuery.data ?? []);
  const currentPlan = plans.find((plan) => plan.plan_type === currentPlanType);

  function handleContinueCore() {
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
            Final Step - Plan Selection
          </span>
        </div>

        <h1 className="font-display text-[40px] leading-[48px] font-semibold text-[#F5F5F7] mb-3">
          Keep your trial or unlock advanced controls.
        </h1>
        <p className="text-[16px] leading-[24px] text-[#8E8E93] max-w-3xl mb-10">
          PrepIQ has adapted to your real workflow first. Continue on Core trial
          for day-one operations, or upgrade to unlock deeper intelligence and
          command features.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8E8E93] mb-1">
              Current Plan
            </p>
            <p className="font-display text-[22px] leading-[30px] text-[#F5F5F7]">
              {currentPlan?.name ?? "Core"}
            </p>
            <p className="text-[12px] text-[#C7C7CC] mt-1">
              {hasNoActiveSubscription
                ? "No paid subscription yet. Core path remains available."
                : "Active subscription detected for your workspace."}
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8E8E93] mb-1">
              Pricing Model
            </p>
            <p className="font-display text-[22px] leading-[30px] text-[#F5F5F7]">
              {pricingModelLabel(currentPlan?.pricing_model)}
            </p>
            <p className="text-[12px] text-[#C7C7CC] mt-1">
              Command can require a custom quote for larger location counts.
            </p>
          </div>
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8E8E93] mb-1">
              Branch Coverage
            </p>
            <p className="font-display text-[22px] leading-[30px] text-[#F5F5F7]">
              {currentPlan ? maxBranchesLabel(currentPlan) : "1 branch"}
            </p>
            <p className="text-[12px] text-[#C7C7CC] mt-1">
              Limits are enforced from your selected commercial plan.
            </p>
          </div>
        </div>

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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
              const quoteThreshold = pricingDetails.custom_quote_required_above_locations;
              const features = asStringArray(plan.features);

              const monthlyPrice = formatMoney(plan.monthly_price, "mo");
              const yearlyPrice = formatMoney(plan.yearly_price, "yr");
              const cta = isCurrent
                ? "Continue Current Plan"
                : plan.plan_type === "COMMAND" && isHybridOrCustom
                  ? "Upgrade to Command"
                  : `Upgrade to ${plan.name}`;

            return (
              <section
                key={plan.id}
                className={`rounded-[12px] border p-5 bg-[#1C1C1F] h-full flex flex-col ${
                  isCurrent ? "border-[#A8821F]" : "border-[#2E2E33]"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-display text-[24px] leading-[32px] font-semibold text-[#F5F5F7]">
                      {plan.name}
                    </p>
                    <p className="text-[12px] text-[#8E8E93]">{plan.tagline || ""}</p>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-1 rounded-full bg-[#A8821F]/15 text-[#A8821F]">
                      Current Plan
                    </span>
                  ) : (
                    <Spark className="h-4 w-4 text-[#8E8E93]" />
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-1">
                    {pricingModelLabel(pricingMode)}
                  </p>
                  <p className="text-[20px] font-semibold text-[#F5F5F7]">
                    {isHybridOrCustom ? `Starting at ${monthlyPrice}` : monthlyPrice}
                  </p>
                  <p className="text-[12px] text-[#8E8E93]">
                    {isHybridOrCustom ? `Base ${yearlyPrice}` : `or ${yearlyPrice}`}
                  </p>
                  {plan.plan_type === "CORE" ? (
                    <p className="text-[12px] text-[#3F8F68] mt-1">
                      30-day trial included
                    </p>
                  ) : null}
                  {isHybridOrCustom ? (
                    <p className="text-[12px] text-[#A8821F] mt-1">
                      {quoteThreshold
                        ? `Custom quote required above ${quoteThreshold} locations`
                        : "Custom quote available for enterprise scale"}
                    </p>
                  ) : null}
                </div>

                <div className="mb-4 rounded-[8px] border border-[#2A2A2E] bg-[#232327] px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                    Included Capacity
                  </p>
                  <p className="text-[13px] text-[#F5F5F7] mt-1">
                    {maxBranchesLabel(plan)}
                  </p>
                </div>

                <ul className="space-y-2 mb-5">
                  {features.map((feature) => (
                    <li
                      key={feature}
                      className="text-[13px] text-[#C7C7CC] flex items-start gap-2"
                    >
                      <ShieldCheck className="h-4 w-4 text-[#3F8F68] shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() =>
                    isCurrent ? handleContinueCore() : handleUpgrade(plan.plan_type)
                  }
                  className={`mt-auto w-full h-11 rounded-[8px] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors duration-150 ${
                    isCurrent
                      ? "bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416]"
                      : "bg-transparent border border-[#2E2E33] hover:bg-[#232327] text-[#F5F5F7]"
                  }`}
                >
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
