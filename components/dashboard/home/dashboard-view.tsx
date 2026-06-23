"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, StatsUpSquare, StatsDownSquare, Shop } from "iconoir-react";
import { useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";

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
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardView({ canSeeFinancials }: { canSeeFinancials: boolean }) {
  const { data: user } = useCurrentUserProfile();

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
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Revenue today
          </p>
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

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            {canSeeFinancials ? "Waste cost" : "Waste risk"}
          </p>
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

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Forecast accuracy
          </p>
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

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Active alerts
          </p>
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
          <div className="mb-6 flex items-baseline justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Branch health
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-text-primary">
                {sortedBranches.length}{" "}
                {sortedBranches.length === 1 ? "location" : "locations"}
              </h2>
            </div>
            {sortedBranches.some((b) => b.compliance_badge === "RED") && (
              <span className="text-xs font-medium text-status-critical">
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
    </>
  );
}
