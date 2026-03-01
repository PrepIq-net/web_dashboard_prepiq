"use client";

import Link from "next/link";
import { WarningTriangle, Shop, ArrowUpRight, Brain } from "iconoir-react";
import { KpiCard } from "./kpi-card";

interface AlertItem {
  id: string;
  title?: string | null;
  branch_name?: string | null;
  severity?: string | null;
}

interface BranchWasteRow {
  branch_id: string;
  branch_name: string;
  waste_pct?: number | null;
  revenue?: number | null;
}

interface OpsViewProps {
  totalRevenue: number;
  averageMarginPct: number;
  topPerformingBranchName: string | undefined;
  topPerformingBranchRevenue: number;
  highSeverityAlerts: number;
  underperformingBranches: number;
  wasteHeatmapRows: BranchWasteRow[];
  productionEfficiencyScore: number;
  staffPerformanceIndex: number;
  supplierAnomalies: number;
  forecastAccuracyPct: number;
  aiInsight: string;
  topAlerts: AlertItem[];
  hasError: boolean;
}

export function OpsView({
  totalRevenue,
  averageMarginPct,
  topPerformingBranchName,
  topPerformingBranchRevenue,
  highSeverityAlerts,
  underperformingBranches,
  wasteHeatmapRows,
  productionEfficiencyScore,
  staffPerformanceIndex,
  supplierAnomalies,
  forecastAccuracyPct,
  aiInsight,
  topAlerts,
  hasError,
}: OpsViewProps) {
  const marginStatus =
    averageMarginPct >= 70 ? "success" : averageMarginPct >= 50 ? "warning" : "critical";

  return (
    <>
      {/* Header */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Operations Command Center
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
          Organization Overview
        </h1>
        <p className="mt-4 text-base text-text-secondary max-w-2xl">
          Real-time operational intelligence and performance metrics across all branch locations.
        </p>
      </div>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
        <KpiCard
          label="Total Revenue"
          value={`$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtext="All branches today"
          status="gold"
        />
        <KpiCard
          label="Avg Margin"
          value={`${averageMarginPct.toFixed(1)}%`}
          subtext="Cross-branch average"
          status={marginStatus}
          progress={averageMarginPct}
          progressColor={marginStatus}
        />
        <KpiCard
          label="Top Performer"
          value={topPerformingBranchName ?? "—"}
          subtext={`Revenue: $${topPerformingBranchRevenue.toLocaleString()}`}
          status="success"
          compact
        />
        <KpiCard
          label="Priority Alerts"
          value={highSeverityAlerts}
          subtext={`${underperformingBranches} branches need attention`}
          status={highSeverityAlerts > 0 ? "critical" : "success"}
        />
      </section>

      {/* Waste Heatmap + Performance Metrics */}
      <section className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2 bg-surface-2 rounded-card p-8 border border-surface-4/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Waste Performance
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
                Branch Waste Analysis
              </h2>
            </div>
            <p className="text-sm text-text-muted">{wasteHeatmapRows.length} branches</p>
          </div>
          <div className="space-y-5">
            {wasteHeatmapRows.length ? (
              wasteHeatmapRows.map((branch, index) => {
                const wastePct = Number(branch.waste_pct ?? 0);
                const isHigh = wastePct > 8;
                const isMed = wastePct > 4;
                const barColor = isHigh
                  ? "bg-status-critical"
                  : isMed
                    ? "bg-status-warning"
                    : "bg-status-success";
                const badgeCls = isHigh
                  ? "bg-status-critical/15 text-status-critical"
                  : isMed
                    ? "bg-status-warning/15 text-status-warning"
                    : "bg-status-success/15 text-status-success";

                return (
                  <div key={branch.branch_id}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-text-muted w-6 shrink-0">
                          #{index + 1}
                        </span>
                        <span className="font-medium text-text-primary truncate">
                          {branch.branch_name}
                        </span>
                        <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badgeCls}`}>
                          {isHigh ? "High Risk" : isMed ? "Medium Risk" : "Low Risk"}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="font-semibold text-text-primary">{wastePct.toFixed(1)}%</p>
                        <p className="text-xs text-text-muted">
                          ${Number(branch.revenue ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.min(100, wastePct * 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted">No waste data available</p>
                <p className="text-sm text-text-disabled mt-1">Check back after operations begin</p>
              </div>
            )}
          </div>
        </article>

        <article className="bg-surface-2 rounded-card p-8 border border-surface-4/50">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Key Indicators
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
              Performance Metrics
            </h2>
          </div>
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-text-secondary">Production Efficiency</p>
                <span className="font-semibold text-text-primary">
                  {productionEfficiencyScore.toFixed(1)}
                </span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-brand-gold rounded-full transition-all duration-500"
                  style={{ width: `${productionEfficiencyScore}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-text-secondary">Staff Performance</p>
                <span className="font-semibold text-text-primary">
                  {staffPerformanceIndex.toFixed(1)}
                </span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    staffPerformanceIndex >= 80
                      ? "bg-status-success"
                      : staffPerformanceIndex >= 60
                        ? "bg-status-warning"
                        : "bg-status-critical"
                  }`}
                  style={{ width: `${staffPerformanceIndex}%` }}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-surface-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-4">
                Priority Actions
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-critical mt-1.5 shrink-0" />
                  <p className="text-sm text-text-secondary">
                    {underperformingBranches} branches need intervention
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1.5 shrink-0" />
                  <p className="text-sm text-text-secondary">
                    {supplierAnomalies} supplier anomalies detected
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-success mt-1.5 shrink-0" />
                  <p className="text-sm text-text-secondary">
                    Forecast accuracy: {forecastAccuracyPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* Summary Insights */}
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Summary Insights
        </p>
      </div>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <article className="lg:col-span-2">
          <div className="flex items-center gap-2 text-brand-gold mb-3">
            <Brain />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">
              Operational Insight
            </p>
          </div>
          <p className="text-lg leading-7 text-text-primary">{aiInsight}</p>
          <p className="mt-2 text-sm text-text-muted">
            Generated from cross-branch live signals and margin protection telemetry.
          </p>
        </article>

        <article className="lg:border-l lg:border-surface-4 lg:pl-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
            Where To Look Next
          </p>
          <div className="space-y-1">
            {topAlerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="py-3 border-b border-surface-4 last:border-b-0">
                <p className="text-sm text-text-primary">{alert.title || "Alert"}</p>
                <p className="text-xs text-text-muted mt-0.5">{alert.branch_name}</p>
              </div>
            ))}
            {!topAlerts.length && (
              <p className="text-sm text-text-muted py-2">No risk alerts detected.</p>
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
