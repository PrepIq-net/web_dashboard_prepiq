"use client";

import Link from "next/link";
import { WarningTriangle, Shop, ArrowUpRight, Brain, StatsUpSquare, StatsDownSquare } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
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
              {t("dashboard.home.executiveDashboard")}
            </p>
            <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
              {t("dashboard.home.businessHealth")}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-text-secondary leading-relaxed">
              {t("dashboard.home.strategicOverview")}
            </p>
          </div>
          <div className="mt-1 shrink-0 inline-flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-3 border border-surface-4">
            <label
              htmlFor="owner-period"
              className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted"
            >
              {t("dashboard.home.analysisPeriod")}
            </label>
            <select
              id="owner-period"
              className="h-9 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary font-medium focus:border-brand-gold focus:outline-none transition-colors"
              defaultValue="30d"
            >
              <option value="7d">{t("dashboard.home.last7Days")}</option>
              <option value="30d">{t("dashboard.home.last30Days")}</option>
              <option value="90d">{t("dashboard.home.last90Days")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("dashboard.home.revenueTrend")}
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
            <p className="text-xs text-text-muted mb-1">{t("dashboard.home.yesterday")} {t("dashboard.home.totalRevenue").split(' ')[2]}</p>
            <p className="text-lg font-semibold text-text-secondary">
              ${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("dashboard.home.grossMargin")}
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
            <p className="text-xs text-text-muted mb-1">{t("dashboard.home.wasteImpact")}</p>
            <p className="text-sm font-medium text-text-secondary">
              {wasteAsRevenuePct.toFixed(2)}% {t("dashboard.home.ofRevenue")}
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("dashboard.home.ebitdaProxy")}
            </p>
            <div className="w-2 h-2 rounded-full bg-brand-gold"></div>
          </div>
          <p className="font-display text-4xl font-semibold text-text-primary tracking-tight mb-2">
            ${ebitdaProxy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {t("dashboard.home.ebitdaDescription")}
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 hover:border-surface-4/80 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("dashboard.home.riskIndex")}
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
              {isLowRisk ? t("dashboard.home.healthy") : riskIndexScore >= 60 ? t("dashboard.home.monitor") : t("dashboard.home.actionRequired")}
            </p>
          </div>
        </article>
      </section>

      {/* Performance Metrics */}
      <section className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <article className="bg-surface-2 rounded-xl p-8 border border-surface-4">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("dashboard.home.operationalEfficiency")}
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
              {t("dashboard.home.purchasingScore")}
            </h3>
          </div>
          <div className="text-center py-6">
            <p className="font-display text-5xl font-semibold text-brand-gold tracking-tight">
              {purchasingEfficiencyScore.toFixed(1)}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {t("dashboard.home.outOf100")}
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {t("dashboard.home.purchasingScoreDescription")}
            </p>
          </div>
        </article>

        <article className="lg:col-span-2 bg-surface-2 rounded-xl p-8 border border-surface-4">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("dashboard.home.branchPerformance")}
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
              {t("dashboard.home.revenueRanking")}
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
                              {t("dashboard.home.wasteCost").split(' ')[0]}: {wastePct.toFixed(1)}%
                            </span>
                            <span className="text-xs text-text-muted">
                              {t("dashboard.home.surplus")}: {Number(branch.surplus_pct ?? 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-semibold text-text-primary">
                        ${Number(branch.revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <Link
                        href={`/workspace/overview/branch/${branch.branch_id}?date=${today}`}
                        className="mt-2 inline-flex h-7 items-center rounded-full border border-brand-gold/45 px-3 text-[11px] font-semibold text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10"
                      >
                        {t("dashboard.home.viewToday")}
                      </Link>
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
                <p className="text-text-muted">{t("dashboard.home.noBranchRankingData")}</p>
                <p className="text-sm text-text-muted mt-1">{t("dashboard.home.dataWillAppear")}</p>
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
                {t("dashboard.home.prepiqIntelligence")}
              </p>
            </div>
            <h3 className="font-display text-2xl font-semibold text-text-primary">
              {t("dashboard.home.strategicInsight")}
            </h3>
          </div>
          
          <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <p className="text-lg leading-relaxed text-text-primary">
                {aiInsight}
              </p>
              <p className="mt-4 text-sm text-text-muted">
                {t("dashboard.home.analyticsDescription")}
              </p>
            </div>

            <div className="lg:border-l lg:border-surface-4 lg:pl-8">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                {t("dashboard.home.priorityAlerts")}
              </p>
              <div className="space-y-3">
                {topAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg bg-surface-3 border border-surface-4">
                    <p className="text-sm font-medium text-text-primary">{alert.title || t("common.warning")}</p>
                    <p className="text-xs text-text-muted mt-1">{alert.branch_name}</p>
                  </div>
                ))}
                {!topAlerts.length && (
                  <div className="p-4 rounded-lg bg-status-success/10 border border-status-success/20">
                    <p className="text-sm text-status-success">{t("dashboard.home.noRiskAlerts")}</p>
                    <p className="text-xs text-text-muted mt-1">{t("dashboard.home.allSystemsNormal")}</p>
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
            <p className="text-sm font-medium text-status-warning">{t("dashboard.home.limitedDataAccess")}</p>
            <p className="text-xs text-text-muted mt-1">
              {t("dashboard.home.subscriptionRestricted")}
            </p>
          </div>
        </div>
      )}

      <section className="flex items-center gap-4">
        <Link href="/setup/branch/create">
          <button className="h-11 rounded-lg bg-brand-gold hover:bg-brand-gold-hover active:bg-brand-gold-pressed text-background px-6 inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.3)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.4)] active:scale-[0.98]">
            <Shop className="h-4 w-4" />
            {t("dashboard.home.addBranch")}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </Link>
        <Link href="/workspace/branches">
          <button className="h-11 rounded-lg bg-surface-2 hover:bg-surface-3 border border-surface-4 text-text-primary px-6 inline-flex items-center gap-2 text-sm font-semibold transition-all duration-200">
            {t("dashboard.home.viewAllBranches")}
          </button>
        </Link>
      </section>
    </>
  );
}
