"use client";

import Link from "next/link";
import { ArrowRight, Shop, Calendar, DatabaseScript, Sparks, Crown, Check, Lock } from "iconoir-react";
import { useNotifyBillingOwners } from "@/services/payment/hooks";
import { useCurrentUserProfile } from "@/services";
import { PERMISSIONS } from "@/services/organizations/types";
import { resolvePermissions } from "@/lib/permissions";

type Variant = "none" | "trial_expired" | "expired" | "intelligence_required" | "command_required";

type BillingContact = { id: string; name: string };

type SubscriptionRequiredStateProps = {
  variant: Variant;
  compact?: boolean;
  currentPlanType?: string | null;
  /**
   * Whether the viewer holds MANAGE_BILLING. Left undefined the component
   * resolves it from the signed-in user's own permissions, so every gate in
   * the app is role-correct without each call site having to remember to pass
   * it. Pass explicitly only to override (e.g. from the API's own flag).
   *
   * When false the component drops every payment CTA — sending a line cook to
   * a checkout they cannot complete is a dead end, and it puts a spend
   * decision in front of someone with no authority to make it.
   */
  canManageBilling?: boolean;
  /** Who to name as the person who can fix it. Only used when !canManageBilling. */
  billingContacts?: BillingContact[];
  /** Branch the gate is reporting on — used to route the notify request. */
  branchId?: string;
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
    href: "/workspace/billing/upgrade",
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

// What a member without MANAGE_BILLING sees. Same underlying states, but the
// framing is "someone else needs to act", and there is no price, no plan
// comparison, and no checkout link anywhere in it.
const STAFF_CONTENT: Record<Variant, { eyebrow: string; title: string; description: string }> = {
  none: {
    eyebrow: "Not Active Yet",
    title: "This branch isn't set up for PrepIQ yet",
    description:
      "Your branch doesn't have an active PrepIQ subscription, so forecasts, prep plans, and inventory tools are switched off here. Someone with billing access needs to activate it.",
  },
  trial_expired: {
    eyebrow: "Trial Ended",
    title: "This branch's trial has ended",
    description:
      "The 30-day trial for your branch is over, so the kitchen tools are paused. Your data is safe. Someone with billing access needs to choose a plan to switch them back on.",
  },
  expired: {
    eyebrow: "Subscription Ended",
    title: "This branch's subscription has ended",
    description:
      "Your branch's PrepIQ subscription is no longer active, so forecasts and production tools are paused. Your historical data is preserved. Someone with billing access needs to reactivate it.",
  },
  intelligence_required: {
    eyebrow: "Not Included",
    title: "Not included in this branch's plan",
    description:
      "This feature belongs to the Intelligence tier, which your branch isn't on. Someone with billing access would need to change the plan.",
  },
  command_required: {
    eyebrow: "Not Included",
    title: "Not included in this branch's plan",
    description:
      "This feature belongs to the Command tier, which your branch isn't on. Someone with billing access would need to change the plan.",
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
  canManageBilling,
  billingContacts = [],
  branchId,
}: SubscriptionRequiredStateProps) {
  const { data: user } = useCurrentUserProfile();
  const resolvedCanManageBilling =
    canManageBilling ??
    resolvePermissions(user).has(PERMISSIONS.MANAGE_BILLING);

  if (!resolvedCanManageBilling) {
    return (
      <StaffSubscriptionBlockedState
        variant={variant}
        compact={compact}
        billingContacts={billingContacts}
        branchId={branchId}
      />
    );
  }

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

function formatContacts(contacts: BillingContact[]): string | null {
  const names = contacts.map((c) => c.name).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * The blocked-but-powerless state. Explains the situation in operational terms,
 * names who can fix it, and offers exactly one action: tell them. No pricing,
 * no plan grid, no checkout link.
 */
function StaffSubscriptionBlockedState({
  variant,
  compact,
  billingContacts,
  branchId,
}: {
  variant: Variant;
  compact: boolean;
  billingContacts: BillingContact[];
  branchId?: string;
}) {
  const content = STAFF_CONTENT[variant];
  const contactNames = formatContacts(billingContacts);
  const notify = useNotifyBillingOwners();

  // "Nobody holds billing" is a real org state, not a failure — the request
  // succeeded, there was just no one to route it to. Saying "sent" there would
  // leave the member waiting on a message that will never arrive.
  const noBillingOwners =
    notify.isSuccess && notify.data.reason === "NO_BILLING_OWNERS";
  const acknowledged = notify.isSuccess && !noBillingOwners;

  return (
    <section
      className={`rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] ${
        compact ? "p-6" : "p-8 md:p-10"
      }`}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#2E2E33] bg-[#232327]">
        <Lock className="h-5 w-5 text-[#8E8E93]" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8E8E93]">
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

      {contactNames && (
        <p className="mt-3 text-[13px] text-[#636366]">
          Billing for this branch is handled by{" "}
          <span className="text-[#A8A8B3]">{contactNames}</span>.
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        {acknowledged ? (
          <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#2E2E33] bg-[#232327] px-5 text-sm font-semibold text-[#C7C7CC]">
            <Check className="h-4 w-4 text-[#4E9F5B]" />
            {notify.data?.reason === "ALREADY_REQUESTED"
              ? "Already requested"
              : "Request sent"}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => notify.mutate({ branch_id: branchId })}
            disabled={notify.isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#3A3A40] bg-[#232327] px-5 text-sm font-semibold text-[#F5F5F7] transition-colors hover:bg-[#2A2A2F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {notify.isPending ? "Sending…" : "Let them know"}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <Link
          href="/workspace/chat"
          className="text-sm text-[#8E8E93] transition-colors hover:text-[#C7C7CC]"
        >
          Open chat
        </Link>
      </div>

      {noBillingOwners && (
        <p className="mt-3 text-[13px] text-[#C7625E]">
          Nobody in this workspace currently has billing access, so there was no
          one to notify. Contact support to get this sorted.
        </p>
      )}
      {notify.isError && (
        <p className="mt-3 text-[13px] text-[#C7625E]">
          Couldn&apos;t send that just now. Try again, or message them in chat.
        </p>
      )}
    </section>
  );
}
