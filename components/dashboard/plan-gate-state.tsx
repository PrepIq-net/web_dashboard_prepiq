"use client";

import Link from "next/link";
import { ArrowRight } from "iconoir-react";

type PlanGateStateProps = {
  requiredTier: "INTELLIGENCE" | "COMMAND";
  currentPlanType: string | null;
};

const TIER_CONTENT: Record<
  "INTELLIGENCE" | "COMMAND",
  { title: string; description: string }
> = {
  INTELLIGENCE: {
    title: "Intelligence plan required",
    description:
      "This feature is part of the Intelligence tier — our margin protection layer. Upgrade to unlock financial intelligence, waste-to-cost attribution, advanced forecasting, and executive reporting.",
  },
  COMMAND: {
    title: "Command plan required",
    description:
      "This feature is part of the Command tier — multi-location enterprise control. Upgrade to unlock cross-branch analytics, executive command center, network intelligence, and centralized administration.",
  },
};

export function PlanGateState({ requiredTier, currentPlanType }: PlanGateStateProps) {
  const content = TIER_CONTENT[requiredTier];
  const currentLabel = currentPlanType
    ? currentPlanType.charAt(0).toUpperCase() +
      currentPlanType.slice(1).toLowerCase()
    : null;

  return (
    <section className="rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
        Plan Upgrade Required
      </p>
      <h2 className="mt-3 font-display text-[24px] font-semibold leading-[32px] text-[#F5F5F7]">
        {content.title}
      </h2>
      <p className="mt-3 max-w-2xl text-[14px] leading-[22px] text-[#8E8E93]">
        {content.description}
        {currentLabel ? ` You are currently on the ${currentLabel} plan.` : ""}
      </p>
      <div className="mt-7 flex items-center gap-4">
        <Link
          href="/workspace/billing"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#A8821F] px-5 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E] active:bg-[#8F6F18]"
        >
          View Plans
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/workspace/support"
          className="text-sm text-[#8E8E93] transition-colors hover:text-[#C7C7CC]"
        >
          Talk to sales
        </Link>
      </div>
    </section>
  );
}
