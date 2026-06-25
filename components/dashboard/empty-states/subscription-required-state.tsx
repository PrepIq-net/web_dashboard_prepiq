"use client";

import Link from "next/link";
import { ArrowRight, Shop, Calendar, DatabaseScript, Sparks, Crown, Check } from "iconoir-react";

type Variant = "none" | "trial_expired" | "expired" | "intelligence_required" | "command_required";

type SubscriptionRequiredStateProps = {
  variant: Variant;
  compact?: boolean;
  currentPlanType?: string | null;
};

const CONTENT: Record<
  Variant,
  { eyebrow: string; title: string; description: string; cta: string; href: string }
> = {
  none: {
    eyebrow: "Get Started",
    title: "Start your 30-day free trial",
    description:
      "Your PrepIQ workspace is ready. Activate your free trial to access daily prep forecasts, production workflow, inventory intelligence, and waste tracking — no credit card required.",
    cta: "Start Free Trial",
    href: "/setup/pricing",
  },
  trial_expired: {
    eyebrow: "Trial Ended",
    title: "Your trial has ended",
    description:
      "Your 30-day trial is complete. Choose a plan to keep access to your kitchen data, forecasts, and production tools. Your data is safe and waiting.",
    cta: "Choose a Plan",
    href: "/workspace/billing",
  },
  expired: {
    eyebrow: "Subscription Ended",
    title: "Your subscription has ended",
    description:
      "Your PrepIQ subscription is no longer active. Reactivate to restore access to your forecasts, production data, and kitchen intelligence. Your historical data is preserved.",
    cta: "Reactivate",
    href: "/workspace/billing",
  },
  intelligence_required: {
    eyebrow: "Plan Upgrade Required",
    title: "Intelligence plan required",
    description:
      "This feature is part of the Intelligence tier — our margin protection layer. Upgrade to unlock financial and operational analytics for this branch.",
    cta: "View Plans",
    href: "/workspace/billing",
  },
  command_required: {
    eyebrow: "Plan Upgrade Required",
    title: "Command plan required",
    description:
      "This feature is part of the Command tier — multi-location enterprise control. Upgrade to unlock network-level intelligence and centralized management.",
    cta: "View Plans",
    href: "/workspace/billing",
  },
};

const FEATURE_CARDS = [
  {
    icon: <DatabaseScript className="h-4 w-4 text-[#A8821F]" />,
    label: "Daily prep forecasts",
    detail: "AI demand prediction, planned vs suggested quantities, and confidence scores.",
  },
  {
    icon: <Calendar className="h-4 w-4 text-[#A8821F]" />,
    label: "Planning calendar",
    detail: "Events, promotions, and seasonal context factored into every service day.",
  },
  {
    icon: <Shop className="h-4 w-4 text-[#A8821F]" />,
    label: "Inventory & waste",
    detail: "Ingredients, 86 tracking, stockout alerts, and waste logging.",
  },
];

const TIER_FEATURES: Record<"intelligence_required" | "command_required", string[]> = {
  intelligence_required: [
    "Sales & waste analysis",
    "Financial reporting",
    "Staff performance",
    "Advanced forecasting",
    "Waste-to-cost attribution",
    "Executive reporting",
  ],
  command_required: [
    "Cross-branch overview",
    "Operational risk signals",
    "Network intelligence",
    "Executive command center",
    "Centralized administration",
    "Multi-location analytics",
  ],
};

export function SubscriptionRequiredState({
  variant,
  compact = false,
  currentPlanType,
}: SubscriptionRequiredStateProps) {
  const content = CONTENT[variant];
  const showTrialFeatures = variant === "none";
  const isTierGate = variant === "intelligence_required" || variant === "command_required";
  const TierIcon = variant === "command_required" ? Crown : Sparks;
  const currentLabel = currentPlanType
    ? currentPlanType.charAt(0).toUpperCase() + currentPlanType.slice(1).toLowerCase()
    : null;

  return (
    <section
      className={`rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] ${
        compact ? "p-6" : "p-8 md:p-10"
      }`}
    >
      {isTierGate && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#A8821F]/30 bg-[#A8821F]/10">
          <TierIcon className="h-5 w-5 text-[#A8821F]" />
        </div>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
        {content.eyebrow}
      </p>
      <h1
        className={`mt-3 font-display font-semibold text-[#F5F5F7] ${
          compact ? "text-[24px] leading-8" : "text-[34px] leading-10.5"
        }`}
      >
        {content.title}
      </h1>
      <p className="mt-3 max-w-3xl text-[14px] leading-5.5 text-[#8E8E93]">
        {content.description}
      </p>
      {isTierGate && currentLabel && (
        <p className="mt-2 text-[13px] text-[#636366]">
          You are currently on the <span className="text-[#A8A8B3]">{currentLabel}</span> plan.
        </p>
      )}

      {showTrialFeatures && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {FEATURE_CARDS.map((card) => (
            <div
              key={card.label}
              className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-4"
            >
              <div className="flex items-center gap-2 text-[#C7C7CC]">
                {card.icon}
                <p className="text-[13px] font-semibold">{card.label}</p>
              </div>
              <p className="mt-2 text-[12px] text-[#8E8E93]">{card.detail}</p>
            </div>
          ))}
        </div>
      )}

      {isTierGate && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIER_FEATURES[variant].map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-2 rounded-lg border border-[#2E2E33] bg-[#232327] px-3 py-2"
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-[#A8821F]" />
              <span className="text-[12px] text-[#C7C7CC]">{feature}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7 flex items-center gap-4">
        <Link
          href={content.href}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#A8821F] px-5 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E] active:bg-[#8F6F18]"
        >
          {content.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {variant !== "none" && (
          <Link
            href="/workspace/support"
            className="text-sm text-[#8E8E93] transition-colors hover:text-[#C7C7CC]"
          >
            {isTierGate ? "Talk to sales" : "Contact support"}
          </Link>
        )}
      </div>
    </section>
  );
}
