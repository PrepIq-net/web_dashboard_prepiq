"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useBranches,
  useCurrentSubscription,
  useCurrentUserProfile,
  useInvoices,
  usePayments,
  useSubscriptions,
} from "@/services";
import { SubscriptionList } from "@/services/payment/types";

const BILLING_ROLES = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "OPS_DIRECTOR",
  "AUDITOR",
  "ACCOUNTANT",
];

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
  const role = user?.organization_role ?? "";
  const canAccess = BILLING_ROLES.includes(role);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const subscriptionsQuery = useSubscriptions();
  const currentSubscriptionQuery = useCurrentSubscription();
  const invoicesQuery = useInvoices();
  const paymentsQuery = usePayments();

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
    () => branches.filter((branch) => branch.is_active),
    [branches],
  );
  const primaryBranch =
    activeBranches.find((branch) => branch.is_primary) ??
    activeBranches[0] ??
    null;

  const primaryBranchSubscription = useMemo(() => {
    if (!primaryBranch) return null;
    const branchSubs = subscriptions.filter(
      (sub) => sub.branch === primaryBranch.id,
    );
    const active = branchSubs.find((sub) => sub.status === "ACTIVE");
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
      insight="Branch-level billing is enabled. Review plan mix and upcoming renewals regularly."
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

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#8E8E93]">
            Location Billing
          </p>
          <div className="flex gap-2">
            <button className="rounded-full border border-[#2A2A2E] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#F5F5F7]">
              Add Location
            </button>
            <button className="rounded-full border border-[#2A2A2E] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#F5F5F7]">
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
          {activeBranches.map((branch) => {
            const branchSubs = subscriptions.filter(
              (sub) => sub.branch === branch.id,
            );
            const activeSub = branchSubs.find((sub) => sub.status === "ACTIVE");
            const latestSub = activeSub ?? branchSubs[0];
            return (
              <div
                key={branch.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#2A2A2E] bg-[#16161A] px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-[15px] text-[#F5F5F7]">{branch.name}</p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Plan: {latestSub?.plan_name ?? "—"} · Status:{" "}
                    {latestSub?.status ?? "—"}
                  </p>
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

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#8E8E93]">
            Invoice History
          </p>
          <button className="rounded-full border border-[#2A2A2E] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#F5F5F7]">
            Download
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {invoiceRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#2A2A2E] p-6 text-sm text-[#8E8E93]">
              No invoices yet.
            </div>
          )}
          {invoiceRows.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-col gap-2 rounded-2xl border border-[#2A2A2E] bg-[#16161A] px-5 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-[14px] text-[#F5F5F7]">
                  {invoice.invoice_number} ·{" "}
                  {invoice.branch_name ?? "All branches"}
                </p>
                <p className="mt-1 text-[12px] text-[#8E8E93]">
                  Issued {formatDate(invoice.issue_date)} · Status{" "}
                  {invoice.payment_status ?? "—"}
                </p>
              </div>
              <div className="text-[14px] text-[#F5F5F7]">
                {formatCurrency(Number(invoice.total_amount ?? 0))}
              </div>
            </div>
          ))}
        </div>
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
