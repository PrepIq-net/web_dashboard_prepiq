"use client";

import Link from "next/link";
import { WarningTriangle, Shop, ArrowUpRight, Brain } from "iconoir-react";

interface AlertItem {
  id: string;
  title?: string | null;
  branch_name?: string | null;
}

interface BranchRankRow {
  branch_id: string;
  branch_name: string;
  waste_pct?: number | null;
  surplus_pct?: number | null;
  revenue?: number | null;
}

interface OwnerViewProps {
  revenueTrendLabel: string;
  revenueToday: number;
  grossMarginPct: number;
  wasteAsRevenuePct: number;
  ebitdaProxy: number;
  riskIndexScore: number;
  purchasingEfficiencyScore: number;
  branchRankingSummary: BranchRankRow[];
  aiInsight: string;
  topAlerts: AlertItem[];
  hasError: boolean;
}

export function OwnerView({
  revenueTrendLabel,
  revenueToday,
  grossMarginPct,
  wasteAsRevenuePct,
  ebitdaProxy,
  riskIndexScore,
  purchasingEfficiencyScore,
  branchRankingSummary,
  aiInsight,
  topAlerts,
  hasError,
}: OwnerViewProps) {
  const maxRevenue = Math.max(
    ...branchRankingSummary.map((b) => Number(b.revenue ?? 0)),
    1,
  );

  return (
    <>
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
              Executive View
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-text-primary tracking-tight">
              Business Health Snapshot
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-text-secondary">
              Strategic signal only: financial trajectory, risk exposure, and branch ranking.
            </p>
          </div>
          <div className="mt-1 shrink-0 inline-flex items-center gap-3">
            <label
              htmlFor="owner-period"
              className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted"
            >
              Period
            </label>
            <select
              id="owner-period"
              className="h-9 rounded-button border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary font-medium focus:border-brand-gold focus:outline-none transition-colors"
              defaultValue="30d"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Grid — unboxed, spacing-led (executive style) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-7 mb-10 pb-10 border-b border-surface-4">
        <article>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Revenue Trend
          </p>
          <p className="mt-3 font-display text-[32px] leading-9 font-semibold text-text-primary tracking-tight">
            {revenueTrendLabel}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Today: ${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </article>

        <article>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Gross Margin
          </p>
          <p className="mt-3 font-display text-[32px] leading-9 font-semibold text-text-primary tracking-tight">
            {grossMarginPct.toFixed(1)}%
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Waste as % of revenue: {wasteAsRevenuePct.toFixed(2)}%
          </p>
        </article>

        <article>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            EBITDA Proxy
          </p>
          <p className="mt-3 font-display text-[32px] leading-9 font-semibold text-text-primary tracking-tight">
            ${ebitdaProxy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Derived from revenue, waste, and surplus pressure
          </p>
        </article>

        <article>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Risk Index
          </p>
          <p className="mt-3 font-display text-[32px] leading-9 font-semibold text-text-primary tracking-tight">
            {riskIndexScore.toFixed(0)}/100
          </p>
          <p className="mt-2 text-sm text-text-secondary">Business health today</p>
        </article>
      </section>

      {/* Trend Graphs */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Trend Graphs
        </p>
      </div>
      <section className="mb-10 grid grid-cols-1 gap-8 pb-10 border-b border-surface-4 lg:grid-cols-3">
        <article>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Purchasing Efficiency
          </p>
          <p className="mt-3 font-display text-[32px] leading-9 font-semibold text-text-primary tracking-tight">
            {purchasingEfficiencyScore.toFixed(1)}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Penalized by supplier anomalies and leakage
          </p>
        </article>

        <article className="lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Branch Ranking Summary
          </p>
          <div className="mt-5 space-y-3">
            {branchRankingSummary.length ? (
              branchRankingSummary.map((branch, index) => (
                <div
                  key={branch.branch_id}
                  className="flex items-center justify-between border-b border-surface-4 pb-3 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {index + 1}. {branch.branch_name}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Waste {Number(branch.waste_pct ?? 0).toFixed(1)}% · Surplus{" "}
                      {Number(branch.surplus_pct ?? 0).toFixed(1)}%
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-text-secondary">
                    ${Number(branch.revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-muted">No branch ranking data yet.</p>
            )}
          </div>

          {/* Mini bar chart */}
          {branchRankingSummary.length > 0 && (
            <div className="mt-6 flex items-end gap-2 h-16">
              {branchRankingSummary.map((branch) => {
                const heightPct = Math.max(
                  12,
                  (Number(branch.revenue ?? 0) / maxRevenue) * 100,
                );
                return (
                  <div key={`${branch.branch_id}-bar`} className="flex-1 min-w-0 flex flex-col justify-end h-full">
                    <div
                      className="w-full rounded-sm bg-brand-gold/40 hover:bg-brand-gold/60 transition-colors duration-150 cursor-default"
                      style={{ height: `${heightPct}%` }}
                      title={branch.branch_name}
                    />
                    <p className="truncate text-[10px] text-text-muted mt-1.5">
                      {branch.branch_name}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      {/* Summary Insights */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Summary Insights
        </p>
      </div>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <article className="lg:col-span-2">
          <div className="flex items-center gap-2 text-brand-gold mb-3">
            <Brain />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">PrepIQ Insight</p>
          </div>
          <p className="text-lg leading-7 text-text-primary">{aiInsight}</p>
          <p className="mt-2 text-sm text-text-muted">
            Generated from cross-branch live signals and margin protection telemetry.
          </p>
        </article>

        <article className="lg:border-l lg:border-surface-4 lg:pl-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
            Executive Signals
          </p>
          <div className="space-y-1">
            {topAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="py-3 border-b border-surface-4 last:border-b-0">
                <p className="text-sm text-text-primary">{alert.title || "Alert"}</p>
                <p className="text-xs text-text-muted mt-0.5">{alert.branch_name}</p>
              </div>
            ))}
            {!topAlerts.length && (
              <p className="text-sm text-text-muted py-2">No active executive risk alerts.</p>
            )}
          </div>
        </article>
      </section>

      {hasError && (
        <div className="mb-8 pl-4 border-l-2 border-status-warning inline-flex items-center gap-2 text-sm text-status-warning">
          <WarningTriangle />
          Some organization intelligence panels are unavailable for your current subscription/role.
        </div>
      )}

      <section>
        <Link href="/setup/branch/create">
          <button className="h-11 rounded-button bg-brand-gold hover:bg-brand-gold-hover active:bg-brand-gold-pressed text-background px-5 inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-150">
            <Shop />
            Add branch
            <ArrowUpRight />
          </button>
        </Link>
      </section>
    </>
  );
}
