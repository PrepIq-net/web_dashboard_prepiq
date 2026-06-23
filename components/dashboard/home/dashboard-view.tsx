"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, StatsUpSquare, StatsDownSquare, Shop } from "iconoir-react";
import { useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";
import { ModalShell } from "@/components/ui/modal-shell";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type BranchEntry = NonNullable<
  ReturnType<typeof useExecutiveControlTower>["data"]
>["branch_grid"][number];

type AlertEntry = NonNullable<
  ReturnType<typeof useExecutiveControlTower>["data"]
>["alerts"][number];

type Diagnosis = {
  issue: string | null;
  detail: string | null;
  ctaLabel: string;
  ctaHref: string;
  severity: "critical" | "warning" | "ok";
};

// ─────────────────────────────────────────────────────────────────────────────
// Branch diagnosis
// Ordered by impact: blocking ops first, financial loss second, data gaps third.
// ─────────────────────────────────────────────────────────────────────────────

function diagnoseBranch(branch: BranchEntry): Diagnosis {
  // Each destination has its own URL param convention.
  // today page reads ?branch_id=, all others read ?branch=
  const bid = branch.branch_id;
  const toToday = `/workspace/today?branch_id=${bid}`;
  const toWaste = `/workspace/sales-waste?branch=${bid}`;
  const toSettings = `/workspace/settings?tab=integrations&branch=${bid}`;
  const wastePct = Number(branch.waste_pct ?? 0);

  // 1. Plan not locked — branch is blocked from starting live service
  if (!branch.plan_locked && (branch.day_status === "MORNING" || branch.day_status == null)) {
    return {
      issue: "Prep plan hasn't been approved",
      detail: "The branch can't go live until a manager locks today's plan.",
      ctaLabel: "Review and approve plan",
      ctaHref: toToday,
      severity: "critical",
    };
  }

  // 2. POS not connected — sales data is blind
  if (branch.staff_activity_status === "NO_SYNC") {
    return {
      issue: "POS is not connected",
      detail: "Sales data isn't syncing. Revenue and waste figures are incomplete.",
      ctaLabel: "Fix integration",
      ctaHref: toSettings,
      severity: "critical",
    };
  }

  // 3. Critical waste — active financial loss
  if (wastePct >= 7) {
    return {
      issue: `${wastePct.toFixed(1)}% of items are at risk of waste`,
      detail: "Reduce prep quantities or redirect surplus before service closes.",
      ctaLabel: "See which items are at risk",
      ctaHref: toWaste,
      severity: "critical",
    };
  }

  // 4. Staff gone idle during live service — likely a floor problem
  if (branch.staff_activity_status === "IDLE" && branch.day_status === "LIVE") {
    return {
      issue: "No staff POS activity in 2+ hours",
      detail: "Live service is running but the POS hasn't synced. Sales may be missing.",
      ctaLabel: "Review live status",
      ctaHref: toToday,
      severity: "critical",
    };
  }

  // 5. Moderate waste — approaching threshold, not yet critical
  if (wastePct >= 4) {
    return {
      issue: `${wastePct.toFixed(1)}% waste — approaching threshold`,
      detail: "Watch closely, especially in the final hour of service.",
      ctaLabel: "Monitor waste trend",
      ctaHref: toWaste,
      severity: "warning",
    };
  }

  // 6. Day closed or not yet started
  if (!branch.day_status || branch.day_status === "CLOSED") {
    return {
      issue: null,
      detail: null,
      ctaLabel: "View yesterday's summary",
      ctaHref: toToday,
      severity: "ok",
    };
  }

  // All good
  return {
    issue: null,
    detail: null,
    ctaLabel: "View today's plan",
    ctaHref: toToday,
    severity: "ok",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert action labels
// Generic "View" tells the user nothing. These tell them exactly what to do.
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_CTA: Record<string, { label: string; href: (branchId: string) => string }> = {
  WASTE_RISK: {
    label: "See at-risk items",
    href: (id) => `/workspace/sales-waste?branch=${id}`,
  },
  POS_SYNC_LAG: {
    label: "Fix POS sync",
    href: (id) => `/workspace/settings?tab=integrations&branch=${id}`,
  },
  POS_NOT_CONNECTED: {
    label: "Connect POS",
    href: (id) => `/workspace/settings?tab=integrations&branch=${id}`,
  },
  SALES_VELOCITY_DROP: {
    label: "Review live sales",
    href: (id) => `/workspace/today?branch_id=${id}`,
  },
  SALES_VELOCITY_SURGE: {
    label: "Check stock levels",
    href: (id) => `/workspace/inventory?branch=${id}`,
  },
  BRANCH_UNDERPERFORMING: {
    label: "See branch breakdown",
    href: (id) => `/workspace/branches?branch=${id}`,
  },
  UNMAPPED_SALES: {
    label: "Map missing items",
    href: (id) => `/workspace/sales-waste?branch=${id}`,
  },
};

function alertCTA(alert: AlertEntry): { label: string; href: string } {
  const def = ALERT_CTA[alert.type ?? ""];
  if (def) return { label: def.label, href: def.href(alert.branch_id) };
  return { label: "Review alert", href: `/workspace/today?branch_id=${alert.branch_id}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Misc helpers
// ─────────────────────────────────────────────────────────────────────────────

function greeting(firstName: string | null | undefined): string {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

function branchStatusLine(branch: BranchEntry): string {
  const status =
    branch.day_status === "LIVE"
      ? "Live service"
      : branch.day_status === "CLOSED"
        ? "Closed"
        : branch.day_status === "MORNING"
          ? "Morning planning"
          : "Not started";
  const plan = branch.plan_locked ? "Plan locked" : "Plan pending";
  const staff =
    branch.staff_activity_status === "ACTIVE"
      ? "Staff active"
      : branch.staff_activity_status === "IDLE"
        ? "Staff idle"
        : "No staff sync";
  return `${status} · ${plan} · ${staff}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI modal helpers
// ─────────────────────────────────────────────────────────────────────────────

type KpiModalKey = "revenue" | "waste" | "forecast" | "alerts";

function fmtMoney(v: number) {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function ExpandIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function ModalStat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "red" | "amber" | "green";
}) {
  const valueColor =
    highlight === "red"
      ? "text-status-critical"
      : highlight === "amber"
        ? "text-status-warning"
        : highlight === "green"
          ? "text-status-success"
          : "text-text-primary";
  return (
    <div className="bg-surface-3 rounded-lg p-4 border border-surface-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-1.5">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

type BarItem = { label: string; value: number; colorClass: string; display?: string };

function HorizontalBars({
  items,
  formatVal,
  emptyText = "No data",
}: {
  items: BarItem[];
  formatVal: (item: BarItem) => string;
  emptyText?: string;
}) {
  const max = Math.max(...items.map((d) => d.value), 1);
  if (items.length === 0) {
    return <p className="text-sm text-text-muted text-center py-6">{emptyText}</p>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-28 truncate shrink-0 text-right">
            {item.label}
          </span>
          <div className="flex-1 h-4 bg-surface-4 rounded-sm overflow-hidden">
            <div
              className={`h-full rounded-sm ${item.colorClass}`}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-text-primary w-16 text-right shrink-0 tabular-nums">
            {formatVal(item)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardView({ canSeeFinancials }: { canSeeFinancials: boolean }) {
  const { data: user } = useCurrentUserProfile();
  const [kpiModal, setKpiModal] = useState<KpiModalKey | null>(null);

  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // undefined = today. Same key as CommandSection → shared React Query cache.
  const ctToday = useExecutiveControlTower(undefined, Boolean(user?.organization_id));
  const ctYesterday = useExecutiveControlTower(
    { target_date: yesterdayDate },
    Boolean(user?.organization_id),
  );
  const marginReport = useOwnerMarginProtectionReport(
    undefined,
    canSeeFinancials && Boolean(user?.organization_id),
  );

  const tower = ctToday.data;
  const alerts = tower?.alerts ?? [];
  const branchGrid = tower?.branch_grid ?? [];

  // Sort: problems first
  const sortedBranches = useMemo(() => {
    const order: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2 };
    return [...branchGrid].sort(
      (a, b) =>
        (order[a.compliance_badge ?? ""] ?? 1) - (order[b.compliance_badge ?? ""] ?? 1),
    );
  }, [branchGrid]);

  const highAlerts = alerts.filter((a) => a.severity === "HIGH");

  // Pulse metrics
  const revenueToday = Number(tower?.summary?.total_revenue ?? 0);
  const revenueYesterday = Number(ctYesterday.data?.summary?.total_revenue ?? 0);
  const revenueDeltaPct =
    revenueYesterday > 0
      ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100
      : null;

  const wasteCost = Number(marginReport.data?.summary?.total_waste_cost ?? "0");
  const wasteRiskPct = Number(tower?.summary?.waste_risk_pct ?? 0);
  const wasteAsRevenuePct = revenueToday > 0 ? (wasteCost / revenueToday) * 100 : 0;
  const wasteIsBad = canSeeFinancials ? wasteCost > 500 : wasteRiskPct > 8;

  const forecastAccuracyPct = Number(tower?.summary?.forecast_accuracy_rolling_7d ?? 0) * 100;
  const forecastIsBad = forecastAccuracyPct > 0 && forecastAccuracyPct < 70;
  const forecastIsWarning = forecastAccuracyPct >= 70 && forecastAccuracyPct < 85;

  const todayDisplay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* ── Morning brief ──────────────────────────────────────────────── */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
          {todayDisplay}
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
          {greeting(user?.first_name)}
        </h1>
        <p className="mt-4 text-base text-text-secondary">
          {branchGrid.length > 0
            ? `${branchGrid.length} ${branchGrid.length === 1 ? "branch" : "branches"} reporting`
            : ctToday.isLoading
              ? "Loading…"
              : "No branches connected yet"}
        </p>
      </div>

      {/* ── Pulse KPIs ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
        <article
          className="bg-surface-2 rounded-xl p-6 border border-surface-4 cursor-pointer transition-colors hover:border-brand-gold/30 hover:bg-surface-3/40 group"
          onClick={() => setKpiModal("revenue")}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Revenue today
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setKpiModal("revenue"); }}
              aria-label="View revenue details"
              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary"
            >
              <ExpandIcon />
            </button>
          </div>
          <p className="font-display text-3xl font-semibold text-text-primary tracking-tight">
            ${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4 flex items-center gap-2">
            {revenueDeltaPct !== null ? (
              <>
                {revenueDeltaPct >= 0 ? (
                  <StatsUpSquare className="h-4 w-4 text-status-success shrink-0" />
                ) : (
                  <StatsDownSquare className="h-4 w-4 text-status-critical shrink-0" />
                )}
                <span
                  className={`text-sm font-medium ${revenueDeltaPct >= 0 ? "text-status-success" : "text-status-critical"}`}
                >
                  {revenueDeltaPct >= 0 ? "+" : ""}
                  {revenueDeltaPct.toFixed(1)}% vs yesterday
                </span>
              </>
            ) : (
              <span className="text-xs text-text-muted">No prior-day baseline</span>
            )}
          </div>
        </article>

        <article
          className="bg-surface-2 rounded-xl p-6 border border-surface-4 cursor-pointer transition-colors hover:border-status-critical/20 hover:bg-surface-3/40 group"
          onClick={() => setKpiModal("waste")}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {canSeeFinancials ? "Waste cost" : "Waste risk"}
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setKpiModal("waste"); }}
              aria-label="View waste details"
              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary"
            >
              <ExpandIcon />
            </button>
          </div>
          <p
            className={`font-display text-3xl font-semibold tracking-tight ${
              wasteIsBad ? "text-status-critical" : "text-text-primary"
            }`}
          >
            {canSeeFinancials
              ? `$${wasteCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : `${wasteRiskPct.toFixed(1)}%`}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {canSeeFinancials
                ? `${wasteAsRevenuePct.toFixed(1)}% of revenue`
                : "items at risk today"}
            </p>
          </div>
        </article>

        <article
          className="bg-surface-2 rounded-xl p-6 border border-surface-4 cursor-pointer transition-colors hover:border-surface-5 hover:bg-surface-3/40 group"
          onClick={() => setKpiModal("forecast")}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Forecast accuracy
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setKpiModal("forecast"); }}
              aria-label="View forecast details"
              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary"
            >
              <ExpandIcon />
            </button>
          </div>
          <p
            className={`font-display text-3xl font-semibold tracking-tight ${
              forecastIsBad
                ? "text-status-critical"
                : forecastIsWarning
                  ? "text-status-warning"
                  : "text-text-primary"
            }`}
          >
            {forecastAccuracyPct.toFixed(1)}%
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">7-day rolling average</p>
          </div>
        </article>

        <article
          className="bg-surface-2 rounded-xl p-6 border border-surface-4 cursor-pointer transition-colors hover:border-surface-5 hover:bg-surface-3/40 group"
          onClick={() => setKpiModal("alerts")}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Active alerts
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setKpiModal("alerts"); }}
              aria-label="View all alerts"
              className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary"
            >
              <ExpandIcon />
            </button>
          </div>
          <p
            className={`font-display text-3xl font-semibold tracking-tight ${
              highAlerts.length > 0 ? "text-status-critical" : "text-text-primary"
            }`}
          >
            {alerts.length}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {highAlerts.length > 0
                ? `${highAlerts.length} need immediate action`
                : alerts.length > 0
                  ? "No urgent issues"
                  : "All clear"}
            </p>
          </div>
        </article>
      </section>

      {/* ── HIGH alerts — specific issue + specific action ─────────────── */}
      {highAlerts.length > 0 && (
        <section className="mb-12">
          {highAlerts.slice(0, 3).map((alert) => {
            const cta = alertCTA(alert);
            return (
              <div
                key={alert.id}
                className="mb-2.5 flex items-start justify-between gap-6 rounded-xl border border-surface-4 border-l-[3px] border-l-status-critical bg-surface-2 px-6 py-5"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-status-critical shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {alert.title || alert.type}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{alert.branch_name}</p>
                    {alert.context && (
                      <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                        {alert.context}
                      </p>
                    )}
                    {alert.suggested_action && (
                      <p className="mt-1 text-xs text-text-muted">→ {alert.suggested_action}</p>
                    )}
                  </div>
                </div>
                {/* Specific action label — not generic "View" */}
                <Link
                  href={cta.href}
                  className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-4 text-xs font-medium text-text-secondary whitespace-nowrap hover:border-status-critical/40 hover:text-status-critical transition-colors"
                >
                  {cta.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Branch health grid ─────────────────────────────────────────── */}
      {sortedBranches.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Operations
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-text-primary">
                {sortedBranches.length}{" "}
                {sortedBranches.length === 1 ? "location" : "locations"}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                System status — POS connections, plan approvals, live service activity.
              </p>
            </div>
            {sortedBranches.some((b) => b.compliance_badge === "RED") && (
              <span className="text-xs font-medium text-status-critical shrink-0 mt-1">
                {sortedBranches.filter((b) => b.compliance_badge === "RED").length} need attention
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedBranches.map((branch) => {
              const isRed = branch.compliance_badge === "RED";
              const diagnosis = diagnoseBranch(branch);
              const hasProblem = diagnosis.issue !== null;

              return (
                <article
                  key={branch.branch_id}
                  className={`bg-surface-2 rounded-xl border border-surface-4 p-6 flex flex-col gap-5 ${
                    isRed ? "border-l-[3px] border-l-status-critical" : ""
                  }`}
                >
                  {/* Header: name + revenue — always visible */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isRed
                            ? "bg-status-critical"
                            : branch.compliance_badge === "AMBER"
                              ? "bg-status-warning"
                              : "bg-status-success"
                        }`}
                      />
                      <h3 className="font-medium text-text-primary truncate">
                        {branch.branch_name}
                      </h3>
                    </div>
                    <p className="text-sm font-semibold text-text-primary shrink-0">
                      $
                      {Number(branch.revenue ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>

                  {/* Body: problem branch shows diagnosis. Healthy branch shows status. */}
                  {hasProblem ? (
                    <div className="space-y-1.5">
                      <p
                        className={`text-sm font-semibold ${
                          diagnosis.severity === "critical"
                            ? "text-status-critical"
                            : "text-status-warning"
                        }`}
                      >
                        {diagnosis.issue}
                      </p>
                      {diagnosis.detail && (
                        <p className="text-xs text-text-muted leading-relaxed">
                          {diagnosis.detail}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">{branchStatusLine(branch)}</p>
                  )}

                  {/* CTA — specific label that says what the user will do */}
                  <Link
                    href={diagnosis.ctaHref}
                    className={`group inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors duration-150 ${
                      isRed && hasProblem
                        ? "border-status-critical/30 bg-status-critical/8 text-status-critical hover:bg-status-critical/15"
                        : "border-surface-4 bg-surface-3 text-text-secondary hover:border-brand-gold/40 hover:text-brand-gold"
                    }`}
                  >
                    {diagnosis.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {branchGrid.length === 0 && !ctToday.isLoading && (
        <div className="mb-12 rounded-xl border border-surface-4 bg-surface-2 p-12 text-center">
          <p className="text-text-muted">No branches connected yet</p>
          <Link href="/setup/branch/create">
            <button className="mt-6 h-10 inline-flex items-center gap-2 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-background px-5 text-sm font-semibold transition-colors">
              <Shop className="h-4 w-4" />
              Add your first branch
            </button>
          </Link>
        </div>
      )}

      {/* ── KPI detail modals ─────────────────────────────────────────────── */}

      {/* Revenue modal */}
      <ModalShell
        open={kpiModal === "revenue"}
        onClose={() => setKpiModal(null)}
        title="Revenue"
        description="Today's revenue across all connected branches"
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <ModalStat
              label="Today"
              value={`$${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              sub={
                revenueDeltaPct !== null
                  ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs yesterday`
                  : "No prior-day baseline"
              }
              highlight={
                revenueDeltaPct !== null && revenueDeltaPct < -5
                  ? "red"
                  : revenueDeltaPct !== null && revenueDeltaPct >= 0
                    ? "green"
                    : undefined
              }
            />
            <ModalStat
              label="Units sold"
              value={(tower?.summary?.total_sold ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
              sub="across all branches"
            />
            <ModalStat
              label="Cost saved today"
              value={fmtMoney(Number(tower?.summary?.cost_saved_today ?? 0))}
              sub="vs unoptimized baseline"
              highlight={Number(tower?.summary?.cost_saved_today ?? 0) > 0 ? "green" : undefined}
            />
          </div>

          {branchGrid.some((b) => Number(b.revenue ?? 0) > 0) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                Revenue by branch
              </p>
              <HorizontalBars
                items={[...branchGrid]
                  .filter((b) => Number(b.revenue ?? 0) > 0)
                  .sort((a, b) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0))
                  .map((b) => ({
                    label: b.branch_name,
                    value: Number(b.revenue ?? 0),
                    colorClass: "bg-brand-gold/70",
                  }))}
                formatVal={(item) => fmtMoney(item.value)}
                emptyText="No revenue data available"
              />
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
              Prepared vs sold
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ModalStat
                label="Total prepared"
                value={(tower?.summary?.total_prepared ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                sub="units across branches"
              />
              <ModalStat
                label="Predicted surplus"
                value={(tower?.summary?.predicted_surplus ?? 0).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
                sub="units at end of service"
                highlight={Number(tower?.summary?.predicted_surplus ?? 0) > 0 ? "amber" : undefined}
              />
            </div>
          </div>

          <Link
            href="/workspace/financial"
            className="inline-flex items-center gap-1.5 text-sm text-brand-gold hover:underline"
          >
            View full financial report
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ModalShell>

      {/* Waste modal */}
      <ModalShell
        open={kpiModal === "waste"}
        onClose={() => setKpiModal(null)}
        title={canSeeFinancials ? "Waste Cost" : "Waste Risk"}
        description="Item-level waste exposure across all branches today"
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <ModalStat
              label={canSeeFinancials ? "Total waste cost" : "Waste risk %"}
              value={
                canSeeFinancials
                  ? fmtMoney(wasteCost)
                  : `${wasteRiskPct.toFixed(1)}%`
              }
              sub={canSeeFinancials ? `${wasteAsRevenuePct.toFixed(1)}% of revenue` : "items at risk"}
              highlight={wasteIsBad ? "red" : undefined}
            />
            <ModalStat
              label="Branches above 7%"
              value={branchGrid
                .filter((b) => Number(b.waste_pct ?? 0) >= 7)
                .length.toString()}
              sub="critical threshold"
              highlight={
                branchGrid.some((b) => Number(b.waste_pct ?? 0) >= 7) ? "red" : undefined
              }
            />
            <ModalStat
              label="Branches 4–7%"
              value={branchGrid
                .filter((b) => {
                  const p = Number(b.waste_pct ?? 0);
                  return p >= 4 && p < 7;
                })
                .length.toString()}
              sub="approaching threshold"
              highlight={
                branchGrid.some((b) => {
                  const p = Number(b.waste_pct ?? 0);
                  return p >= 4 && p < 7;
                })
                  ? "amber"
                  : undefined
              }
            />
          </div>

          {marginReport.data?.summary?.margin_reliability?.is_reliable === false && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/8 px-4 py-3">
              <p className="text-sm font-medium text-status-warning">
                Margin data reliability warning
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {marginReport.data.summary.margin_reliability.warning ??
                  `${marginReport.data.summary.margin_reliability.unreliable_items_count ?? "Some"} items have incomplete data — figures may be understated.`}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
              Waste % by branch — sorted worst first
            </p>
            <HorizontalBars
              items={[...branchGrid]
                .filter(
                  (b) => b.waste_pct !== null && b.waste_pct !== undefined,
                )
                .sort((a, b) => Number(b.waste_pct ?? 0) - Number(a.waste_pct ?? 0))
                .map((b) => {
                  const p = Number(b.waste_pct ?? 0);
                  const mb = marginReport.data?.branches?.find(
                    (m) => m.branch_id === b.branch_id,
                  );
                  return {
                    label: b.branch_name,
                    value: p,
                    colorClass:
                      p >= 7
                        ? "bg-status-critical"
                        : p >= 4
                          ? "bg-status-warning"
                          : "bg-status-success",
                    display: mb
                      ? fmtMoney(Number(mb.total_waste_cost ?? "0"))
                      : undefined,
                  };
                })}
              formatVal={(item) =>
                item.display ? `${item.value.toFixed(1)}% · ${item.display}` : `${item.value.toFixed(1)}%`
              }
              emptyText="No waste data available"
            />
          </div>

          {canSeeFinancials && marginReport.data?.branches && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                Waste cost by branch
              </p>
              <HorizontalBars
                items={[...marginReport.data.branches]
                  .filter((b) => Number(b.total_waste_cost ?? "0") > 0)
                  .sort(
                    (a, b) =>
                      Number(b.total_waste_cost ?? "0") -
                      Number(a.total_waste_cost ?? "0"),
                  )
                  .map((b) => ({
                    label: b.branch_name,
                    value: Number(b.total_waste_cost ?? "0"),
                    colorClass:
                      Number(b.total_waste_cost ?? "0") > 1000
                        ? "bg-status-critical/80"
                        : Number(b.total_waste_cost ?? "0") > 500
                          ? "bg-status-warning/80"
                          : "bg-surface-5",
                  }))}
                formatVal={(item) => fmtMoney(item.value)}
                emptyText="No cost data available"
              />
            </div>
          )}

          <Link
            href="/workspace/sales-waste"
            className="inline-flex items-center gap-1.5 text-sm text-brand-gold hover:underline"
          >
            View waste details
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ModalShell>

      {/* Forecast accuracy modal */}
      <ModalShell
        open={kpiModal === "forecast"}
        onClose={() => setKpiModal(null)}
        title="Forecast Accuracy"
        description="How well AI-predicted demand matched actual sales"
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <ModalStat
              label="7-day rolling"
              value={`${forecastAccuracyPct.toFixed(1)}%`}
              sub="across all branches"
              highlight={forecastIsBad ? "red" : forecastIsWarning ? "amber" : "green"}
            />
            <ModalStat
              label="Branches below 70%"
              value={branchGrid
                .filter(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined &&
                    Number(b.forecast_confidence) < 0.7,
                )
                .length.toString()}
              sub="need attention"
              highlight={
                branchGrid.some(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined &&
                    Number(b.forecast_confidence) < 0.7,
                )
                  ? "amber"
                  : undefined
              }
            />
            <ModalStat
              label="Active branches"
              value={branchGrid
                .filter(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined,
                )
                .length.toString()}
              sub="with forecast data"
            />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
              Forecast confidence by branch — worst first
            </p>
            <HorizontalBars
              items={[...branchGrid]
                .filter(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined,
                )
                .sort(
                  (a, b) =>
                    Number(a.forecast_confidence ?? 1) -
                    Number(b.forecast_confidence ?? 1),
                )
                .map((b) => {
                  const conf = Number(b.forecast_confidence ?? 0) * 100;
                  const mb = marginReport.data?.branches?.find(
                    (m) => m.branch_id === b.branch_id,
                  );
                  const accuracy = mb?.forecast_accuracy_summary;
                  return {
                    label: b.branch_name,
                    value: conf,
                    colorClass:
                      conf < 50
                        ? "bg-status-critical"
                        : conf < 65
                          ? "bg-status-warning"
                          : conf < 85
                            ? "bg-status-success/70"
                            : "bg-status-success",
                    display: accuracy != null ? `${(accuracy * 100).toFixed(0)}% actual` : undefined,
                  };
                })}
              formatVal={(item) =>
                item.display
                  ? `${item.value.toFixed(0)}% · ${item.display}`
                  : `${item.value.toFixed(0)}%`
              }
              emptyText="No forecast data available"
            />
          </div>

          <div className="rounded-lg border border-surface-4 bg-surface-3 px-4 py-3.5 space-y-1">
            <p className="text-xs font-semibold text-text-primary">
              What drives low confidence?
            </p>
            <ul className="text-xs text-text-muted space-y-0.5 list-disc list-inside">
              <li>Unmapped menu items not feeding the demand model</li>
              <li>Irregular sales patterns in the last 7 days</li>
              <li>POS sync gaps (missing sales data)</li>
              <li>New items with fewer than 14 days of history</li>
            </ul>
          </div>

          <Link
            href="/workspace/today"
            className="inline-flex items-center gap-1.5 text-sm text-brand-gold hover:underline"
          >
            Review today's prep plan
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ModalShell>

      {/* Alerts modal */}
      <ModalShell
        open={kpiModal === "alerts"}
        onClose={() => setKpiModal(null)}
        title="Active Alerts"
        description={
          alerts.length > 0
            ? `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} across your network${highAlerts.length > 0 ? ` · ${highAlerts.length} urgent` : ""}`
            : "No active alerts right now"
        }
        maxWidthClassName="max-w-xl"
      >
        {alerts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-text-primary">All clear</p>
            <p className="text-xs text-text-muted mt-1">No alerts detected across your branches.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* High severity first */}
            {[...alerts]
              .sort((a, b) => {
                const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                return (order[a.severity ?? ""] ?? 1) - (order[b.severity ?? ""] ?? 1);
              })
              .map((alert) => {
                const cta = alertCTA(alert);
                const isHigh = alert.severity === "HIGH";
                return (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-4 ${
                      isHigh
                        ? "border-status-critical/30 border-l-[3px] border-l-status-critical bg-status-critical/5"
                        : "border-surface-4 border-l-[3px] border-l-status-warning"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                            isHigh ? "bg-status-critical" : "bg-status-warning"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-text-primary leading-snug">
                              {alert.title || alert.type}
                            </p>
                            {alert.type && (
                              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted bg-surface-4 rounded px-1.5 py-0.5">
                                {alert.type.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">{alert.branch_name}</p>
                          {alert.context && (
                            <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                              {alert.context}
                            </p>
                          )}
                          {alert.suggested_action && (
                            <p className="mt-1 text-xs text-text-muted">
                              → {alert.suggested_action}
                            </p>
                          )}
                        </div>
                      </div>
                      <Link
                        href={cta.href}
                        className={`shrink-0 inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                          isHigh
                            ? "border-status-critical/30 text-status-critical hover:bg-status-critical/10"
                            : "border-surface-4 text-text-secondary hover:border-brand-gold/40 hover:text-brand-gold"
                        }`}
                      >
                        {cta.label}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </ModalShell>
    </>
  );
}
