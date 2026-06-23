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
  const param = `?branch=${alert.branch_id}`;
  switch (alert.type) {
    case "UNMAPPED_SALES":
      return "/workspace/sales-waste";
    case "POS_SYNC_LAG":
    case "POS_NOT_CONNECTED":
      return "/workspace/settings?tab=integrations";
    case "SALES_VELOCITY_DROP":
    case "SALES_VELOCITY_SURGE":
      return `/workspace/today${param}`;
    case "BRANCH_UNDERPERFORMING":
      return `/workspace/branches${param}`;
    case "WASTE_RISK":
      return `/workspace/sales-waste${param}`;
    default:
      return "/workspace/today";
  }
}

function branchCTA(branch: BranchEntry): { label: string; href: string } {
  const param = `?branch=${branch.branch_id}`;
  if (branch.compliance_badge === "RED")
    return { label: "Intervene", href: `/workspace/branches${param}` };
  if (Number(branch.waste_pct ?? 0) >= 5)
    return { label: "Review waste", href: `/workspace/sales-waste${param}` };
  return { label: "View today", href: `/workspace/today${param}` };
}

function branchStatusLine(branch: BranchEntry): string {
  const parts: string[] = [];
  if (branch.day_status === "LIVE") parts.push("Live service");
  else if (branch.day_status === "MORNING") parts.push("Morning planning");
  else if (branch.day_status === "CLOSED") parts.push("Closed");
  else parts.push("Not started");

  parts.push(branch.plan_locked ? "Plan locked" : "Plan pending");

  if (branch.staff_activity_status === "ACTIVE") parts.push("Staff active");
  else if (branch.staff_activity_status === "IDLE") parts.push("Staff idle");
  else parts.push("No staff sync");

  return parts.join(" · ");
}

// A branch is "at risk" if the status line contains signals that need attention
function branchNeedsAttention(branch: BranchEntry): boolean {
  return (
    branch.compliance_badge === "RED" ||
    !branch.plan_locked ||
    branch.staff_activity_status === "NO_SYNC"
  );
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

  // undefined = today; same key as CommandSection → shared React Query cache
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

  // Sort: RED first (needs attention), then alphabetical
  const sortedBranches = useMemo(() => {
    const badgeOrder: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2 };
    return [...branchGrid].sort(
      (a, b) =>
        (badgeOrder[a.compliance_badge ?? ""] ?? 1) -
        (badgeOrder[b.compliance_badge ?? ""] ?? 1),
    );
  }, [branchGrid]);

  // Only the HIGH alerts warrant the alert panel — lower ones live in CommandSection
  const highAlerts = alerts.filter((a) => a.severity === "HIGH");
  const totalAlertCount = alerts.length;

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
  const forecastIsBad = forecastAccuracyPct < 70;
  const forecastIsWarning = forecastAccuracyPct >= 70 && forecastAccuracyPct < 85;

  const todayDisplay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* ── Morning brief ─────────────────────────────────────────────── */}
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

      {/* ── Pulse KPIs ────────────────────────────────────────────────── */}
      {/* All cards look the same. Color only appears when there's a problem. */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
        {/* Revenue */}
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

        {/* Waste — colored only when bad */}
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

        {/* Forecast — colored only when bad */}
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

        {/* Alerts — only red when HIGH alerts exist */}
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
            Active alerts
          </p>
          <p
            className={`font-display text-3xl font-semibold tracking-tight ${
              highAlerts.length > 0 ? "text-status-critical" : "text-text-primary"
            }`}
          >
            {totalAlertCount}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {highAlerts.length > 0
                ? `${highAlerts.length} need immediate action`
                : totalAlertCount > 0
                  ? "No urgent issues"
                  : "All clear"}
            </p>
          </div>
        </article>
      </section>

      {/* ── High-severity alert banner ────────────────────────────────── */}
      {/* Only HIGH alerts get a banner. Medium/low live in the queue below. */}
      {highAlerts.length > 0 && (
        <section className="mb-12">
          <div className="space-y-2.5">
            {highAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-6 rounded-xl border border-surface-4 border-l-[3px] border-l-status-critical bg-surface-2 px-6 py-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-status-critical shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {alert.title || alert.type}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{alert.branch_name}</p>
                    {alert.context && (
                      <p className="mt-1.5 text-sm text-text-secondary">{alert.context}</p>
                    )}
                    {alert.suggested_action && (
                      <p className="mt-1 text-xs text-text-muted">→ {alert.suggested_action}</p>
                    )}
                  </div>
                </div>
                <Link
                  href={alertHref(alert)}
                  className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-secondary hover:border-status-critical/40 hover:text-status-critical transition-colors"
                >
                  View <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Branch health grid ────────────────────────────────────────── */}
      {/* Cards are neutral by default. RED branches are the exception.      */}
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
              const wastePct = Number(branch.waste_pct ?? 0);
              const cta = branchCTA(branch);
              const needsAttention = branchNeedsAttention(branch);

              // RED branches: left accent + muted red tint. Others: plain neutral.
              const cardClass = isRed
                ? "bg-surface-2 rounded-xl border border-surface-4 border-l-[3px] border-l-status-critical p-6 flex flex-col gap-5"
                : "bg-surface-2 rounded-xl border border-surface-4 p-6 flex flex-col gap-5";

              // Status line: flag bad states, mute good ones
              const statusLineClass = needsAttention
                ? "text-xs text-status-warning"
                : "text-xs text-text-muted";

              return (
                <article key={branch.branch_id} className={cardClass}>
                  {/* Header: name + revenue */}
                  <div className="flex items-start justify-between gap-3">
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
                    <p className="font-semibold text-text-primary shrink-0 text-sm">
                      $
                      {Number(branch.revenue ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>

                  {/* Waste metric — only colorized when high */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Waste</span>
                    <span
                      className={`text-sm font-semibold ${
                        wastePct > 7
                          ? "text-status-critical"
                          : wastePct > 4
                            ? "text-status-warning"
                            : "text-text-secondary"
                      }`}
                    >
                      {wastePct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Status line — single line, muted when OK, warning-colored when not */}
                  <p className={statusLineClass}>{branchStatusLine(branch)}</p>

                  {/* CTA */}
                  <Link
                    href={cta.href}
                    className={`group inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors duration-150 ${
                      isRed
                        ? "border-status-critical/30 bg-status-critical/8 text-status-critical hover:bg-status-critical/15"
                        : "border-surface-4 bg-surface-3 text-text-secondary hover:border-brand-gold/40 hover:text-brand-gold"
                    }`}
                  >
                    {cta.label}
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
