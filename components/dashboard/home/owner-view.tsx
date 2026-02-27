"use client";

import Link from "next/link";
import { WarningTriangle, Shop, ArrowUpRight, Brain, StatsUpSquare, StatsDownSquare } from "iconoir-react";

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

  const isPositiveTrend = revenueTrendLabel.includes("+");
  const isHealthyMargin = grossMarginPct >= 70;
  const isLowRisk = riskIndexScore >= 80;

  return (
    <>
      {/* Header */}
      <div className="mb-16">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
              Executive Dashboard
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
              Business Health
            </h1>
            <p className="mt-4 max-w-2xl text-base text-text-secondary leading-relaxed">
              Strategic overview of financial performance, operational efficiency, and risk exposure across all locations.
            </p>
          </div>
          <div className="mt-1 shrink-0 inline-flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-3 border border-surface-4">
            <label
              htmlFor="owner-period"
              className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted"
            >
              Analysis Period
            </label>
            <select
              id="owner-period"
              className="h-9 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary font-medium focus:border-brand-gold focus:outline-none transition-colors"
              defaultValue="30d"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Revenue Trend
            </p>
            <div className={`w-2 h-2 rounded-full ${isPositiveTrend ? 'bg-status-success' : 'bg-status-warning'}`}></div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            {isPositiveTrend ? (
              <StatsUpSquare className="h-5 w-5 text-status-success" />
            ) : (
              <StatsDownSquare className="h-5 w-5 text-status-warning" />
            )}
            <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
              {revenueTrendLabel}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted mb-1">Today's Revenue</p>
            <p className="text-lg font-semibold text-text-secondary">
              ${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Gross Margin
            </p>
            <div className={`w-2 h-2 rounded-full ${isHealthyMargin ? 'bg-status-success' : 'bg-status-warning'}`}></div>
          </div>
          <p className="font-display text-4xl font-semibold text-text-primary tracking-tight mb-2">
            {grossMarginPct.toFixed(1)}%
          </p>
          <div className="mt-4 h-2 bg-surface-3 rounded-full overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                isHealthyMargin ? 'bg-status-success' : 'bg-status-warning'
              }`}
              style={{ width: `${Math.min(100, grossMarginPct)}%` }}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted mb-1">Waste Impact</p>
            <p className="text-sm font-medium text-text-secondary">
              {wasteAsRevenuePct.toFixed(2)}% of revenue
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              EBITDA Proxy
            </p>
            <div className="w-2 h-2 rounded-full bg-brand-gold"></div>
          </div>
          <p className="font-display text-4xl font-semibold text-text-primary tracking-tight mb-2">
            ${ebitdaProxy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              Calculated from revenue minus waste and surplus pressure
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Risk Index
            </p>
            <div className={`w-2 h-2 rounded-full ${isLowRisk ? 'bg-status-success' : riskIndexScore >= 60 ? 'bg-status-warning' : 'bg-status-critical'}`}></div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
              {riskIndexScore.toFixed(0)}
            </p>
            <span className="text-lg text-text-muted">/100</span>
          </div>
          <div className="mt-4 h-2 bg-surface-3 rounded-full overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                isLowRisk ? 'bg-status-success' : riskIndexScore >= 60 ? 'bg-status-warning' : 'bg-status-critical'
              }`}
              style={{ width: `${riskIndexScore}%` }}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {isLowRisk ? 'Healthy' : riskIndexScore >= 60 ? 'Monitor' : 'Action Required'}
            </p>
          </div>
        </article>
      </section>

      {/* Performance Metrics */}
      <section className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <article className="bg-surface-2 rounded-xl p-8 border border-surface-4">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Operational Efficiency
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
              Purchasing Score
            </h3>
          </div>
          <div className="text-center py-6">
            <p className="font-display text-5xl font-semibold text-brand-gold tracking-tight">
              {purchasingEfficiencyScore.toFixed(1)}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Out of 100
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              Score factors in supplier anomalies and margin leakage patterns
            </p>
          </div>
        </article>

        <article className="lg:col-span-2 bg-surface-2 rounded-xl p-8 border border-surface-4">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Branch Performance
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
              Revenue Ranking
            </h3>
          </div>
          
          <div className="space-y-4 mb-6">
            {branchRankingSummary.length ? (
              branchRankingSummary.map((branch, index) => {
                const revenuePct = (Number(branch.revenue ?? 0) / maxRevenue) * 100;
                const wastePct = Number(branch.waste_pct ?? 0);
                const isTopPerformer = index === 0;
                
                return (
                  <div
                    key={branch.branch_id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isTopPerformer 
                        ? 'bg-brand-gold/10 border-brand-gold/30' 
                        : 'bg-surface-3 border-surface-4 hover:border-surface-4/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold ${
                          isTopPerformer 
                            ? 'bg-brand-gold text-background' 
                            : 'bg-surface-4 text-text-muted'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">
                            {branch.branch_name}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-text-muted">
                              Waste: {wastePct.toFixed(1)}%
                            </span>
                            <span className="text-xs text-text-muted">
                              Surplus: {Number(branch.surplus_pct ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-semibold text-text-primary">
                          ${Number(branch.revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 bg-surface-1 rounded-full overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isTopPerformer ? 'bg-brand-gold' : 'bg-text-muted'
                        }`}
                        style={{ width: `${revenuePct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted">No branch ranking data available</p>
                <p className="text-sm text-text-muted mt-1">Data will appear once operations begin</p>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Insights Section */}
      <section className="mb-16">
        <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden">
          <div className="p-8 pb-6 border-b border-surface-4">
            <div className="flex items-center gap-2 text-brand-gold mb-2">
              <Brain className="h-5 w-5" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                PrepIQ Intelligence
              </p>
            </div>
            <h3 className="font-display text-2xl font-semibold text-text-primary">
              Strategic Insight
            </h3>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <p className="text-lg leading-relaxed text-text-primary">
                {aiInsight}
              </p>
              <p className="mt-4 text-sm text-text-muted">
                Generated from cross-branch operational signals, margin protection telemetry, and predictive analytics.
              </p>
            </div>

            <div className="lg:border-l lg:border-surface-4 lg:pl-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                Priority Alerts
              </p>
              <div className="space-y-3">
                {topAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg bg-surface-3 border border-surface-4">
                    <p className="text-sm font-medium text-text-primary">{alert.title || "Alert"}</p>
                    <p className="text-xs text-text-muted mt-1">{alert.branch_name}</p>
                  </div>
                ))}
                {!topAlerts.length && (
                  <div className="p-4 rounded-lg bg-status-success/10 border border-status-success/20">
                    <p className="text-sm text-status-success">No active risk alerts</p>
                    <p className="text-xs text-text-muted mt-1">All systems operating normally</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {hasError && (
        <div className="mb-8 p-4 rounded-lg bg-status-warning/10 border-l-4 border-status-warning inline-flex items-center gap-3">
          <WarningTriangle className="h-5 w-5 text-status-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-status-warning">Limited Data Access</p>
            <p className="text-xs text-text-muted mt-1">
              Some intelligence panels are unavailable for your current subscription tier
            </p>
          </div>
        </div>
      )}

      <section className="flex items-center gap-4">
        <Link href="/setup/branch/create">
          <button className="h-11 rounded-lg bg-brand-gold hover:bg-brand-gold-hover active:bg-brand-gold-pressed text-background px-6 inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.4)] active:scale-[0.98]">
            <Shop className="h-4 w-4" />
            Add Branch
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </Link>
        <Link href="/workspace/branches">
          <button className="h-11 rounded-lg bg-surface-2 hover:bg-surface-3 border border-surface-4 text-text-primary px-6 inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200">
            View All Branches
          </button>
        </Link>
      </section>
    </>
  );
}
