"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  CheckCircle,
  Coins,
  Download,
  Sparks,
  WarningTriangle,
  ArrowUpCircle,
} from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useBranches,
  useCurrentSubscription,
  useCurrentUserProfile,
  useInvoices,
  usePayments,
  useSubscriptions,
  useOwnerMarginProtectionReport,
  useDownloadInvoice,
  useSubscriptionPlanPricing,
} from "@/services";
import { Branch } from "@/services/branches/types";
import { Invoice, SubscriptionList } from "@/services/payment/types";
import { useState } from "react";

const PLAN_RANK: Record<string, number> = {
  CORE: 1,
  INTELLIGENCE: 2,
  COMMAND: 3,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function limitLabel(value?: number | null) {
  if (value === null || value === undefined) return "Unlimited";
  return String(value);
}

function parseMoney(value: string | number | undefined | null): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function subStatusClasses(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE")
    return "border-status-success/30 bg-status-success/10 text-status-success";
  if (s === "TRIALING")
    return "border-brand-gold/30 bg-brand-gold/10 text-brand-gold";
  if (s === "EXPIRED" || s === "CANCELLED")
    return "border-status-critical/30 bg-status-critical/10 text-status-critical";
  if (s === "SUSPENDED")
    return "border-status-warning/30 bg-status-warning/10 text-status-warning";
  return "border-surface-4 bg-surface-3 text-text-muted";
}

function planTierClasses(planType: string) {
  const t = (planType || "").toUpperCase();
  if (t === "COMMAND") return "bg-brand-gold/15 text-brand-gold";
  if (t === "INTELLIGENCE") return "bg-[#3F5FBF]/20 text-[#8FAFF5]";
  return "bg-surface-4 text-text-muted";
}

export default function BillingPage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.MANAGE_BILLING);

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const subscriptionsQuery = useSubscriptions();
  const currentSubscriptionQuery = useCurrentSubscription();
  const invoicesQuery = useInvoices({
    branch_id: selectedBranchId || undefined,
  });
  const paymentsQuery = usePayments({
    branch_id: selectedBranchId || undefined,
  });
  const roiQuery = useOwnerMarginProtectionReport(
    selectedBranchId ? { branch_id: selectedBranchId } : undefined,
  );
  const pricingQuery = useSubscriptionPlanPricing({
    branch_id: selectedBranchId || undefined,
  });

  const { mutate: handleDownloadInvoice } = useDownloadInvoice();

  const branches = branchesQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  const activeSubscriptions = useMemo(
    () =>
      subscriptions.filter((sub: SubscriptionList) => sub.status === "ACTIVE"),
    [subscriptions],
  );
  const summarySubscriptions =
    activeSubscriptions.length > 0 ? activeSubscriptions : subscriptions;

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const activeBranches = useMemo(
    () => branches.filter((branch: Branch) => branch.is_active),
    [branches],
  );

  const primaryBranch =
    activeBranches.find((branch: Branch) => branch.is_primary) ??
    activeBranches[0] ??
    null;

  const primaryBranchSubscription = useMemo(() => {
    if (!primaryBranch) return null;
    const branchSubs = subscriptions.filter(
      (sub: SubscriptionList) => sub.branch === primaryBranch.id,
    );
    const active = branchSubs.find(
      (sub: SubscriptionList) => sub.status === "ACTIVE",
    );
    return active ?? branchSubs[0] ?? null;
  }, [subscriptions, primaryBranch]);

  const highestTier = useMemo(() => {
    let top = "";
    let rank = 0;
    summarySubscriptions.forEach((sub: SubscriptionList) => {
      const planType = String(sub.plan_type ?? "").toUpperCase();
      const nextRank = PLAN_RANK[planType] ?? 0;
      if (nextRank > rank) {
        rank = nextRank;
        top = planType;
      }
    });
    return top || "CORE";
  }, [summarySubscriptions]);

  const monthlyTotal = useMemo(() => {
    return summarySubscriptions.reduce((sum: number, sub: SubscriptionList) => {
      const raw = Number(sub.price_at_subscription ?? 0);
      const cycle = String(sub.billing_cycle ?? "").toLowerCase();
      const monthly = cycle === "yearly" ? raw / 12 : raw;
      return sum + monthly;
    }, 0);
  }, [summarySubscriptions]);

  const nextBillingDate = useMemo(() => {
    const dates = summarySubscriptions
      .map((sub: SubscriptionList) => sub.next_billing_date)
      .filter(Boolean)
      .map((value) => new Date(value as string))
      .filter((value: Date) => !Number.isNaN(value.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    return dates[0] ?? null;
  }, [summarySubscriptions]);

  const planLimits = currentSubscriptionQuery.data?.plan?.plan_limits ?? {};
  const maxBranches = planLimits?.MAX_BRANCHES ?? null;
  const maxStaffPerBranch = planLimits?.MAX_STAFF_PER_BRANCH ?? null;
  const maxTotalStaff = planLimits?.MAX_TOTAL_STAFF ?? null;

  const latestPayment = payments[0];
  const invoiceRows = invoices.slice(0, 5);

  // ROI multiplier
  const protectedRevenue = parseMoney(
    roiQuery.data?.summary?.total_money_protected_vs_baseline,
  );
  const wasteSaved = parseMoney(roiQuery.data?.summary?.total_waste_cost);
  const totalROI = protectedRevenue + wasteSaved;
  const roiMultiplier =
    monthlyTotal > 0 ? (totalROI / monthlyTotal).toFixed(1) : null;

  // Expiry warnings: subscriptions expiring in ≤7 days
  const expiringWarnings = useMemo(() => {
    return summarySubscriptions
      .filter((sub: SubscriptionList) => {
        const days = daysUntil(sub.next_billing_date);
        return days !== null && days <= 7 && days >= 0;
      })
      .slice(0, 2);
  }, [summarySubscriptions]);

  const recommendation = pricingQuery.data?.recommendation;

  const currentPlanName =
    primaryBranchSubscription?.plan_name ??
    currentSubscriptionQuery.data?.plan?.name ??
    "No active plan";

  return (
    <WorkspaceShell
      eyebrow="Executive"
      title="Billing"
      description="Plan, subscriptions, and ROI across all active locations."
      insight={
        recommendation?.reason ??
        "Review your plan mix and upcoming renewals regularly."
      }
    >
      {/* ── Expiry warnings ── */}
      {expiringWarnings.map((sub: SubscriptionList) => {
        const days = daysUntil(sub.next_billing_date);
        return (
          <div
            key={sub.id}
            className="mb-4 flex items-center gap-3 rounded-xl border border-status-warning/30 bg-status-warning/8 px-4 py-3"
          >
            <WarningTriangle className="h-4 w-4 shrink-0 text-status-warning" />
            <p className="text-sm text-text-primary">
              <span className="font-semibold">{sub.branch_name}</span>{" "}
              subscription renews in{" "}
              <span className="font-semibold text-status-warning">
                {days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`}
              </span>{" "}
              · {formatDate(sub.next_billing_date)}
            </p>
          </div>
        );
      })}

      {/* ── Upgrade recommendation banner ── */}
      {recommendation &&
        recommendation.recommended_plan_type !==
          recommendation.current_plan_type && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-gold/25 bg-brand-gold/6 px-5 py-4">
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="h-4 w-4 shrink-0 text-brand-gold" />
              <p className="text-sm text-text-primary">
                <span className="font-semibold text-brand-gold">
                  Upgrade recommended
                </span>{" "}
                — {recommendation.reason}
              </p>
            </div>
            <Link
              href="/workspace/settings?tab=plan"
              className="inline-flex h-8 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
            >
              View Plans
            </Link>
          </div>
        )}

      {/* ── Section 1: Plan snapshot ── */}
      <section className="border-b border-surface-4/60 pb-8 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Current Plan
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-2xl font-semibold text-text-primary">
                {currentPlanName}
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${planTierClasses(highestTier)}`}
              >
                {highestTier}
              </span>
              {primaryBranchSubscription?.billing_cycle && (
                <span className="inline-flex items-center rounded-full border border-surface-4 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {primaryBranchSubscription.billing_cycle}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/workspace/branches/new"
              className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
            >
              + Add Location
            </Link>
            <Link
              href="/workspace/settings?tab=plan"
              className="inline-flex h-8 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
            >
              Upgrade Plan
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Monthly spend
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {monthlyTotal > 0 ? formatCurrency(monthlyTotal) : "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {summarySubscriptions.length} active subscription
              {summarySubscriptions.length !== 1 ? "s" : ""}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Active locations
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {activeBranches.length}
              {maxBranches ? (
                <span className="ml-1 text-sm font-normal text-text-muted">
                  / {maxBranches}
                </span>
              ) : null}
            </p>
            {maxBranches && activeBranches.length >= maxBranches ? (
              <p className="mt-1 text-xs text-status-warning">
                At plan limit — upgrade to add more
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                {maxBranches
                  ? `${maxBranches - activeBranches.length} slot${maxBranches - activeBranches.length !== 1 ? "s" : ""} remaining`
                  : "Unlimited"}
              </p>
            )}
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Next billing
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {nextBillingDate ? formatDate(nextBillingDate.toISOString()) : "—"}
            </p>
            {nextBillingDate && (
              <p className="mt-1 text-xs text-text-muted">
                {(() => {
                  const d = daysUntil(nextBillingDate.toISOString());
                  if (d === null) return "";
                  if (d <= 0) return "Due today";
                  if (d <= 7)
                    return (
                      <span className="text-status-warning">
                        in {d} day{d !== 1 ? "s" : ""}
                      </span>
                    );
                  return `in ${d} days`;
                })()}
              </p>
            )}
          </article>
        </div>
      </section>

      {/* ── Section 2: PrepIQ ROI ── */}
      <section className="border-b border-surface-4/60 pb-8 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <Brain className="h-4 w-4 text-brand-gold" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              PrepIQ return this month
            </p>
          </div>
          {roiMultiplier && Number(roiMultiplier) > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/8 px-3 py-1">
              <span className="text-sm font-bold text-brand-gold">
                {roiMultiplier}×
              </span>
              <span className="text-xs text-text-muted">return on spend</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-success/10">
                <Coins className="h-4 w-4 text-status-success" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Waste saved
              </p>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {roiQuery.data?.summary?.total_waste_cost ?? "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Food cost protected
            </p>
          </article>

          <article className="rounded-xl border border-brand-gold/20 bg-surface-2 px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/10">
                <Brain className="h-4 w-4 text-brand-gold" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold/80">
                Revenue protected
              </p>
            </div>
            <p className="text-2xl font-semibold text-brand-gold">
              {roiQuery.data?.summary?.total_money_protected_vs_baseline ?? "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              vs. baseline without AI
            </p>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3F5FBF]/15">
                <Sparks className="h-4 w-4 text-[#8FAFF5]" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Forecast accuracy
              </p>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {roiQuery.data?.summary?.forecast_accuracy_avg_pct
                ? `${Math.round(roiQuery.data.summary.forecast_accuracy_avg_pct)}%`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Mean prediction performance
            </p>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-4">
                <CheckCircle className="h-4 w-4 text-text-muted" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Model status
              </p>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {roiQuery.data?.summary?.margin_reliability?.is_reliable
                ? "Reliable"
                : "Learning"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {roiQuery.data?.summary?.margin_reliability?.warning ??
                "Impact model stable"}
            </p>
          </article>
        </div>
      </section>

      {/* ── Section 3: Location subscriptions ── */}
      <section className="border-b border-surface-4/60 pb-8 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Location subscriptions
          </p>
          <Link
            href="/workspace/branches/new"
            className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
          >
            + Add Location
          </Link>
        </div>

        {activeBranches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-4 py-12 text-center">
            <p className="text-sm font-medium text-text-primary">
              No active locations
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Add your first location to start a subscription.
            </p>
            <Link
              href="/workspace/branches/new"
              className="mt-4 inline-flex h-9 items-center rounded-full bg-brand-gold px-5 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E]"
            >
              + Add Location
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeBranches.map((branch: Branch) => {
              const branchSubs = subscriptions.filter(
                (sub: SubscriptionList) => sub.branch === branch.id,
              );
              const activeSub = branchSubs.find(
                (sub: SubscriptionList) => sub.status === "ACTIVE",
              );
              const latestSub = activeSub ?? branchSubs[0];
              const daysLeft = daysUntil(latestSub?.next_billing_date);
              const monthlyPrice = latestSub
                ? (() => {
                    const raw = Number(latestSub.price_at_subscription ?? 0);
                    const cycle = String(
                      latestSub.billing_cycle ?? "",
                    ).toLowerCase();
                    return cycle === "yearly" ? raw / 12 : raw;
                  })()
                : null;

              return (
                <div
                  key={branch.id}
                  className="flex flex-col gap-4 rounded-xl border border-surface-4 bg-surface-2 px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {branch.name}
                        </p>
                        {branch.is_primary && (
                          <span className="shrink-0 rounded-full border border-surface-4 px-2 py-0.5 text-[10px] font-medium text-text-muted">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {latestSub?.plan_type && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${planTierClasses(latestSub.plan_type)}`}
                          >
                            {latestSub.plan_name ?? latestSub.plan_type}
                          </span>
                        )}
                        {latestSub?.status && (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${subStatusClasses(latestSub.status)}`}
                          >
                            {latestSub.status === "ACTIVE" &&
                            latestSub.is_currently_active
                              ? "Active"
                              : latestSub.status}
                          </span>
                        )}
                        {!latestSub && (
                          <span className="inline-flex items-center rounded-full border border-surface-4 bg-surface-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                            No subscription
                          </span>
                        )}
                        {latestSub?.billing_cycle && (
                          <span className="text-xs text-text-muted">
                            ·{" "}
                            {latestSub.billing_cycle.charAt(0) +
                              latestSub.billing_cycle.slice(1).toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 shrink-0">
                    {monthlyPrice !== null && monthlyPrice > 0 ? (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-text-primary">
                          {formatCurrency(monthlyPrice)}
                          <span className="ml-1 text-xs font-normal text-text-muted">
                            /mo
                          </span>
                        </p>
                        {daysLeft !== null && daysLeft <= 14 ? (
                          <p
                            className={`text-[11px] ${daysLeft <= 3 ? "text-status-warning" : "text-text-muted"}`}
                          >
                            Renews {daysLeft === 0 ? "today" : `in ${daysLeft}d`}
                          </p>
                        ) : latestSub?.next_billing_date ? (
                          <p className="text-[11px] text-text-muted">
                            {formatDate(latestSub.next_billing_date)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/workspace/settings?tab=plan&branch=${branch.id}`}
                        className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
                      >
                        Change Plan
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 4: Plan limits ── */}
      {(maxBranches || maxStaffPerBranch || maxTotalStaff) && (
        <section className="border-b border-surface-4/60 pb-8 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-5">
            Plan limits & usage
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {maxBranches && (
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Locations
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    {activeBranches.length}
                    <span className="font-normal text-text-muted">
                      {" "}
                      / {limitLabel(maxBranches)}
                    </span>
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeBranches.length >= maxBranches
                        ? "bg-status-warning"
                        : "bg-brand-gold"
                    }`}
                    style={{
                      width: `${Math.min(100, (activeBranches.length / maxBranches) * 100)}%`,
                    }}
                  />
                </div>
                {activeBranches.length >= maxBranches && (
                  <p className="mt-2 text-xs text-status-warning">
                    At limit — upgrade to add more
                  </p>
                )}
              </article>
            )}
            {maxStaffPerBranch && (
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Staff / location
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    {limitLabel(maxStaffPerBranch)}
                  </p>
                </div>
                <p className="text-xs text-text-muted">
                  Max staff per branch on this plan
                </p>
              </article>
            )}
            {maxTotalStaff && (
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    Total staff
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    {limitLabel(maxTotalStaff)}
                  </p>
                </div>
                <p className="text-xs text-text-muted">
                  Org-wide staff allowance
                </p>
              </article>
            )}
          </div>
        </section>
      )}

      {/* ── Section 5: Billing history ── */}
      <section className="border-b border-surface-4/60 pb-8 mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-5">
          Billing history
        </p>
        <div className="overflow-hidden rounded-xl border border-surface-4">
          {invoiceRows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-text-muted">
              No invoices yet.
            </div>
          ) : (
            <div className="divide-y divide-surface-4/60">
              {invoiceRows.map((invoice: Invoice) => (
                <div
                  key={invoice.id}
                  className="group flex flex-col gap-4 px-5 py-4 hover:bg-surface-3/50 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-4 bg-surface-3 text-text-muted group-hover:text-text-secondary">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {invoice.invoice_number}
                        {invoice.branch_name
                          ? ` · ${invoice.branch_name}`
                          : ""}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                        <span>{formatDate(invoice.issue_date)}</span>
                        {invoice.payment_status && (
                          <>
                            <span>·</span>
                            <span
                              className={
                                invoice.is_paid
                                  ? "text-status-success"
                                  : "text-text-muted"
                              }
                            >
                              {invoice.payment_status}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-6 md:justify-end">
                    <p className="text-sm font-semibold text-text-primary">
                      {formatCurrency(Number(invoice.total_amount ?? 0))}
                    </p>
                    <button
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-surface-4 hover:text-text-primary active:scale-95"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {invoiceRows.length > 0 && (
          <p className="mt-2 text-center text-xs text-text-muted">
            Showing last 5 invoices
          </p>
        )}
      </section>

      {/* ── Section 6: Payment method ── */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-5">
          Payment method
        </p>
        <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                {latestPayment?.payment_method
                  ? latestPayment.payment_method
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : "No payment method on file"}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {latestPayment?.completed_at
                  ? `Last charge ${formatDate(latestPayment.completed_at)}`
                  : "No charges recorded"}
                {latestPayment?.branch_name
                  ? ` · ${latestPayment.branch_name}`
                  : ""}
              </p>
              {latestPayment?.payer_email && (
                <p className="mt-1 text-xs text-text-muted">
                  Billing email: {latestPayment.payer_email}
                </p>
              )}
            </div>
            <button className="inline-flex h-8 shrink-0 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-muted transition-colors hover:border-surface-4 hover:text-text-primary">
              Update Payment Method
            </button>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}
