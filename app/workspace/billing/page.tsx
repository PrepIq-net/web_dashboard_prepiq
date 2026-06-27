"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Brain,
  CheckCircle,
  Coins,
  Download,
  Reports,
  Sparks,
  WarningTriangle,
  ArrowUpCircle,
  Mail,
} from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  useBranches,
  useCurrentSubscription,
  useCurrentUserProfile,
  useInvoices,
  usePayments,
  useSubscriptions,
  useOwnerMarginProtectionReport,
  useDownloadInvoicePDF,
  useDownloadBillingReport,
  useSubscriptionPlanPricing,
} from "@/services";
import { Branch } from "@/services/branches/types";
import { Invoice, SubscriptionList } from "@/services/payment/types";
import { useTranslation } from "@/lib/i18n";

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

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function limitLabel(value?: number | null, t?: (key: string) => string) {
  if (value === null || value === undefined) return t ? t("workspace.billing.unlimited") : "Unlimited";
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

function InvoiceModal({
  invoice,
  onClose,
  onDownload,
  isDownloading,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  const { t } = useTranslation();
  const lineItems = (invoice.line_items ?? []) as Array<
    Record<string, string | number>
  >;

  return (
    <ModalShell
      open
      title={invoice.invoice_number}
      description={
        invoice.branch_name
          ? t("workspace.billing.invoice.branchPrefix", { branch: invoice.branch_name })
          : t("workspace.billing.invoice.orgInvoice")
      }
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
          >
            {t("workspace.billing.invoice.close")}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98] disabled:opacity-60"
          >
            {isDownloading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#141416]/30 border-t-[#141416]" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {isDownloading ? t("workspace.billing.invoice.generating") : t("workspace.billing.invoice.downloadPdf")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {[
          [t("workspace.billing.invoice.issueDate"), formatDate(invoice.issue_date)],
          [t("workspace.billing.invoice.dueDate"), formatDate(invoice.due_date)],
          [
            t("workspace.billing.invoice.status"),
            invoice.is_paid ? t("workspace.billing.invoice.paid") : invoice.payment_status ?? t("workspace.billing.invoice.pending"),
          ],
          [
            t("workspace.billing.invoice.subtotal"),
            `$${Number(invoice.subtotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          ],
          [
            t("workspace.billing.invoice.tax"),
            `$${Number(invoice.tax_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          ],
          [t("workspace.billing.invoice.total"), formatCurrency(Number(invoice.total_amount ?? 0))],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {label}
            </p>
            <p
              className={`mt-1 text-sm font-medium ${label === t("workspace.billing.invoice.status") && invoice.is_paid ? "text-status-success" : label === t("workspace.billing.invoice.total") ? "text-brand-gold" : "text-text-primary"}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {lineItems.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("workspace.billing.invoice.lineItems")}
          </p>
          <div className="overflow-hidden rounded-xl border border-surface-4">
            <div className="divide-y divide-surface-4/60">
              {lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-text-primary">
                    {String(item.description ?? "")}
                  </span>
                  <span className="font-medium text-text-primary">
                    ${Number(item.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {invoice.notes && (
        <p className="mt-4 text-xs text-text-muted">{invoice.notes}</p>
      )}
    </ModalShell>
  );
}

function PaymentMethodModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <ModalShell
      open
      title={t("workspace.billing.paymentMethodModal.title")}
      description={t("workspace.billing.paymentMethodModal.description")}
      onClose={onClose}
      maxWidthClassName="max-w-md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          {t("workspace.billing.paymentMethodModal.close")}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          {t("workspace.billing.paymentMethodModal.body")}
        </p>
        <a
          href="mailto:support@prepiq.app?subject=Update payment method"
          className="inline-flex items-center gap-2 rounded-xl border border-surface-4 bg-surface-3 px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-brand-gold/30 hover:text-brand-gold"
        >
          <Mail className="h-4 w-4" />
          support@prepiq.app
        </a>
      </div>
    </ModalShell>
  );
}

export default function BillingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.MANAGE_BILLING);

  const [openInvoice, setOpenInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSuccessBanner, setPaymentSuccessBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setPaymentSuccessBanner(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const subscriptionsQuery = useSubscriptions();
  const currentSubscriptionQuery = useCurrentSubscription();
  const invoicesQuery = useInvoices(undefined);
  const paymentsQuery = usePayments(undefined);
  const roiQuery = useOwnerMarginProtectionReport(undefined);
  const pricingQuery = useSubscriptionPlanPricing(undefined);

  const { mutate: handleDownloadInvoicePDF, isPending: isDownloadingInvoice } =
    useDownloadInvoicePDF();
  const {
    mutate: handleDownloadReport,
    isPending: isDownloadingReport,
    isSuccess: reportDownloaded,
  } = useDownloadBillingReport();

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
    if (!isLoading && !canAccess) router.replace("/");
  }, [isLoading, canAccess, router]);

  const activeBranches = useMemo(
    () => branches.filter((b: Branch) => b.is_active),
    [branches],
  );

  const primaryBranch =
    activeBranches.find((b: Branch) => b.is_primary) ??
    activeBranches[0] ??
    null;

  const primaryBranchSubscription = useMemo(() => {
    if (!primaryBranch) return null;
    const branchSubs = subscriptions.filter(
      (sub: SubscriptionList) => sub.branch === primaryBranch.id,
    );
    return (
      branchSubs.find((sub: SubscriptionList) => sub.status === "ACTIVE") ??
      branchSubs[0] ??
      null
    );
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
      return sum + (cycle === "yearly" ? raw / 12 : raw);
    }, 0);
  }, [summarySubscriptions]);

  const nextBillingDate = useMemo(() => {
    const dates = summarySubscriptions
      .map((sub: SubscriptionList) => sub.next_billing_date)
      .filter(Boolean)
      .map((v) => new Date(v as string))
      .filter((d: Date) => !Number.isNaN(d.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    return dates[0] ?? null;
  }, [summarySubscriptions]);

  const planLimits = currentSubscriptionQuery.data?.plan?.plan_limits ?? {};
  const maxBranches = planLimits?.MAX_BRANCHES ?? null;
  const maxStaffPerBranch = planLimits?.MAX_STAFF_PER_BRANCH ?? null;
  const maxTotalStaff = planLimits?.MAX_TOTAL_STAFF ?? null;

  const latestPayment = payments[0];
  const invoiceRows = invoices.slice(0, 8);

  const protectedRevenue = parseMoney(
    roiQuery.data?.summary?.total_money_protected_vs_baseline,
  );
  const wasteSaved = parseMoney(roiQuery.data?.summary?.total_waste_cost);
  const totalROI = protectedRevenue + wasteSaved;
  const roiMultiplier =
    monthlyTotal > 0 ? (totalROI / monthlyTotal).toFixed(1) : null;

  const expiringWarnings = useMemo(() => {
    return summarySubscriptions
      .filter((sub: SubscriptionList) => {
        const d = daysUntil(sub.next_billing_date);
        return d !== null && d <= 7 && d >= 0;
      })
      .slice(0, 2);
  }, [summarySubscriptions]);

  const recommendation = pricingQuery.data?.recommendation;
  const currentPlanName =
    primaryBranchSubscription?.plan_name ??
    currentSubscriptionQuery.data?.plan?.name ??
    t("workspace.billing.noActivePlan");

  const showLimits = maxBranches || maxStaffPerBranch || maxTotalStaff;

  const formatDaysRenew = (days: number) => {
    if (days === 0) return t("workspace.billing.renewsToday");
    return t("workspace.billing.renewsInDays", { days });
  };

  return (
    <WorkspaceShell
      eyebrow={t("workspace.billing.eyebrow")}
      title={t("workspace.billing.title")}
      description={t("workspace.billing.description")}
      insight={
        recommendation?.reason ??
        t("workspace.billing.insight.default")
      }
    >
      {openInvoice && (
        <InvoiceModal
          invoice={openInvoice}
          onClose={() => setOpenInvoice(null)}
          onDownload={() => handleDownloadInvoicePDF(openInvoice.id)}
          isDownloading={isDownloadingInvoice}
        />
      )}
      {showPaymentModal && (
        <PaymentMethodModal onClose={() => setShowPaymentModal(false)} />
      )}

      {paymentSuccessBanner && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-status-success/30 bg-status-success/8 px-4 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-4 w-4 shrink-0 text-status-success" />
            <div>
              <p className="text-[13px] font-semibold text-status-success">
                {t("workspace.billing.paymentSuccess.title")}
              </p>
              <p className="text-[12px] text-text-muted">
                {t("workspace.billing.paymentSuccess.description")}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPaymentSuccessBanner(false)}
            className="shrink-0 text-[11px] font-medium text-text-muted hover:text-text-primary"
          >
            {t("workspace.billing.paymentSuccess.dismiss")}
          </button>
        </div>
      )}

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
              {t("workspace.billing.renewsLabel")}{" "}
              <span className="font-semibold text-status-warning">
                {formatDaysRenew(days ?? 0)}
              </span>{" "}
              · {formatDate(sub.next_billing_date)}
            </p>
          </div>
        );
      })}

      {recommendation &&
        recommendation.recommended_plan_type !==
          recommendation.current_plan_type && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-gold/25 bg-brand-gold/6 px-5 py-4">
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="h-4 w-4 shrink-0 text-brand-gold" />
              <p className="text-sm text-text-primary">
                <span className="font-semibold text-brand-gold">
                  {t("workspace.billing.upgradeRecommended")}
                </span>
                {" — "}{recommendation.reason}
              </p>
            </div>
            <Link
              href="/workspace/settings?tab=plan"
              className="inline-flex h-8 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
            >
              {t("workspace.billing.viewPlans")}
            </Link>
          </div>
        )}

      <section className="mb-8 border-b border-surface-4/60 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.billing.currentPlan")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <p className="text-2xl font-semibold text-text-primary">
                {currentPlanName}
              </p>
              {highestTier &&
                !currentPlanName
                  .toUpperCase()
                  .includes(highestTier.toUpperCase()) && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${planTierClasses(highestTier)}`}
                  >
                    {highestTier}
                  </span>
                )}
              {primaryBranchSubscription?.billing_cycle && (
                <span className="inline-flex items-center rounded-full border border-surface-4 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {primaryBranchSubscription.billing_cycle}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleDownloadReport()}
              disabled={isDownloadingReport}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold disabled:opacity-60"
            >
              {isDownloadingReport ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              ) : (
                <Reports className="h-3.5 w-3.5" />
              )}
              {isDownloadingReport
                ? t("workspace.billing.generating")
                : reportDownloaded
                  ? t("workspace.billing.downloaded")
                  : t("workspace.billing.billingReport")}
            </button>
            <Link
              href="/workspace/branches/new"
              className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
            >
              {t("workspace.billing.addLocation")}
            </Link>
            <Link
              href="/workspace/billing/upgrade"
              className="inline-flex h-8 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
            >
              {t("workspace.billing.upgradePlan")}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.billing.monthlySpend")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {monthlyTotal > 0 ? formatCurrency(monthlyTotal) : "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t("workspace.billing.activeSubscriptionCount", { count: summarySubscriptions.length })}
            </p>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.billing.activeLocations")}
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
                {t("workspace.billing.atPlanLimit")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                {maxBranches
                  ? t("workspace.billing.slotsRemaining", { count: maxBranches - activeBranches.length })
                  : t("workspace.billing.unlimited")}
              </p>
            )}
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.billing.nextBilling")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">
              {nextBillingDate ? formatDate(nextBillingDate) : "—"}
            </p>
            {nextBillingDate && (
              <p className="mt-1 text-xs">
                {(() => {
                  const d = daysUntil(nextBillingDate.toISOString());
                  if (d === null) return null;
                  if (d <= 0)
                    return <span className="text-status-warning">{t("workspace.billing.dueToday")}</span>;
                  if (d <= 7)
                    return (
                      <span className="text-status-warning">
                        {t("workspace.billing.inDays", { count: d })}
                      </span>
                    );
                  return (
                    <span className="text-text-muted">{t("workspace.billing.inDays", { count: d })}</span>
                  );
                })()}
              </p>
            )}
          </article>
        </div>
      </section>

      <section className="mb-8 border-b border-surface-4/60 pb-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Brain className="h-4 w-4 text-brand-gold" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("workspace.billing.roi.title")}
            </p>
          </div>
          {roiMultiplier && Number(roiMultiplier) > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/8 px-3 py-1.5">
              <span className="text-base font-bold text-brand-gold">
                {roiMultiplier}×
              </span>
              <span className="text-xs text-text-muted">
                {t("workspace.billing.roi.returnOnSubscription")}
              </span>
            </div>
          )}
        </div>

        {monthlyTotal > 0 && totalROI > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">{t("workspace.billing.roi.youPay")}</p>
              <p className="mt-0.5 text-lg font-semibold text-text-primary">
                {formatCurrency(monthlyTotal)}
                <span className="ml-1 text-xs font-normal text-text-muted">
                  {t("workspace.billing.roi.perMonth")}
                </span>
              </p>
            </div>
            <div className="text-text-muted">→</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">{t("workspace.billing.roi.prepIqReturns")}</p>
              <p className="mt-0.5 text-lg font-semibold text-brand-gold">
                {formatCurrency(totalROI)}
                <span className="ml-1 text-xs font-normal text-text-muted">
                  {t("workspace.billing.roi.perMonth")}
                </span>
              </p>
            </div>
            <div className="shrink-0 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1">
              <span className="text-sm font-bold text-brand-gold">
                {roiMultiplier}× ROI
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-success/10">
                <Coins className="h-4 w-4 text-status-success" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.billing.roi.wasteSaved")}
              </p>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {roiQuery.data?.summary?.total_waste_cost ?? "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">{t("workspace.billing.roi.foodCostProtected")}</p>
          </article>

          <article className="rounded-xl border border-brand-gold/20 bg-surface-2 px-5 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/10">
                <Brain className="h-4 w-4 text-brand-gold" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold/80">
                {t("workspace.billing.roi.revenueProtected")}
              </p>
            </div>
            <p className="text-2xl font-semibold text-brand-gold">
              {roiQuery.data?.summary?.total_money_protected_vs_baseline ?? "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">{t("workspace.billing.roi.vsBaselineWithoutAi")}</p>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3F5FBF]/15">
                <Sparks className="h-4 w-4 text-[#8FAFF5]" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.billing.roi.forecastAccuracy")}
              </p>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {roiQuery.data?.summary?.forecast_accuracy_avg_pct
                ? `${Math.round(roiQuery.data.summary.forecast_accuracy_avg_pct)}%`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-text-muted">{t("workspace.billing.roi.meanPerformance")}</p>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-4">
                <CheckCircle className="h-4 w-4 text-text-muted" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {t("workspace.billing.roi.modelStatus")}
              </p>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {roiQuery.data?.summary?.margin_reliability?.is_reliable
                ? t("workspace.billing.roi.reliable")
                : t("workspace.billing.roi.learning")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {roiQuery.data?.summary?.margin_reliability?.warning ??
                t("workspace.billing.roi.impactModelStable")}
            </p>
          </article>
        </div>
      </section>

      <section className="mb-8 border-b border-surface-4/60 pb-8">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("workspace.billing.locationSubscriptions")}
        </p>

        {activeBranches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-4 py-12 text-center">
            <p className="text-sm font-medium text-text-primary">
              {t("workspace.billing.noActiveLocations")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t("workspace.billing.addFirstLocation")}
            </p>
            <Link
              href="/workspace/branches/new"
              className="mt-4 inline-flex h-9 items-center rounded-full bg-brand-gold px-5 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E]"
            >
              {t("workspace.billing.addLocation")}
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
                    return String(latestSub.billing_cycle ?? "").toLowerCase() ===
                      "yearly"
                      ? raw / 12
                      : raw;
                  })()
                : null;

              return (
                <div
                  key={branch.id}
                  className="flex flex-col gap-4 rounded-xl border border-surface-4 bg-surface-2 px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {branch.name}
                      </p>
                      {branch.is_primary && (
                        <span className="shrink-0 rounded-full border border-surface-4 px-2 py-0.5 text-[10px] font-medium text-text-muted">
                          {t("workspace.billing.primary")}
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
                      {latestSub?.status ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${subStatusClasses(latestSub.status)}`}
                        >
                          {latestSub.status}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-surface-4 bg-surface-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("workspace.billing.noSubscription")}
                        </span>
                      )}
                      {latestSub?.billing_cycle && (
                        <span className="text-xs text-text-muted">
                          ·{" "}
                          {latestSub.billing_cycle.charAt(0) +
                            latestSub.billing_cycle.slice(1).toLowerCase()}
                        </span>
                      )}
                      {latestSub?.is_currently_active &&
                        String(latestSub?.status ?? "")
                          .toUpperCase()
                          .includes("TRIAL") && (
                          <span className="text-xs text-brand-gold">
                            {t("workspace.billing.trialEnds")} {formatDate(latestSub.trial_ends_at as string | null | undefined)}
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 shrink-0">
                    {monthlyPrice !== null && monthlyPrice > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-text-primary">
                          {formatCurrency(monthlyPrice)}
                          <span className="ml-1 text-xs font-normal text-text-muted">
                            {t("workspace.billing.perMonth")}
                          </span>
                        </p>
                        {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 ? (
                          <p
                            className={`text-[11px] ${daysLeft <= 3 ? "text-status-warning" : "text-text-muted"}`}
                          >
                            {t("workspace.billing.renews")}{" "}
                            {daysLeft === 0 ? t("workspace.billing.today") : t("workspace.billing.inDaysShort", { count: daysLeft })}
                          </p>
                        ) : latestSub?.next_billing_date ? (
                          <p className="text-[11px] text-text-muted">
                            {formatDate(latestSub.next_billing_date)}
                          </p>
                        ) : null}
                      </div>
                    )}
                    <Link
                      href={`/workspace/billing/upgrade?branchId=${branch.id}`}
                      className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
                    >
                      {t("workspace.billing.changePlan")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showLimits && (
        <section className="mb-8 border-b border-surface-4/60 pb-8">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("workspace.billing.planLimits")}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {maxBranches && (
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("workspace.billing.locations")}
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    {activeBranches.length}
                    <span className="font-normal text-text-muted">
                      {" "}
                      / {limitLabel(maxBranches, t)}
                    </span>
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${activeBranches.length >= maxBranches ? "bg-status-warning" : "bg-brand-gold"}`}
                    style={{
                      width: `${Math.min(100, (activeBranches.length / maxBranches) * 100)}%`,
                    }}
                  />
                </div>
                {activeBranches.length >= maxBranches && (
                  <p className="mt-2 text-xs text-status-warning">
                    {t("workspace.billing.atLimitUpgrade")}
                  </p>
                )}
              </article>
            )}
            {maxStaffPerBranch && (
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("workspace.billing.staffPerLocation")}
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    {limitLabel(maxStaffPerBranch, t)}
                  </p>
                </div>
                <p className="text-xs text-text-muted">
                  {t("workspace.billing.maxStaffPerBranch")}
                </p>
              </article>
            )}
            {maxTotalStaff && (
              <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("workspace.billing.totalStaff")}
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    {limitLabel(maxTotalStaff, t)}
                  </p>
                </div>
                <p className="text-xs text-text-muted">
                  {t("workspace.billing.orgWideStaffAllowance")}
                </p>
              </article>
            )}
          </div>
        </section>
      )}

      <section className="mb-8 border-b border-surface-4/60 pb-8">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("workspace.billing.billingHistory")}
        </p>
        <div className="overflow-hidden rounded-xl border border-surface-4">
          {invoiceRows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-text-muted">
              {t("workspace.billing.noInvoices")}
            </div>
          ) : (
            <div className="divide-y divide-surface-4/60">
              {invoiceRows.map((invoice: Invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => setOpenInvoice(invoice)}
                  className="group w-full text-left"
                >
                  <div className="flex flex-col gap-3 px-5 py-4 hover:bg-surface-3/50 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-4 bg-surface-3 text-text-muted group-hover:border-brand-gold/30 group-hover:text-brand-gold">
                        <Reports className="h-4 w-4" />
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
                                {invoice.is_paid ? t("workspace.billing.paid") : invoice.payment_status}
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
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-surface-4 px-2.5 text-[11px] font-medium text-text-muted group-hover:border-brand-gold/30 group-hover:text-brand-gold">
                        <Download className="h-3 w-3" />
                        {t("workspace.billing.view")}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {invoiceRows.length > 0 && (
          <p className="mt-2 text-center text-xs text-text-muted">
            {t("workspace.billing.clickToView")}
          </p>
        )}
      </section>

      <section>
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("workspace.billing.paymentMethod")}
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
                  : t("workspace.billing.noPaymentMethod")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                {latestPayment?.completed_at && (
                  <span>
                    {t("workspace.billing.lastCharge")} {formatDate(latestPayment.completed_at)}
                  </span>
                )}
                {latestPayment?.branch_name && (
                  <span>· {latestPayment.branch_name}</span>
                )}
                {latestPayment?.payer_email && (
                  <span>· {latestPayment.payer_email}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-muted transition-colors hover:border-surface-4 hover:text-text-primary"
            >
              {t("workspace.billing.updatePaymentMethod")}
            </button>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}
