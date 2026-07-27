"use client";

import { useMemo, useState } from "react";
import { NavArrowDown } from "iconoir-react";
import {
  useDashboardSeries,
  useDashboardCapacityRisk,
} from "@/services/production-intelligence/hooks";
import { formatCurrencyBreakdown } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import { SalesDemandChart } from "./sales-demand-chart";
import { CapacityRiskChart } from "./capacity-risk-chart";

type Interval = "hourly" | "daily" | "weekly";

export type AnalyticsBranchOption = { id: string; name: string };

const GLOBAL_SCOPE = "__org__";

export function AnalyticsSection({
  canSeeFinancials,
  canSelectBranch,
  branches,
  lockedBranchId,
}: {
  canSeeFinancials: boolean;
  /** VIEW_ALL_BRANCHES holders may toggle Global Org View ↔ single branch. */
  canSelectBranch: boolean;
  branches: AnalyticsBranchOption[];
  /** Branch-scoped users are pinned here; the backend enforces it regardless. */
  lockedBranchId?: string;
}) {
  const { t, language } = useTranslation();
  const [interval, setInterval] = useState<Interval>("daily");
  const [scope, setScope] = useState<string>(
    lockedBranchId ?? (canSelectBranch ? GLOBAL_SCOPE : ""),
  );

  const branchId = lockedBranchId ?? (scope === GLOBAL_SCOPE ? undefined : scope);

  const seriesQuery = useDashboardSeries({
    branch_id: branchId,
    interval,
  });
  const riskQuery = useDashboardCapacityRisk({ branch_id: branchId });

  const series = seriesQuery.data;
  const risk = riskQuery.data;

  const hasAnySeriesData = useMemo(
    () =>
      Boolean(
        series?.points.some(
          (point) =>
            point.sales_actual != null ||
            point.demand_actual != null ||
            point.demand_forecast != null,
        ),
      ),
    [series],
  );

  const asOfLabel = useMemo(() => {
    if (!series?.as_of) return null;
    return new Date(series.as_of).toLocaleTimeString(
      language === "fr" ? "fr-FR" : "en-US",
      { hour: "2-digit", minute: "2-digit" },
    );
  }, [series?.as_of, language]);

  const intervals: Array<{ key: Interval; label: string }> = [
    { key: "hourly", label: t("dashboard.home.analytics.intervalHourly") },
    { key: "daily", label: t("dashboard.home.analytics.intervalDaily") },
    { key: "weekly", label: t("dashboard.home.analytics.intervalWeekly") },
  ];

  return (
    <section className="mb-12">
      {/* ── Section header ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("dashboard.home.analytics.kicker")}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-text-primary">
            {t("dashboard.home.analytics.title")}
          </h2>
          {asOfLabel && (
            <span className="flex items-center gap-2 text-xs text-text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
              </span>
              {t("dashboard.home.analytics.liveAsOf", { time: asOfLabel })}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {t("dashboard.home.analytics.subtitle")}
        </p>
      </div>

      {/* ── Filter row — scopes everything below it ────────────────────── */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t("dashboard.home.analytics.intervalGroupLabel")}
          className="inline-flex h-9 items-center rounded-lg border border-surface-4 p-0.5"
        >
          {intervals.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setInterval(option.key)}
              aria-pressed={interval === option.key}
              className={`h-full rounded-md px-3.5 text-xs font-medium transition-colors duration-150 ${
                interval === option.key
                  ? "bg-surface-3 text-brand-gold"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {canSelectBranch && !lockedBranchId && (
          <div className="relative">
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              aria-label={t("dashboard.home.analytics.scopeGroupLabel")}
              className="h-9 appearance-none rounded-lg border border-surface-4 bg-transparent pl-3.5 pr-9 text-xs font-medium text-text-secondary outline-none transition-colors hover:border-brand-gold/40 focus-visible:border-brand-gold/60"
            >
              <option value={GLOBAL_SCOPE}>
                {t("dashboard.home.analytics.globalOrgView")}
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <NavArrowDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          </div>
        )}

        {series?.currency.is_multi_currency && (
          <span className="text-xs text-text-muted">
            {t("dashboard.home.analytics.multiCurrencyNote")}
            {series.currency.by_currency.length > 0 && (
              <>
                {" · "}
                {formatCurrencyBreakdown(
                  series.currency.by_currency.map((row) => ({
                    currency: row.currency,
                    amount: row.amount,
                  })),
                )}
              </>
            )}
          </span>
        )}
      </div>

      {/* ── Chart 1: sales & demand, actual vs forecast ────────────────── */}
      <div
        className="transition-opacity duration-200"
        style={{ opacity: seriesQuery.isFetching && series ? 0.6 : 1 }}
      >
        {seriesQuery.isLoading ? (
          <ChartPlaceholder label={t("dashboard.home.analytics.loading")} />
        ) : seriesQuery.isError ? (
          <ChartPlaceholder label={t("dashboard.home.analytics.loadError")} error />
        ) : series && hasAnySeriesData ? (
          <SalesDemandChart series={series} canSeeFinancials={canSeeFinancials} />
        ) : (
          <ChartPlaceholder label={t("dashboard.home.analytics.emptySeries")} />
        )}
      </div>

      {/* ── Chart 2: capacity & risk guardrails ────────────────────────── */}
      <div className="mt-12 border-t border-surface-4 pt-10">
        <div className="mb-6">
          <h3 className="font-display text-lg font-semibold text-text-primary">
            {t("dashboard.home.analytics.riskTitle")}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {t("dashboard.home.analytics.riskSubtitle")}
          </p>
        </div>
        <div
          className="transition-opacity duration-200"
          style={{ opacity: riskQuery.isFetching && risk ? 0.6 : 1 }}
        >
          {riskQuery.isLoading ? (
            <ChartPlaceholder label={t("dashboard.home.analytics.loading")} />
          ) : riskQuery.isError ? (
            <ChartPlaceholder label={t("dashboard.home.analytics.loadError")} error />
          ) : risk && risk.days.length > 0 ? (
            <CapacityRiskChart data={risk} />
          ) : (
            <ChartPlaceholder label={t("dashboard.home.analytics.emptyRisk")} />
          )}
        </div>
      </div>
    </section>
  );
}

function ChartPlaceholder({ label, error }: { label: string; error?: boolean }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className={`text-sm ${error ? "text-status-critical" : "text-text-muted"}`}>
        {label}
      </p>
    </div>
  );
}
