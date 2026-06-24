"use client";

import Link from "next/link";
import { ArrowRight, Crown, Sparks, Check } from "iconoir-react";

type PlanGateStateProps = {
  requiredTier: "INTELLIGENCE" | "COMMAND";
  currentPlanType: string | null;
};

const TIER_CONTENT: Record<
  "INTELLIGENCE" | "COMMAND",
  { title: string; subtitle: string; features: string[] }
> = {
  INTELLIGENCE: {
    title: "Intelligence plan required",
    subtitle:
      "This feature is part of the Intelligence tier — our margin protection layer. Upgrade to unlock the financial and operational analytics this branch needs.",
    features: [
      "Sales & waste analysis",
      "Financial reporting",
      "Staff performance",
      "Advanced forecasting",
      "Waste-to-cost attribution",
      "Executive reporting",
    ],
  },
  COMMAND: {
    title: "Command plan required",
    subtitle:
      "This feature is part of the Command tier — multi-location enterprise control. Upgrade to unlock network-level intelligence and centralized management.",
    features: [
      "Cross-branch overview",
      "Operational risk signals",
      "Network intelligence",
      "Executive command center",
      "Centralized administration",
      "Multi-location analytics",
    ],
  },
};

export function PlanGateState({ requiredTier, currentPlanType }: PlanGateStateProps) {
  const content = TIER_CONTENT[requiredTier];
  const currentLabel = currentPlanType
    ? currentPlanType.charAt(0).toUpperCase() +
      currentPlanType.slice(1).toLowerCase()
    : null;

  const TierIcon = requiredTier === "COMMAND" ? Crown : Sparks;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#A8821F]/30 bg-[#A8821F]/10 ring-1 ring-[#A8821F]/10">
        <TierIcon className="h-8 w-8 text-[#A8821F]" />
      </div>

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
        Plan Upgrade Required
      </p>

      <h2 className="mb-4 font-display text-[26px] font-semibold leading-8.5 text-[#F5F5F7]">
        {content.title}
      </h2>

      <p className="mb-2 max-w-md text-[14px] leading-6 text-[#8E8E93]">
        {content.subtitle}
      </p>
      {currentLabel ? (
        <p className="mb-10 text-[13px] text-[#636366]">
          You are currently on the{" "}
          <span className="text-[#A8A8B3]">{currentLabel}</span> plan.
        </p>
      ) : (
        <div className="mb-10" />
      )}

      {/* Feature highlights */}
      <div className="mb-10 grid w-full max-w-sm grid-cols-2 gap-2 text-left">
        {content.features.map((feature) => (
          <div
            key={feature}
            className="flex items-center gap-2 rounded-lg border border-[#2E2E33] bg-[#1C1C1F] px-3 py-2"
          >
            <Check className="h-3.5 w-3.5 shrink-0 text-[#A8821F]" />
            <span className="text-[12px] text-[#C7C7CC]">{feature}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-5">
        <Link
          href="/workspace/billing"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#A8821F] px-6 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E] active:bg-[#8F6F18]"
        >
          View Plans
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/workspace/support"
          className="text-sm text-[#636366] transition-colors hover:text-[#C7C7CC]"
        >
          Talk to sales
        </Link>
      </div>
    </div>
  );
}
