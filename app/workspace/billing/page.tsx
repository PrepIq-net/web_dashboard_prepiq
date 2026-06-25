"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  CheckCircle,
  Coins,
  Download,
  GraphUp,
  Sparks,
} from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
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

  const roiQuery = useOwnerMarginProtectionReport({
    branch_id: selectedBranchId || undefined,
  });

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

  const branchOptions = useMemo(
    () => [
      { value: "", label: "All Locations" },
      ...activeBranches.map((b: Branch) => ({ value: b.id, label: b.name })),
    ],
    [activeBranches],
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

  const planMix = useMemo(() => {
    const counts = new Map<string, number>();
    summarySubscriptions.forEach((sub: SubscriptionList) => {
      const key = sub.plan_type || sub.plan_name || "Plan";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([key, count]) => `${key} x${count}`)
      .join(", ");
  }, [summarySubscriptions]);

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

  return (
    <WorkspaceShell
      eyebrow="Executive"
      title="Billing"
      description="Plan, subscriptions, and payment operations across all active locations."
      insight={
        pricingQuery.data?.recommendation?.reason ??
        "Branch-level billing is enabled. Review plan mix and upcoming renewals regularly."
      }
    >
      <section className="pb-8 border-b border-[#2A2A2E]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              Current Plan
            </p>
            <p className="mt-2 font-display text-[28px] leading-[34px] text-[#F5F5F7]">
              {primaryBranchSubscription?.plan_name ??
                currentSubscriptionQuery.data?.plan?.name ??
                "No active plan"}
            </p>
            <p className="mt-1 text-[13px] text-[#A0A0A5]">
              {planMix || "No subscriptions yet"} · Highest tier: {highestTier}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border border-[#2A2A2E] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#F5F5F7] hover:border-[#3A3A3E]">
              Upgrade Plan
            </button>
            <button className="rounded-full border border-[#2A2A2E] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#F5F5F7] hover:border-[#3A3A3E]">
              Add Location
            </button>
            <button className="rounded-full border border-[#3A2A2A] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#E58D8D] hover:border-[#4A2F2F]">
              Cancel Subscription
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[#2A2A2E] bg-[#151518] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
              Monthly Total
            </p>
            <p className="mt-2 font-display text-[26px] text-[#F5F5F7]">
              {formatCurrency(monthlyTotal)}
            </p>
          </article>
          <article className="rounded-2xl border border-[#2A2A2E] bg-[#151518] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
              Active Locations
            </p>
            <p className="mt-2 font-display text-[26px] text-[#F5F5F7]">
              {activeBranches.length}
            </p>
          </article>
          <article className="rounded-2xl border border-[#2A2A2E] bg-[#151518] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
              Next Billing Date
            </p>
            <p className="mt-2 font-display text-[26px] text-[#F5F5F7]">
              {nextBillingDate
                ? formatDate(nextBillingDate.toISOString())
                : "—"}
            </p>
          </article>
        </div>
      </section>

      {/* Section 5 - Usage Summary (ROI) */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <GraphUp className="h-4 w-4 text-brand-gold" />
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#8E8E93]">
            PrepIQ Impact This Month —{" "}
            {selectedBranchId
              ? activeBranches.find((b: Branch) => b.id === selectedBranchId)
                  ?.name
              : "All Locations"}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <article className="rounded-2xl border border-[#2A2A2E] bg-gradient-to-b from-[#16161A] to-[#121215] px-5 py-5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C2A22] text-[#3F8F68]">
                <Coins className="h-4 w-4" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                Waste Saved
              </p>
            </div>
            <p className="mt-4 font-display text-[24px] font-semibold text-[#F5F5F7]">
              {roiQuery.data?.summary?.total_waste_cost ?? "$0"}
            </p>
            <p className="mt-1 text-[12px] text-[#3F8F68]">
              Estimated leakage protected
            </p>
          </article>

          <article className="rounded-2xl border border-[#2A2A2E] bg-gradient-to-b from-[#16161A] to-[#121215] px-5 py-5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2A241C] text-brand-gold">
                <Sparks className="h-4 w-4" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                Accuracy
              </p>
            </div>
            <p className="mt-4 font-display text-[24px] font-semibold text-[#F5F5F7]">
              {roiQuery.data?.summary?.forecast_accuracy_avg_pct
                ? `${Math.round(roiQuery.data.summary.forecast_accuracy_avg_pct)}%`
                : "—"}
            </p>
            <p className="mt-1 text-[12px] text-[#A0A0A5]">
              Mean forecast performance
            </p>
          </article>

          <article className="rounded-2xl border border-[#2A2A2E] bg-gradient-to-b from-[#16161A] to-[#121215] px-5 py-5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C202A] text-[#5E81AC]">
                <CheckCircle className="h-4 w-4" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                Status
              </p>
            </div>
            <p className="mt-4 font-display text-[24px] font-semibold text-[#F5F5F7]">
              {roiQuery.data?.summary?.margin_reliability?.is_reliable
                ? "Reliable"
                : "Learning"}
            </p>
            <p className="mt-1 text-[12px] text-[#A0A0A5]">
              {roiQuery.data?.summary?.margin_reliability?.warning ??
                "Impact model is stable"}
            </p>
          </article>

          <article className="rounded-2xl border border-[#2A2A2E] bg-[#1C1C1F] px-5 py-5 transition-transform hover:scale-[1.02] border-brand-gold/20 shadow-[0_0_20px_rgba(168,130,31,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2A241C] text-brand-gold">
                <Brain className="h-4 w-4" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-gold">
                Protected Revenue
              </p>
            </div>
            <p className="mt-4 font-display text-[24px] font-semibold text-brand-gold">
              {roiQuery.data?.summary?.total_money_protected_vs_baseline ??
                "$0"}
            </p>
            <p className="mt-1 text-[12px] text-brand-gold/70">
              Direct PrepIQ value
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#8E8E93]">
            Location Billing
          </p>
          <div className="flex items-center gap-3">
            <Select
              options={branchOptions}
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              className="min-w-[180px]"
            />
            <button className="rounded-full border border-[#2A2A2E] px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#F5F5F7] hover:bg-[#1C1C21]">
              Add Location
            </button>
            <button className="rounded-full border border-[#2A2A2E] px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#F5F5F7] hover:bg-[#1C1C21]">
              Change Plan
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {activeBranches.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#2A2A2E] p-6 text-sm text-[#8E8E93]">
              No active locations yet.
            </div>
          )}
          {activeBranches.map((branch: Branch) => {
            const branchSubs = subscriptions.filter(
              (sub: SubscriptionList) => sub.branch === branch.id,
            );
            const activeSub = branchSubs.find(
              (sub: SubscriptionList) => sub.status === "ACTIVE",
            );
            const latestSub = activeSub ?? branchSubs[0];
            return (
              <div
                key={branch.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#2A2A2E] bg-[#16161A] px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[15px] font-medium text-[#F5F5F7]">
                      {branch.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[12px] text-[#8E8E93]">
                        {latestSub?.plan_name ?? "Core"} Plan
                      </span>
                      <span className="h-1 w-1 rounded-full bg-[#2A2A2E]" />
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          latestSub?.status === "ACTIVE"
                            ? "bg-[#1C2A22] text-[#3F8F68]"
                            : "bg-[#232326] text-[#8E8E93]"
                        }`}
                      >
                        {latestSub?.status ?? "TRIALING"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-full border border-[#2A2A2E] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#F5F5F7]">
                    Remove
                  </button>
                  <button className="rounded-full border border-[#2A2A2E] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#F5F5F7]">
                    Change Plan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <p className="text-[12px] uppercase tracking-[0.16em] text-[#8E8E93]">
          Plan Limits & Usage
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[#2A2A2E] bg-[#151518] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
              Locations
            </p>
            <p className="mt-2 text-[18px] text-[#F5F5F7]">
              {activeBranches.length} / {limitLabel(maxBranches)}
            </p>
            {maxBranches && (
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#2A2A2E]">
                <div
                  className="h-full bg-brand-gold transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (activeBranches.length / maxBranches) * 100)}%`,
                  }}
                />
              </div>
            )}
          </article>
          <article className="rounded-2xl border border-[#2A2A2E] bg-[#151518] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
              Staff Per Location
            </p>
            <p className="mt-2 text-[18px] text-[#F5F5F7]">
              {limitLabel(maxStaffPerBranch)}
            </p>
          </article>
          <article className="rounded-2xl border border-[#2A2A2E] bg-[#151518] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
              Total Staff
            </p>
            <p className="mt-2 text-[18px] text-[#F5F5F7]">
              {limitLabel(maxTotalStaff)}
            </p>
          </article>
        </div>
      </section>

      {/* Section 4 - Billing History */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#8E8E93]">
            Billing History
          </p>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#2A2A2E] bg-[#16161A]">
          {invoiceRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#8E8E93]">
              No transactions detected in this billing cycle.
            </div>
          ) : (
            <div className="divide-y divide-[#2A2A2E]">
              {invoiceRows.map((invoice: Invoice) => (
                <div
                  key={invoice.id}
                  className="group flex flex-col items-start gap-4 p-5 hover:bg-[#1C1C21] md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#232326] text-[#8E8E93] group-hover:bg-[#2A2A2F] group-hover:text-[#F5F5F7]">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-[#F5F5F7]">
                        {invoice.invoice_number} ·{" "}
                        {invoice.branch_name ?? "Enterprise Plan"}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#8E8E93]">
                        {formatDate(invoice.issue_date)} ·{" "}
                        {invoice.payment_status}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between gap-6 md:w-auto">
                    <p className="text-[14px] font-semibold text-[#F5F5F7]">
                      {formatCurrency(Number(invoice.total_amount ?? 0))}
                    </p>
                    <button
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      className="flex items-center gap-2 rounded-lg border border-[#2A2A2E] px-3 py-1.5 text-[12px] text-[#F5F5F7] transition-colors hover:bg-[#2A2A2E] active:scale-95"
                    >
                      <Download className="h-3.5 w-3.5 text-[#8E8E93]" />
                      Download Invoice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {invoiceRows.length > 0 && (
          <p className="mt-3 text-center text-[12px] text-[#636366]">
            Showing last 5 invoices. Includes PDF receipts and local tax
            information.
          </p>
        )}
      </section>

      <section className="mt-10">
        <p className="text-[12px] uppercase tracking-[0.16em] text-[#8E8E93]">
          Payment Method
        </p>
        <div className="mt-4 rounded-2xl border border-[#2A2A2E] bg-[#16161A] px-5 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[15px] text-[#F5F5F7]">
                {latestPayment?.payment_method
                  ? latestPayment.payment_method.replace(/_/g, " ")
                  : "No payment method on file"}
              </p>
              <p className="mt-1 text-[12px] text-[#8E8E93]">
                Last charge{" "}
                {latestPayment?.completed_at
                  ? formatDate(latestPayment.completed_at)
                  : "—"}
                {latestPayment?.branch_name
                  ? ` · ${latestPayment.branch_name}`
                  : ""}
              </p>
            </div>
            <button className="rounded-full border border-[#2A2A2E] px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#F5F5F7]">
              Update Payment Method
            </button>
          </div>
          {latestPayment?.payer_email && (
            <p className="mt-3 text-[12px] text-[#8E8E93]">
              Billing email: {latestPayment.payer_email}
            </p>
          )}
        </div>
      </section>
    </WorkspaceShell>
  );
}
