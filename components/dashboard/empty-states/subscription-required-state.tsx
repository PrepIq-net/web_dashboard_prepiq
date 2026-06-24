"use client";

import Link from "next/link";
import { ArrowRight, Shop, Calendar, DatabaseScript } from "iconoir-react";

type Variant = "none" | "trial_expired" | "expired";

type SubscriptionRequiredStateProps = {
  variant: Variant;
  compact?: boolean;
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

export function SubscriptionRequiredState({
  variant,
  compact = false,
}: SubscriptionRequiredStateProps) {
  const content = CONTENT[variant];
  const showFeatures = variant === "none";

  return (
    <section
      className={`rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] ${
        compact ? "p-6" : "p-8 md:p-10"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
        {content.eyebrow}
      </p>
      <h1
        className={`mt-3 font-display font-semibold text-[#F5F5F7] ${
          compact ? "text-[24px] leading-[32px]" : "text-[34px] leading-[42px]"
        }`}
      >
        {content.title}
      </h1>
      <p className="mt-3 max-w-3xl text-[14px] leading-[22px] text-[#8E8E93]">
        {content.description}
      </p>

      {showFeatures && (
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

      <div className="mt-7 flex items-center gap-4">
        <Link
          href={content.href}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#A8821F] px-5 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E] active:bg-[#8F6F18]"
        >
          {content.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {variant !== "none" && (
          <Link
            href="/workspace/support"
            className="text-sm text-[#8E8E93] transition-colors hover:text-[#C7C7CC]"
          >
            Contact support
          </Link>
        )}
      </div>
    </section>
  );
}
