"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useSalesWasteReport,
} from "@/services";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type SalesWasteTab =
  | "OVERVIEW"
  | "ITEMS"
  | "TRENDS"
  | "FORECAST"
  | "DRIVERS"
  | "INSIGHTS"
  | "NETWORK";

type SalesWasteRow = {
  item_id: string;
  item_title: string | null;
  unit: string;
  forecasted: number;
  produced: number;
  sold: number;
  waste: number;
  revenue: number;
  food_cost: number;
  waste_cost: number;
  over_prep: number;
  under_prep: number;
  lost_revenue: number;
  margin_impact: number;
  margin_pct: number;
};

const columnHelper = createColumnHelper<SalesWasteRow>();

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function buildSparklinePoints(values: number[], width: number, height: number) {
  if (!values.length) return "";
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const span = Math.max(1, maxVal - minVal);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - minVal) / span) * (height - 10) - 5;
      return `${x},${y}`;
    })
    .join(" ");
}

function getProfitabilityLabel(t: any, marginPct: number) {
  if (marginPct >= 60) return t("workspace.today.confidence.high");
  if (marginPct >= 45) return t("workspace.today.confidence.medium");
  return t("workspace.today.confidence.low");
}

function getProfitabilityTone(marginPct: number) {
  if (marginPct >= 60) return "text-status-success";
  if (marginPct >= 45) return "text-brand-gold";
  return "text-status-critical";
}

function SalesWasteContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const role = user?.organization_role ?? "";
  const canAccess = ["ORG_OWNER", "ORG_ADMIN", "OPS_DIRECTOR", "GM", "BRANCH_MANAGER"].includes(role);
  const canViewAllBranches = Boolean(accessScope?.can_view_all_branches);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;

  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const scopedBranchIds = new Set(accessibleBranches.map((branch) => branch.id));
  const branchOptions = useMemo(() => {
    if (canViewAllBranches) {
      return branches;
    }
    if (accessibleBranches.length) {
      if (!branches.length) {
        return accessibleBranches;
      }
      return branches.filter((branch) => scopedBranchIds.has(branch.id));
    }
    return [];
  }, [accessibleBranches, branches, canViewAllBranches, scopedBranchIds]);

  const defaultBranch =
    branchOptions.find((branch) => branch.id === accessScope?.default_branch_id) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  const queryBranchId = searchParams.get("branch") ?? "";
  const queryDate = searchParams.get("date") ?? "";
  const queryItemId = searchParams.get("item") ?? "";
  const queryPeriod = searchParams.get("period") ?? "";

  const [activeTab, setActiveTab] = useState<SalesWasteTab>("OVERVIEW");
  const [selectedBranchId, setSelectedBranchId] = useState(
    queryBranchId || (defaultBranch?.id ?? ""),
  );
  const [anchorDate, setAnchorDate] = useState(
    queryDate || new Date().toISOString().slice(0, 10),
  );
  const [period, setPeriod] = useState(queryPeriod || "30d");
  const [focusedItemId] = useState(queryItemId);

  useEffect(() => {
    if (!selectedBranchId && defaultBranch?.id) {
      setSelectedBranchId(defaultBranch.id);
    }
  }, [defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!branchOptions.length) return;
    if (!selectedBranchId) return;
    const isAllowed = branchOptions.some((branch) => branch.id === selectedBranchId);
    if (!isAllowed && defaultBranch?.id) {
      setSelectedBranchId(defaultBranch.id);
    }
  }, [branchOptions, defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const reportQuery = useSalesWasteReport(
    {
      branch_id: selectedBranchId,
      period,
      target_date: anchorDate,
    },
  );

  const report = reportQuery.data;
  const summaries = report?.summaries;
  const summaryCards = useMemo(
    () => [
      { label: t("workspace.salesWaste.todayLabel"), data: summaries?.today },
      { label: t("workspace.salesWaste.last7DaysLabel"), data: summaries?.week },
      {
        label: t("workspace.salesWaste.last30DaysLabel"),
        data: summaries?.month,
      },
    ],
    [summaries, t],
  );

  const items = useMemo(() => {
    if (!report?.items) return [] as SalesWasteRow[];
    if (!focusedItemId) return report.items;
    return report.items.filter((row) => row.item_id === focusedItemId);
  }, [report?.items, focusedItemId]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("item_title", {
        header: t("workspace.salesWaste.table.item"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {info.getValue() ?? t("common.none")}
          </span>
        ),
      }),
      columnHelper.accessor("sold", {
        header: t("workspace.salesWaste.table.sold"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("waste", {
        header: t("workspace.salesWaste.table.waste"),
        cell: (info) => (
          <span className="text-sm text-status-warning">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "wastePct",
        header: t("workspace.salesWaste.table.wastePct"),
        cell: (info) => {
          const row = info.row.original;
          const base = Math.max(row.sold, 1);
          const pct = (row.waste / base) * 100;
          return (
            <span className="text-sm text-text-secondary">{toPercent(pct)}</span>
          );
        },
      }),
      columnHelper.accessor("revenue", {
        header: t("workspace.salesWaste.table.revenue"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("margin_impact", {
        header: t("workspace.salesWaste.table.profitability"),
        cell: (info) => (
          <span
            className={`text-sm font-semibold ${getProfitabilityTone(info.row.original.margin_pct)}`}
          >
            {getProfitabilityLabel(t, info.row.original.margin_pct)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: t("workspace.salesWaste.table.action"),
        cell: (info) => (
          <Link
            href={`/workspace/sales-waste/item?item=${info.row.original.item_id}&branch=${selectedBranchId}&date=${anchorDate}&period=${period}`}
            className="inline-flex h-8 items-center rounded-lg border border-surface-4 px-3 text-xs text-text-secondary hover:text-text-primary"
          >
            {t("workspace.salesWaste.drillInButton")}
          </Link>
        ),
      }),
    ],
    [anchorDate, selectedBranchId, period, t],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  const trendSeries = useMemo(() => {
    const trends = report?.trends ?? [];
    return {
      labels: trends.map((row) => row.date.slice(5)),
      revenue: trends.map((row) => row.revenue),
      waste: trends.map((row) => row.waste_cost),
      food: trends.map((row) => row.food_cost),
      margin: trends.map((row) => row.margin),
      wasteRate: trends.map((row) =>
        row.revenue > 0 ? (row.waste_cost / row.revenue) * 100 : 0,
      ),
    };
  }, [report?.trends]);

  const efficiencyRatio = report?.totals?.efficiency_ratio ?? 0;

  return (
    <WorkspaceShell
      eyebrow={t("workspace.salesWaste.eyebrow")}
      title={t("workspace.salesWaste.title")}
      description={t("workspace.salesWaste.description")}
      insight={t("workspace.salesWaste.insight")}
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Select
            label={t("common.branch")}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
          />
          <Select
            label={t("financial.timeframe")}
            options={[
              { value: "today", label: t("workspace.salesWaste.todayLabel") },
              { value: "7d", label: t("workspace.salesWaste.last7DaysLabel") },
              { value: "30d", label: t("workspace.salesWaste.last30DaysLabel") },
            ]}
            value={period}
            onChange={setPeriod}
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("workspace.salesWaste.anchorDateLabel")}
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
              className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 text-sm text-text-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("workspace.salesWaste.selectedWindowLabel")}
            </label>
            <div className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 flex items-center text-sm text-text-secondary">
              {report
                ? `${report.period_start_date} → ${report.period_end_date}`
                : "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-surface-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "OVERVIEW", label: t("workspace.salesWaste.tabs.overview") },
              { id: "ITEMS", label: t("workspace.salesWaste.tabs.items") },
              { id: "TRENDS", label: t("workspace.salesWaste.tabs.trends") },
              { id: "FORECAST", label: t("workspace.salesWaste.tabs.forecast") },
              { id: "DRIVERS", label: t("workspace.salesWaste.tabs.drivers") },
              { id: "INSIGHTS", label: t("workspace.salesWaste.tabs.insights") },
              { id: "NETWORK", label: t("workspace.salesWaste.tabs.network") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SalesWasteTab)}
                className={`inline-flex h-10 items-center px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-brand-gold/20 text-brand-gold border border-brand-gold/40 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === "OVERVIEW" ? (
        <section className="space-y-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("financial.tabs.overview")}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {t("workspace.salesWaste.performanceAtGlanceTitle")}
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-4">
                {summaryCards.map((card) => (
                  <article key={card.label} className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                      {card.label}
                    </p>
                    <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                      {toCurrency(card.data?.revenue ?? 0)}
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-text-secondary">
                      <p>
                        {t("workspace.salesWaste.ordersCount", {
                          count: card.data?.total_orders ?? 0,
                        })}
                      </p>
                      <p>
                        {t("workspace.salesWaste.avgOrderValue", {
                          amount: toCurrency(card.data?.avg_order_value ?? 0),
                        })}
                      </p>
                      <p>
                        {t("workspace.salesWaste.topItemLabel", {
                          title: card.data?.top_item?.item_title ?? "—",
                        })}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.salesWaste.tabs.drivers")}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {t("workspace.salesWaste.profitLeaksTitle")}
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-4">
                {summaryCards.map((card) => (
                  <article key={`waste-${card.label}`} className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                      {card.label}
                    </p>
                    <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                      {toCurrency(card.data?.waste_summary?.total_waste_value ?? 0)}
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-text-secondary">
                      <p>
                        {t("workspace.salesWaste.wasteRateLabel", {
                          percent:
                            card.data?.waste_summary?.waste_rate_pct?.toFixed(
                              1,
                            ) ?? 0,
                        })}
                      </p>
                      <p>
                        {t("workspace.salesWaste.topWasteLabel", {
                          title:
                            card.data?.waste_summary?.top_waste_item
                              ?.item_title ?? "—",
                        })}
                      </p>
                      <p>
                        {t("workspace.salesWaste.unitsWastedLabel", {
                          count:
                            card.data?.waste_summary?.top_waste_item
                              ?.units_wasted ?? 0,
                        })}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.salesWaste.salesEfficiencyTitle")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("workspace.salesWaste.salesVsWasteRatioTitle")}
            </h3>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("financial.summary.revenue")}
                </p>
                <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                  {toCurrency(report?.totals?.revenue ?? 0)}
                </p>
              </article>
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("financial.summary.wasteCost")}
                </p>
                <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                  {toCurrency(report?.totals?.waste_cost ?? 0)}
                </p>
              </article>
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("workspace.salesWaste.efficiencyRatioLabel")}
                </p>
                <p className="font-display text-3xl font-semibold text-brand-gold tracking-tight">
                  {toPercent(efficiencyRatio)}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  {t("workspace.salesWaste.efficiencyRatioFormula")}
                </p>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "ITEMS" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.salesWaste.tabs.items")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("workspace.history.tabItemPerformance")}
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              {t("workspace.salesWaste.tuningHint")}
            </p>
          </div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("financial.summary.revenue")}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toCurrency(report?.totals?.revenue ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.salesWaste.foodCostRatioLabel")}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {toPercent(report?.totals?.food_cost_ratio ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("financial.waste.wasteRate")}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-warning">
                {toPercent(report?.totals?.waste_rate_pct ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("financial.stockout.lostRevenue")}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-critical">
                {toCurrency(report?.totals?.lost_revenue ?? 0)}
              </p>
            </article>
          </div>
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <NativeTable
                table={table}
                tableClassName="w-full min-w-[980px]"
                headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
                bodyClassName="divide-y divide-surface-4"
                headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="transition-all duration-200 hover:bg-surface-3/50"
                cellClassName="px-6 py-4"
              />
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "TRENDS" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.salesWaste.tabs.trends")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("financial.trends.breakdownTitle")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[
              {
                label: t("workspace.salesWaste.revenueTrendLabel"),
                color: "text-status-success",
                series: trendSeries.revenue,
              },
              {
                label: t("workspace.salesWaste.wasteRateTrendLabel"),
                color: "text-status-critical",
                series: trendSeries.wasteRate,
                suffix: "%",
              },
            ].map((chart) => {
              const points = buildSparklinePoints(chart.series, 520, 160);
              return (
                <div
                  key={chart.label}
                  className="rounded-xl border border-surface-4 bg-surface-2 p-5"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                    {chart.label}
                  </p>
                  {chart.series.length ? (
                    <div className="mt-4">
                      <svg viewBox="0 0 520 160" className="h-40 w-full">
                        <polyline
                          points={points}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          className={chart.color}
                        />
                      </svg>
                      <div className="mt-2 grid grid-cols-6 gap-2 text-[10px] text-text-muted">
                        {trendSeries.labels.slice(-6).map((label, index) => (
                          <div key={`${chart.label}-${label}-${index}`}>
                            <p>{label}</p>
                            <p className="font-semibold text-text-secondary">
                              {chart.suffix
                                ? `${(chart.series[Math.max(0, chart.series.length - 6 + index)] ?? 0).toFixed(1)}${chart.suffix}`
                                : toCurrency(
                                    chart.series[
                                      Math.max(
                                        0,
                                        chart.series.length - 6 + index,
                                      )
                                    ] ?? 0,
                                  )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-text-muted">
                      {t("financial.trends.notEnoughData")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeTab === "FORECAST" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.salesWaste.tabs.forecast")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("workspace.salesWaste.mlAccuracyTitle")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.accuracy.currentAccuracy")}
              </p>
              <p className="font-display text-3xl font-semibold text-brand-gold tracking-tight">
                {toPercent(report?.forecast_impact?.forecast_accuracy ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("workspace.salesWaste.wasteAvoidedLabel")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                {toCurrency(report?.forecast_impact?.waste_avoided ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {report?.forecast_impact?.stockouts_prevented === null
                  ? t("workspace.salesWaste.stockoutsDetectedLabel")
                  : t("workspace.salesWaste.stockoutsPreventedLabel")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                {report?.forecast_impact?.stockouts_prevented ??
                  report?.forecast_impact?.stockout_events ??
                  0}
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "DRIVERS" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.salesWaste.tabs.drivers")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("workspace.salesWaste.whyWasteHappensTitle")}
            </h3>
            {report?.waste_drivers?.data_note ? (
              <p className="mt-2 text-sm text-text-muted">{report.waste_drivers.data_note}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(report?.waste_drivers?.drivers ?? []).map((driver) => (
              <div key={driver.label} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{driver.label}</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-text-primary">
                    {toPercent(driver.pct)}
                  </p>
                  <p className="text-sm text-text-muted">
                    {toCurrency(driver.cost)}
                  </p>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-surface-3">
                  <div
                    className="h-2 rounded-full bg-brand-gold"
                    style={{ width: `${Math.min(driver.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "INSIGHTS" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.salesWaste.tabs.insights")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("workspace.salesWaste.actionableRecommendationsTitle")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(report?.opportunity_insights ?? []).length ? (
              report?.opportunity_insights.map((insight) => (
                <article
                  key={insight.item_id ?? insight.item_title}
                  className="rounded-xl border border-surface-4 bg-surface-2 p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {insight.item_title ?? t("workspace.salesWaste.table.item")}
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">
                    {t("financial.waste.wasteRate")}:{" "}
                    <span className="font-semibold text-status-critical">
                      {toPercent(insight.waste_rate_pct)}
                    </span>
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">
                    {insight.suggested_action}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-text-muted">
                    {t("setup.forecast.potentialSavings")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-status-success">
                    {toCurrency(insight.potential_savings)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                {t("workspace.salesWaste.noWasteOpportunities")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "NETWORK" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.salesWaste.tabs.network")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("workspace.salesWaste.crossBranchSignalsTitle")}
            </h3>
          </div>
          {report?.network_insights?.available ? (
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-sm text-text-secondary">
                {t("workspace.salesWaste.avgWasteNetwork", {
                  percent: toPercent(
                    report.network_insights.avg_waste_rate_pct ?? 0,
                  ),
                })}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {(report.network_insights.top_waste_items ?? []).map((item) => (
                  <div
                    key={item.item_id ?? item.item_title}
                    className="rounded-lg border border-surface-4 bg-surface-3 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                      {item.item_title ?? t("workspace.salesWaste.table.item")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-status-critical">
                      {toCurrency(item.waste_cost)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
              {report?.network_insights?.message ??
                t("risk.network.noRisks")}
            </div>
          )}
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

export default function SalesWastePage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          {t("workspace.salesWaste.loadingSalesWaste")}
        </div>
      }
    >
      <SalesWasteContent />
    </Suspense>
  );
}
