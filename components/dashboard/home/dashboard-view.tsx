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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function greeting(firstName: string | null | undefined): string {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

function alertHref(alert: AlertEntry): string {
  const branchParam = `?branch=${alert.branch_id}`;
  switch (alert.type) {
    case "UNMAPPED_SALES":
      return "/workspace/sales-waste";
    case "POS_SYNC_LAG":
    case "POS_NOT_CONNECTED":
      return "/workspace/settings?tab=integrations";
    case "SALES_VELOCITY_DROP":
    case "SALES_VELOCITY_SURGE":
      return `/workspace/today${branchParam}`;
    case "BRANCH_UNDERPERFORMING":
      return `/workspace/branches${branchParam}`;
    case "WASTE_RISK":
      return `/workspace/sales-waste${branchParam}`;
    default:
      return "/workspace/today";
  }
}

function branchCTA(branch: BranchEntry): { label: string; href: string } {
  const param = `?branch=${branch.branch_id}`;
  if (branch.compliance_badge === "RED")
    return { label: "Intervene", href: `/workspace/branches${param}` };
  if (Number(branch.waste_pct ?? 0) >= 5)
    return { label: "Review Waste", href: `/workspace/sales-waste${param}` };
  return { label: "View Today", href: `/workspace/today${param}` };
}

function dayStatusLabel(status: string | null | undefined): string {
  if (status === "LIVE") return "Live service";
  if (status === "CLOSED") return "Day closed";
  if (status === "MORNING") return "Morning planning";
  return "Not started";
}

function dayStatusColor(status: string | null | undefined): string {
  if (status === "LIVE") return "text-status-success";
  if (status === "CLOSED") return "text-text-disabled";
  if (status === "MORNING") return "text-status-warning";
  return "text-text-muted";
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

  // undefined = today; CommandSection uses the same key → shared cache, no double-fetch
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

  const sortedBranches = useMemo(() => {
    const order: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2 };
    return [...branchGrid].sort(
      (a, b) => (order[a.compliance_badge ?? ""] ?? 1) - (order[b.compliance_badge ?? ""] ?? 1),
    );
  }, [branchGrid]);

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

  const forecastAccuracyPct = Number(tower?.summary?.forecast_accuracy_rolling_7d ?? 0) * 100;
  const highAlerts = alerts.filter((a) => a.severity === "HIGH").length;

  const todayDisplay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Morning brief */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
          {todayDisplay}
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
          {greeting(user?.first_name)}
        </h1>
        <p className="mt-4 text-base text-text-secondary">
          {branchGrid.length > 0
            ? `${branchGrid.length} ${branchGrid.length === 1 ? "branch" : "branches"} reporting today`
            : ctToday.isLoading
              ? "Loading branch data..."
              : "No branches connected yet"}
        </p>
      </div>

      {/* Pulse KPIs */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
        {/* Revenue */}
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Revenue Today
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
              <span className="text-xs text-text-muted">No prior-day baseline yet</span>
            )}
          </div>
        </article>

        {/* Waste */}
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            {canSeeFinancials ? "Waste Cost" : "Waste Risk"}
          </p>
          <p
            className={`font-display text-3xl font-semibold tracking-tight ${
              (canSeeFinancials ? wasteCost : wasteRiskPct) > (canSeeFinancials ? 500 : 8)
                ? "text-status-critical"
                : (canSeeFinancials ? wasteCost : wasteRiskPct) > (canSeeFinancials ? 200 : 4)
                  ? "text-status-warning"
                  : "text-text-primary"
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

        {/* Forecast accuracy */}
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Forecast Accuracy
          </p>
          <p
            className={`font-display text-3xl font-semibold tracking-tight ${
              forecastAccuracyPct >= 85
                ? "text-status-success"
                : forecastAccuracyPct >= 70
                  ? "text-status-warning"
                  : "text-status-critical"
            }`}
          >
            {forecastAccuracyPct.toFixed(1)}%
          </p>
          <div className="mt-2 h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                forecastAccuracyPct >= 85
                  ? "bg-status-success"
                  : forecastAccuracyPct >= 70
                    ? "bg-status-warning"
                    : "bg-status-critical"
              }`}
              style={{ width: `${Math.min(100, forecastAccuracyPct)}%` }}
            />
          </div>
          <div className="mt-3 pt-3 border-t border-surface-4">
            <p className="text-xs text-text-muted">7-day rolling average</p>
          </div>
        </article>

        {/* Alerts */}
        <article
          className={`bg-surface-2 rounded-xl p-6 border ${alerts.length > 0 ? "border-status-warning/40" : "border-surface-4"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Active Alerts
          </p>
          <p
            className={`font-display text-3xl font-semibold tracking-tight ${
              highAlerts > 0
                ? "text-status-critical"
                : alerts.length > 0
                  ? "text-status-warning"
                  : "text-text-primary"
            }`}
          >
            {alerts.length}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {highAlerts > 0
                ? `${highAlerts} high severity — act now`
                : alerts.length > 0
                  ? "Review alerts below"
                  : "All clear"}
            </p>
          </div>
        </article>
      </section>

      {/* Branch health grid */}
      {sortedBranches.length > 0 && (
        <section className="mb-12">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Branch Health
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {sortedBranches.length}{" "}
              {sortedBranches.length === 1 ? "location" : "locations"} at a glance
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sortedBranches.map((branch) => {
              const badge = branch.compliance_badge;
              const wastePct = Number(branch.waste_pct ?? 0);
              const cta = branchCTA(branch);
              const isRed = badge === "RED";
              const isAmber = badge === "AMBER";

              const borderColor = isRed
                ? "border-status-critical/50"
                : isAmber
                  ? "border-status-warning/40"
                  : "border-surface-4";
              const badgeDot = isRed
                ? "bg-status-critical"
                : isAmber
                  ? "bg-status-warning"
                  : "bg-status-success";
              const badgeText = isRed
                ? "text-status-critical"
                : isAmber
                  ? "text-status-warning"
                  : "text-status-success";
              const wasteBadgeCls =
                wastePct > 7
                  ? "text-status-critical bg-status-critical/10"
                  : wastePct > 4
                    ? "text-status-warning bg-status-warning/10"
                    : "text-status-success bg-status-success/10";

              return (
                <article
                  key={branch.branch_id}
                  className={`bg-surface-2 rounded-xl border ${borderColor} p-6 flex flex-col gap-4`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${badgeDot}`} />
                      <h3 className="font-semibold text-text-primary truncate">
                        {branch.branch_name}
                      </h3>
                    </div>
                    <span className={`text-xs font-bold tracking-wide shrink-0 ml-2 ${badgeText}`}>
                      {badge}
                    </span>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-muted mb-1">Revenue</p>
                      <p className="font-semibold text-lg text-text-primary leading-tight">
                        $
                        {Number(branch.revenue ?? 0).toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted mb-1">Waste</p>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold ${wasteBadgeCls}`}
                      >
                        {wastePct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Status rows */}
                  <div className="border-t border-surface-4 pt-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">Day</span>
                      <span className={`text-xs font-medium ${dayStatusColor(branch.day_status)}`}>
                        {dayStatusLabel(branch.day_status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">Plan</span>
                      <span
                        className={`text-xs font-medium ${branch.plan_locked ? "text-status-success" : "text-status-warning"}`}
                      >
                        {branch.plan_locked ? "✓ Locked" : "⚠ Pending"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">Staff</span>
                      <span
                        className={`text-xs font-medium ${
                          branch.staff_activity_status === "ACTIVE"
                            ? "text-status-success"
                            : branch.staff_activity_status === "IDLE"
                              ? "text-status-warning"
                              : "text-text-muted"
                        }`}
                      >
                        {branch.staff_activity_status === "ACTIVE"
                          ? "Active"
                          : branch.staff_activity_status === "IDLE"
                            ? "Idle"
                            : "No sync"}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <Link
                    href={cta.href}
                    className={`group inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-all duration-200 ${
                      isRed
                        ? "bg-status-critical/10 border border-status-critical/30 text-status-critical hover:bg-status-critical/20"
                        : "bg-surface-3 border border-surface-4 text-text-secondary hover:border-brand-gold/40 hover:text-brand-gold"
                    }`}
                  >
                    {cta.label}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Alerts panel */}
      {alerts.length > 0 && (
        <section className="mb-12">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Live Alerts · {alerts.length}
            </p>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => {
              const isHigh = alert.severity === "HIGH";
              const isMed = alert.severity === "MEDIUM";
              const severityDot = isHigh
                ? "bg-status-critical"
                : isMed
                  ? "bg-status-warning"
                  : "bg-status-success";
              const severityText = isHigh
                ? "text-status-critical"
                : isMed
                  ? "text-status-warning"
                  : "text-text-muted";
              const borderAccent = isHigh
                ? "border-l-status-critical"
                : isMed
                  ? "border-l-status-warning"
                  : "border-l-surface-4";

              return (
                <div
                  key={alert.id}
                  className={`bg-surface-2 rounded-xl border border-surface-4 border-l-[3px] ${borderAccent} px-6 py-4 flex items-start justify-between gap-6`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${severityDot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-sm font-semibold text-text-primary">
                          {alert.title || alert.type}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide ${severityText}`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">{alert.branch_name}</p>
                      {alert.context && (
                        <p className="mt-2 text-sm text-text-secondary leading-relaxed">
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
                    href={alertHref(alert)}
                    className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-secondary hover:border-brand-gold/40 hover:text-brand-gold transition-all duration-150"
                  >
                    View
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Add branch CTA (shown when no branches yet) */}
      {branchGrid.length === 0 && !ctToday.isLoading && (
        <div className="mb-12 rounded-xl border border-surface-4 bg-surface-2 p-12 text-center">
          <p className="text-text-muted mb-2">No branches connected yet</p>
          <Link href="/setup/branch/create">
            <button className="mt-4 h-10 inline-flex items-center gap-2 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-background px-5 text-sm font-semibold transition-colors">
              <Shop className="h-4 w-4" />
              Add your first branch
            </button>
          </Link>
        </div>
      )}
    </>
  );
}
