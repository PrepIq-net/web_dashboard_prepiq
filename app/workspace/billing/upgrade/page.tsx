"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  DoubleCheck,
  InfoCircle,
  MultiplePages,
  ArrowRight,
} from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  useBranches,
  useCurrentSubscription,
  useCurrentUserProfile,
  useSubscriptionPlanPricing,
} from "@/services";
import type { SubscriptionPlan } from "@/services/payment/types";

const PLAN_TIERS: Record<string, number> = { CORE: 1, INTELLIGENCE: 2, COMMAND: 3 };

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function sortedPlans(plans: SubscriptionPlan[]) {
  return [...plans].sort(
    (a, b) =>
      (PLAN_TIERS[a.plan_type ?? ""] ?? 99) -
      (PLAN_TIERS[b.plan_type ?? ""] ?? 99),
  );
}

function asStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export default function BillingUpgradePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchIdFromUrl = searchParams.get("branchId") ?? "";

  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const plansQuery = useSubscriptionPlanPricing();

  const [cycle, setCycle] = useState<"MONTHLY" | "YEARLY">("YEARLY");
  const [branchId, setBranchId] = useState(branchIdFromUrl);

  const branches = useMemo(
    () => (branchesQuery.data ?? []).filter((b) => b.is_active),
    [branchesQuery.data],
  );

  // Auto-select primary branch once branches load
  useEffect(() => {
    if (branchId || !branches.length) return;
    const primary = branches.find((b) => b.is_primary) ?? branches[0];
    setBranchId(primary.id);
  }, [branches, branchId]);

  const currentSubQuery = useCurrentSubscription(
    branchId ? { branch_id: branchId } : undefined,
  );

  const plans = useMemo(() => sortedPlans(plansQuery.data?.plans ?? []), [plansQuery.data]);
  const selectedBranch = branches.find((b) => b.id === branchId);
  const currentSub = currentSubQuery.data;
  const currentPlanType = currentSub?.plan?.plan_type ?? null;
  const isCurrentlyActive = currentSub?.is_currently_active ?? false;
  const currentTier = PLAN_TIERS[currentPlanType ?? ""] ?? 0;
  const recommendedType = plansQuery.data?.recommendation?.recommended_plan_type;
  const recommendationReason = plansQuery.data?.recommendation?.reason;

  function goToCheckout(plan: SubscriptionPlan) {
    const p = new URLSearchParams({ planId: plan.id, cycle });
    if (branchId) p.set("branchId", branchId);
    router.push(`/workspace/billing/checkout?${p.toString()}`);
  }

  const isLoading =
    plansQuery.isLoading || userLoading || (!!user && branchesQuery.isLoading);

  // Insight line for WorkspaceShell
  const planName = currentPlanType
    ? currentPlanType.charAt(0) + currentPlanType.slice(1).toLowerCase()
    : "";
  const insight =
    recommendationReason ??
    (currentPlanType
      ? t("workspace.billing.upgrade.insight.currentPlan", { plan: planName })
      : t("workspace.billing.upgrade.insight.noPlan"));

  const branchLabel = selectedBranch
    ? selectedBranch.name
    : t("workspace.billing.upgrade.yourLocation");

  return (
    <WorkspaceShell
      eyebrow={t("workspace.billing.upgrade.eyebrow")}
      title={t("workspace.billing.upgrade.title")}
      description={t("workspace.billing.upgrade.description", { branch: branchLabel })}
      insight={insight}
    >
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="pt-6">
          {/* Top bar: back + branch picker */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => router.push("/workspace/billing")}
              className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("workspace.billing.upgrade.backToBilling")}
            </button>

            {branches.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  {t("workspace.billing.upgrade.locationLabel")}
                </span>
                <Select
                  value={branchId}
                  onChange={setBranchId}
                  options={branches.map((b) => ({
                    value: b.id,
                    label: b.name + (b.is_primary ? ` ${t("workspace.billing.upgrade.primarySuffix")}` : ""),
                  }))}
                  placeholder={t("workspace.billing.upgrade.selectLocation")}
                />
              </div>
            )}
          </div>

          {/* AI recommendation banner */}
          {recommendationReason && (
            <div className="mb-8 flex items-start gap-3 rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-4 py-3.5">
              <InfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
              <p className="text-[13px] leading-relaxed text-text-secondary">
                {recommendationReason}
              </p>
            </div>
          )}

          {/* Billing cycle toggle */}
          <div className="mb-8 flex items-center gap-4">
            <button
              onClick={() => setCycle("MONTHLY")}
              className={`text-[13px] font-medium transition-colors ${cycle === "MONTHLY" ? "text-text-primary" : "text-text-muted"}`}
            >
              {t("workspace.billing.upgrade.monthly")}
            </button>
            <button
              onClick={() => setCycle(cycle === "MONTHLY" ? "YEARLY" : "MONTHLY")}
              className="relative h-6 w-11 rounded-full border border-surface-4 bg-surface-3 transition-colors hover:border-brand-gold/30"
              aria-label={t("workspace.billing.upgrade.toggleLabel")}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full transition-all duration-200 ${cycle === "YEARLY" ? "left-[1.375rem] bg-brand-gold" : "left-0.5 bg-text-muted/60"}`}
              />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCycle("YEARLY")}
                className={`text-[13px] font-medium transition-colors ${cycle === "YEARLY" ? "text-text-primary" : "text-text-muted"}`}
              >
                {t("workspace.billing.upgrade.yearly")}
              </button>
              <span className="rounded-full border border-status-success/20 bg-status-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-status-success">
                {t("workspace.billing.upgrade.savePercent")}
              </span>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {plans.map((plan) => {
              const planTier = PLAN_TIERS[plan.plan_type ?? ""] ?? 0;
              const isCurrent = currentPlanType === plan.plan_type;
              // Treat expired current plan as renewable (not disabled)
              const isActiveCurrentPlan = isCurrent && isCurrentlyActive;
              const isExpiredCurrentPlan = isCurrent && !isCurrentlyActive;
              const isUpgrade = planTier > currentTier;
              // Only block downgrade when there is an *active* subscription to preserve.
              // No sub or expired sub → user can freely pick any tier.
              const isDowngrade = isCurrentlyActive && currentTier > 0 && planTier < currentTier && !isCurrent;
              const isRecommended = plan.plan_type === recommendedType;

              const price =
                cycle === "MONTHLY"
                  ? toNum(plan.monthly_price)
                  : toNum(plan.yearly_price);

              const features = asStrings(plan.features);

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col overflow-hidden rounded-xl border transition-all duration-300 ${
                    isRecommended
                      ? "border-brand-gold bg-surface-2 shadow-[0_8px_32px_-8px_rgba(168,130,31,0.18)]"
                      : isCurrent
                        ? "border-brand-gold/35 bg-surface-2"
                        : "border-surface-4 bg-surface-2 hover:border-surface-4/80"
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute left-0 right-0 top-0 h-px bg-brand-gold" />
                  )}

                  <div className="flex flex-1 flex-col p-6">
                    {/* Plan name + badge */}
                    <div className="mb-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[15px] font-semibold text-text-primary">
                            {plan.name}
                          </h3>
                          {isRecommended && (
                            <span className="mt-1 inline-block rounded-full bg-brand-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-brand-gold">
                              {t("workspace.billing.upgrade.aiRecommended")}
                            </span>
                          )}
                        </div>
                        {isActiveCurrentPlan && (
                          <DoubleCheck className="h-4 w-4 shrink-0 text-brand-gold" />
                        )}
                        {isExpiredCurrentPlan && (
                          <span className="rounded-full border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-status-warning">
                            {t("workspace.billing.upgrade.expired")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[12px] text-text-muted">
                        {plan.tagline ?? t("workspace.billing.upgrade.taglineFallback")}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mb-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold text-text-primary">
                          ${price.toLocaleString()}
                        </span>
                        <span className="text-[12px] text-text-muted">
                          /{cycle === "MONTHLY" ? t("workspace.billing.upgrade.priceSuffixMonth") : t("workspace.billing.upgrade.priceSuffixYear")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {t("workspace.billing.upgrade.perLocation")}
                      </p>
                    </div>

                    {/* Capacity — a plan covers one location; its cap is staff. */}
                    <div className="mb-5 flex items-center gap-2 rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-2">
                      <MultiplePages className="h-3.5 w-3.5 text-text-muted" />
                      <span className="text-[12px] text-text-secondary">
                        {plan.plan_limits?.MAX_STAFF_PER_BRANCH
                          ? t("workspace.billing.upgrade.upToStaff", {
                              count: plan.plan_limits.MAX_STAFF_PER_BRANCH,
                            })
                          : t("workspace.billing.upgrade.unlimitedStaff")}
                      </span>
                    </div>

                    {/* Features */}
                    <ul className="mb-6 flex-1 space-y-2.5">
                      {features.slice(0, 6).map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" />
                          <span className="text-[12px] leading-snug text-text-secondary">
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {isActiveCurrentPlan ? (
                      <div className="flex h-9 w-full items-center justify-center rounded-full bg-brand-gold/10 text-[12px] font-semibold text-brand-gold">
                        {t("workspace.billing.upgrade.currentPlan")}
                      </div>
                    ) : (
                      <button
                        onClick={() => goToCheckout(plan)}
                        className={`group flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-[0.98] ${
                          isRecommended || isExpiredCurrentPlan
                            ? "bg-brand-gold text-[#141416] hover:bg-[#B8962E]"
                            : "border border-surface-4 text-text-secondary hover:border-brand-gold/40 hover:text-brand-gold"
                        }`}
                      >
                        {isExpiredCurrentPlan
                          ? t("workspace.billing.upgrade.renew", { name: plan.name })
                          : isUpgrade
                            ? t("workspace.billing.upgrade.upgradeTo", { name: plan.name })
                            : isDowngrade
                              ? t("workspace.billing.upgrade.downgradeTo", { name: plan.name })
                              : t("workspace.billing.upgrade.select", { name: plan.name })}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-[11px] text-text-muted">
            {t("workspace.billing.upgrade.footer")}
          </p>
        </div>
      )}
    </WorkspaceShell>
  );
}
