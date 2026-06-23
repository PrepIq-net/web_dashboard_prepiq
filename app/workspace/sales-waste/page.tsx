"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

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

function getProfitabilityLabel(marginPct: number) {
  if (marginPct >= 60) return "High";
  if (marginPct >= 45) return "Medium";
  return "Low";
}

function getProfitabilityTone(label: string) {
  if (label === "High") return "text-status-success";
  if (label === "Medium") return "text-brand-gold";
  return "text-status-critical";
}

function SalesWasteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.VIEW_PRODUCTION_REPORTS);
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
      { label: "Today", data: summaries?.today },
      { label: "Last 7 Days", data: summaries?.week },
      { label: "Last 30 Days", data: summaries?.month },
    ],
    [summaries],
  );

  const items = useMemo(() => {
    if (!report?.items) return [] as SalesWasteRow[];
    if (!focusedItemId) return report.items;
    return report.items.filter((row) => row.item_id === focusedItemId);
  }, [report?.items, focusedItemId]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("item_title", {
        header: "Item",
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {info.getValue() ?? "Unknown"}
          </span>
        ),
      }),
      columnHelper.accessor("sold", {
        header: "Sold",
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("waste", {
        header: "Waste",
        cell: (info) => (
          <span className="text-sm text-status-warning">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "wastePct",
        header: "Waste %",
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
        header: "Revenue",
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("margin_impact", {
        header: "Profitability",
        cell: (info) => (
          <span className={`text-sm font-semibold ${getProfitabilityTone(getProfitabilityLabel(info.row.original.margin_pct))}`}>
            {getProfitabilityLabel(info.row.original.margin_pct)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Action",
        cell: (info) => (
          <Link
            href={`/workspace/sales-waste/item?item=${info.row.original.item_id}&branch=${selectedBranchId}&date=${anchorDate}&period=${period}`}
            className="inline-flex h-8 items-center rounded-lg border border-surface-4 px-3 text-xs text-text-secondary hover:text-text-primary"
          >
            Drill In
          </Link>
        ),
      }),
    ],
    [anchorDate, selectedBranchId, period],
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
      eyebrow="Sales & Waste"
      title="Profit Intelligence"
      description="Connect sales performance with waste loss and forecasting impact."
      insight="Understand where revenue is being captured and where margin leaks are happening."
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Select
            label="Branch"
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
          />
          <Select
            label="Period"
            options={[
              { value: "today", label: "Today" },
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
            ]}
            value={period}
            onChange={setPeriod}
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Anchor Date
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
              Selected Window
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
              { id: "OVERVIEW", label: "Overview" },
              { id: "ITEMS", label: "Item Performance" },
              { id: "TRENDS", label: "Trends" },
              { id: "FORECAST", label: "Forecast Impact" },
              { id: "DRIVERS", label: "Waste Drivers" },
              { id: "INSIGHTS", label: "Insights" },
              { id: "NETWORK", label: "Network" },
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
                Sales Summary
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Performance at a Glance
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
                      <p>Orders: {card.data?.total_orders ?? 0}</p>
                      <p>Avg Order: {toCurrency(card.data?.avg_order_value ?? 0)}</p>
                      <p>Top Item: {card.data?.top_item?.item_title ?? "—"}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Waste Summary
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Where Profit Leaks Happen
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
                      <p>Waste Rate: {toPercent(card.data?.waste_summary?.waste_rate_pct ?? 0)}</p>
                      <p>Top Waste: {card.data?.waste_summary?.top_waste_item?.item_title ?? "—"}</p>
                      <p>
                        Units Wasted: {card.data?.waste_summary?.top_waste_item?.units_wasted ?? 0}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Sales Efficiency
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Sales vs Waste Ratio
            </h3>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  Revenue
                </p>
                <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                  {toCurrency(report?.totals?.revenue ?? 0)}
                </p>
              </article>
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  Waste Cost
                </p>
                <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                  {toCurrency(report?.totals?.waste_cost ?? 0)}
                </p>
              </article>
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  Efficiency Ratio
                </p>
                <p className="font-display text-3xl font-semibold text-brand-gold tracking-tight">
                  {toPercent(efficiencyRatio)}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  (Revenue − Waste) / Revenue
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
              Item Performance
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Sales, Waste, and Forecast Impact
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              Waste % and profitability highlight which items need forecast tuning.
            </p>
          </div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Revenue</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toCurrency(report?.totals?.revenue ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Food Cost Ratio</p>
              <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {toPercent(report?.totals?.food_cost_ratio ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste Rate</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-warning">
                {toPercent(report?.totals?.waste_rate_pct ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Lost Revenue</p>
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
              Sales &amp; Waste Trends
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Daily Sales and Waste Signals
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[
              { label: "Revenue", color: "text-status-success", series: trendSeries.revenue },
              { label: "Waste Rate", color: "text-status-critical", series: trendSeries.wasteRate, suffix: "%" },
            ].map((chart) => {
              const points = buildSparklinePoints(chart.series, 520, 160);
              return (
                <div key={chart.label} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                    {chart.label} Trend
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
                                : toCurrency(chart.series[Math.max(0, chart.series.length - 6 + index)] ?? 0)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-text-muted">
                      Not enough historical data yet.
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
              Forecast Impact
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              ML Accuracy → Real Money Saved
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Forecast Accuracy
              </p>
              <p className="font-display text-3xl font-semibold text-brand-gold tracking-tight">
                {toPercent(report?.forecast_impact?.forecast_accuracy ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Waste Avoided
              </p>
              <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                {toCurrency(report?.forecast_impact?.waste_avoided ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {report?.forecast_impact?.stockouts_prevented === null
                  ? "Stockouts Detected"
                  : "Stockouts Prevented"}
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
              Top Waste Drivers
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Why Waste Happens
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
              Opportunity Insights
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Actionable Recommendations
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(report?.opportunity_insights ?? []).length ? (
              report?.opportunity_insights.map((insight) => (
                <article key={insight.item_id ?? insight.item_title} className="rounded-xl border border-surface-4 bg-surface-2 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {insight.item_title ?? "Item"}
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">
                    Waste rate: <span className="font-semibold text-status-critical">{toPercent(insight.waste_rate_pct)}</span>
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">{insight.suggested_action}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.14em] text-text-muted">
                    Potential savings
                  </p>
                  <p className="mt-1 text-lg font-semibold text-status-success">
                    {toCurrency(insight.potential_savings)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                No high-waste opportunities detected for this window yet.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "NETWORK" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Network Insight
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Cross-Branch Signals
            </h3>
          </div>
          {report?.network_insights?.available ? (
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-sm text-text-secondary">
                Average waste rate across network:{" "}
                <span className="font-semibold text-status-critical">
                  {toPercent(report.network_insights.avg_waste_rate_pct ?? 0)}
                </span>
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {(report.network_insights.top_waste_items ?? []).map((item) => (
                  <div key={item.item_id ?? item.item_title} className="rounded-lg border border-surface-4 bg-surface-3 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                      {item.item_title ?? "Item"}
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
                "Network insights are not available for this account yet."}
            </div>
          )}
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

export default function SalesWastePage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          Loading sales &amp; waste workspace…
        </div>
      }
    >
      <SalesWasteContent />
    </Suspense>
  );
}
