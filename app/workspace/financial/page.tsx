"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  NativeTable,
  useReactTable,
} from "@/components/ui/native-table";
import Link from "next/link";
import { Calendar, Download } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useOrganizationFinancialOverview,
} from "@/services";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { PlanGateState } from "@/components/dashboard/plan-gate-state";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();
const branchColumnHelper = createColumnHelper<FinancialBranchRow>();

type FinancialBranchRow = {
  id: string;
  branch: string;
  revenue: number;
  foodCost: number;
  wasteCost: number;
  grossMargin: number;
  marginPct: number;
  revenueDeltaPct?: number | null;
  foodCostDeltaPct?: number | null;
  wasteCostDeltaPct?: number | null;
  grossMarginDeltaPct?: number | null;
  marginPctDelta?: number | null;
};

type FinancialTab = "OVERVIEW" | "BRANCHES" | "ACCURACY" | "TRENDS";

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDelta(value?: number | null, suffix = "%") {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix} vs prior`;
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

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function FinancialPage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const activeBranchId = branchFilter && branchFilter !== "ALL" ? branchFilter : undefined;
  const { tier, planType, isLoading: tierLoading, shouldBlockAccess, gateVariant } = useSubscriptionTier(activeBranchId);
  const [activeTab, setActiveTab] = useState<FinancialTab>("OVERVIEW");

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const financialQuery = useOrganizationFinancialOverview(
    user?.organization_id ?? "",
    {
      timeframe: timeframe as "7d" | "30d" | "90d",
      branch_id: branchFilter !== "ALL" ? branchFilter : undefined,
    },
    canAccess && Boolean(user?.organization_id),
  );

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const financialData = financialQuery.data;

  useEffect(() => {
    if (financialData?.scope === "BRANCH" && financialData.branch_id) {
      setBranchFilter(financialData.branch_id);
    }
  }, [financialData?.scope, financialData?.branch_id]);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const branchOptions = useMemo(() => {
    if (financialData?.scope === "BRANCH") {
      return financialData.branches.map((branch) => ({
        value: branch.branch_id,
        label: branch.branch_name,
      }));
    }
    if (branches.length) {
      return branches.map((branch) => ({
        value: branch.id,
        label: branch.name,
      }));
    }
    return (
      financialData?.branches.map((branch) => ({
        value: branch.branch_id,
        label: branch.branch_name,
      })) ?? []
    );
  }, [branches, financialData]);

  const summary = financialData?.summary;
  const wasteAnalysis = financialData?.waste_analysis;
  const stockoutImpact = financialData?.stockout_impact;
  const forecastImpact = financialData?.forecast_accuracy_impact;
  const impactReport = financialData?.impact_report;
  const itemProfitability = financialData?.item_profitability ?? [];
  const costTrends = financialData?.cost_trends ?? [];

  const trendSeries = useMemo(() => {
    return {
      revenue: costTrends.map((row) => row.revenue),
      waste: costTrends.map((row) => row.waste_cost),
      food: costTrends.map((row) => row.food_cost),
      margin: costTrends.map((row) => row.margin),
      labels: costTrends.map((row) => row.date.slice(5)),
    };
  }, [costTrends]);

  const branchRows = useMemo<FinancialBranchRow[]>(() => {
    return (financialData?.branches ?? []).map((branch) => ({
      id: branch.branch_id,
      branch: branch.branch_name,
      revenue: branch.revenue,
      foodCost: branch.food_cost,
      wasteCost: branch.waste_cost,
      grossMargin: branch.gross_margin,
      marginPct: branch.margin_pct,
      revenueDeltaPct: branch.revenue_delta_pct,
      foodCostDeltaPct: branch.food_cost_delta_pct,
      wasteCostDeltaPct: branch.waste_cost_delta_pct,
      grossMarginDeltaPct: branch.gross_margin_delta_pct,
      marginPctDelta: branch.margin_pct_delta,
    }));
  }, [financialData]);

  const topBranches = useMemo(() => {
    return [...branchRows].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  }, [branchRows]);

  const topProfitItems = useMemo(() => {
    return [...itemProfitability].sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  }, [itemProfitability]);

  const exportTrendCsv = () => {
    const rows = costTrends.map((row) => [
      row.date,
      row.revenue.toFixed(2),
      row.food_cost.toFixed(2),
      row.waste_cost.toFixed(2),
      row.margin.toFixed(2),
    ]);
    downloadCsv(
      `financial-trends-${timeframe}.csv`,
      ["Date", "Revenue", "FoodCost", "WasteCost", "Margin"],
      rows,
    );
  };

  const branchColumns = useMemo(
    () => [
      branchColumnHelper.accessor("branch", {
        header: "Branch",
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {info.getValue()}
          </span>
        ),
      }),
      branchColumnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("foodCost", {
        header: "Food Cost",
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("wasteCost", {
        header: "Waste Cost",
        cell: (info) => (
          <span className="text-sm font-semibold text-status-warning">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("grossMargin", {
        header: "Gross Margin",
        cell: (info) => (
          <span className="text-sm font-semibold text-status-success">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("marginPct", {
        header: "Margin %",
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {toPercent(info.getValue())}
          </span>
        ),
      }),
    ],
    [],
  );

  const branchTable = useReactTable({
    data: branchRows,
    columns: branchColumns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  const timeframeLabel =
    timeframe === "7d" ? "Last 7 days" : timeframe === "90d" ? "Last 90 days" : "Last 30 days";

  const exportReport = () => {
    const rows = branchRows.map((row) => [
      row.branch,
      row.revenue.toFixed(2),
      row.foodCost.toFixed(2),
      row.wasteCost.toFixed(2),
      row.grossMargin.toFixed(2),
      row.marginPct.toFixed(2),
    ]);
    downloadCsv(
      `financials-${timeframe}.csv`,
      ["Branch", "Revenue", "FoodCost", "WasteCost", "GrossMargin", "MarginPct"],
      rows,
    );
  };

  return (
    <WorkspaceShell
      eyebrow="Executive"
      title="Financials"
      description="Revenue, margins, and waste cost — your business in one view."
      insight=""
    >
      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="min-w-45">
          <Select
            label="Timeframe"
            leadingIcon={<Calendar className="h-4 w-4" />}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
            ]}
            value={timeframe}
            onChange={setTimeframe}
          />
        </div>
        <div className="min-w-45">
          <Select
            label="Branch"
            options={[
              { value: "ALL", label: "All branches" },
              ...branchOptions,
            ]}
            value={branchFilter}
            onChange={setBranchFilter}
            disabled={financialData?.scope === "BRANCH"}
          />
        </div>
        {financialData ? (
          <p className="pb-3 text-xs text-text-muted">
            {financialData.start_date} → {financialData.end_date}
            {financialData.branch_name ? ` · ${financialData.branch_name}` : ""}
          </p>
        ) : null}
        <button
          type="button"
          onClick={exportReport}
          disabled={branchRows.length === 0}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-surface-4 bg-surface-3 px-4 text-xs font-semibold text-text-primary transition-all hover:border-brand-gold hover:text-brand-gold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {activeBranchId && !tierLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : !tierLoading && tier < 2 ? (
        <PlanGateState requiredTier="INTELLIGENCE" currentPlanType={planType} />
      ) : (
        <>
      {/* KPI strip */}
      {financialData ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-status-success">
              {toCurrency(summary?.revenue ?? 0)}
            </span>{" "}
            revenue
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-status-success">
              {toCurrency(summary?.gross_margin ?? 0)}
            </span>{" "}
            gross margin
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-brand-gold">
              {toPercent(summary?.margin_pct ?? 0)}
            </span>{" "}
            margin
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-status-critical">
              {toCurrency(summary?.waste_cost ?? 0)}
            </span>{" "}
            wasted
          </span>
        </div>
      ) : null}

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-surface-4/60">
        {(
          [
            { id: "OVERVIEW", label: "Overview" },
            { id: "BRANCHES", label: "Branches" },
            { id: "ACCURACY", label: "Forecast Impact" },
            { id: "TRENDS", label: "Trends" },
          ] as { id: FinancialTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-10 items-center px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "OVERVIEW" ? (
        <div className="space-y-8">
          {/* Hero: the two numbers managers care about most */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Revenue · {branchFilter === "ALL" || !financialData?.branch_name ? "all branches" : financialData.branch_name}
              </p>
              <p className="mt-3 font-display text-4xl font-semibold text-status-success tracking-tight">
                {toCurrency(summary?.revenue ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">{formatDelta(summary?.revenue_delta_pct)}</p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Gross margin</p>
              <p className="mt-3 font-display text-4xl font-semibold text-brand-gold tracking-tight">
                {toPercent(summary?.margin_pct ?? 0)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {toCurrency(summary?.gross_margin ?? 0)} gross
              </p>
              <p className="mt-2 text-xs text-text-muted">
                {summary?.margin_pct_delta != null
                  ? `${summary.margin_pct_delta >= 0 ? "+" : ""}${summary.margin_pct_delta.toFixed(1)} pp vs prior`
                  : "—"}
              </p>
            </article>
          </div>

          {/* Supporting P&L — compact inline, no cards */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-surface-4/60 pb-6 text-sm">
            <span className="text-text-muted">
              Food cost{" "}
              <span className="font-semibold text-text-primary">
                {toCurrency(summary?.food_cost ?? 0)}
              </span>
              <span className="ml-1.5 text-text-muted/70 text-xs">
                {formatDelta(summary?.food_cost_delta_pct)}
              </span>
            </span>
            <span className="text-text-muted">
              Waste{" "}
              <span className="font-semibold text-status-critical">
                {toCurrency(summary?.waste_cost ?? 0)}
              </span>
              <span className="ml-1.5 text-text-muted/70 text-xs">
                {formatDelta(summary?.waste_cost_delta_pct)}
              </span>
            </span>
            <span className="text-text-muted">
              Gross margin{" "}
              <span className="font-semibold text-status-success">
                {toCurrency(summary?.gross_margin ?? 0)}
              </span>
              <span className="ml-1.5 text-text-muted/70 text-xs">
                {formatDelta(summary?.gross_margin_delta_pct)}
              </span>
            </span>
          </div>

          {/* PrepIQ impact + stockout losses — inline, scannable */}
          <div className="rounded-xl border border-surface-4/60 bg-surface-2 px-5 py-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
              What PrepIQ delivered · {timeframeLabel}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="text-text-muted">
                <span className="font-semibold text-status-success">
                  {toPercent(impactReport?.accuracy_pct ?? 0)}
                </span>{" "}
                forecast accuracy
              </span>
              <span className="text-text-muted">
                <span className="font-semibold text-status-success">
                  {toCurrency(impactReport?.waste_reduced ?? 0)}
                </span>{" "}
                waste reduced
              </span>
              <span className="text-text-muted">
                <span className="font-semibold text-text-primary">
                  {impactReport?.stockouts_avoided ?? 0}
                </span>{" "}
                stockouts avoided
              </span>
              <span className="text-text-muted">
                <span className="font-semibold text-status-success">
                  {toCurrency(impactReport?.revenue_protected ?? 0)}
                </span>{" "}
                revenue protected
              </span>
            </div>
            {(stockoutImpact?.lost_revenue ?? 0) > 0 || (stockoutImpact?.stockout_events ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-surface-4/50 pt-3 text-sm">
                <span className="text-text-muted">
                  <span className="font-semibold text-status-critical">
                    {toCurrency(stockoutImpact?.lost_revenue ?? 0)}
                  </span>{" "}
                  lost to stockouts
                </span>
                <span className="text-text-muted">
                  <span className="font-semibold text-text-primary">
                    {stockoutImpact?.stockout_events ?? 0}
                  </span>{" "}
                  stockout events
                </span>
              </div>
            ) : null}
          </div>

          {/* Biggest waste + best performers */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Biggest waste sources
                </p>
                <Link
                  href={`/workspace/sales-waste${financialData?.branch_id ? `?branch=${financialData.branch_id}` : ""}`}
                  className="text-xs text-text-muted transition-colors hover:text-brand-gold"
                >
                  See all items →
                </Link>
              </div>
              <div className="space-y-2">
                {(wasteAnalysis?.top_items ?? []).slice(0, 3).length ? (
                  (wasteAnalysis?.top_items ?? []).slice(0, 3).map((item) => (
                    <div
                      key={item.item_id}
                      className="flex items-center justify-between rounded-lg border border-surface-4/60 bg-surface-3/40 px-4 py-2.5"
                    >
                      <span className="text-sm text-text-secondary">{item.item_title}</span>
                      <span className="text-sm font-semibold text-status-warning">
                        {toCurrency(item.waste_cost)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">No waste events recorded.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Best performers
              </p>
              <div className="space-y-2">
                {topProfitItems.length ? (
                  topProfitItems.map((row) => (
                    <div
                      key={row.item_id}
                      className="flex items-center justify-between rounded-lg border border-surface-4/60 bg-surface-3/40 px-4 py-2.5"
                    >
                      <span className="text-sm text-text-secondary">{row.item_title}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-text-muted">{toCurrency(row.revenue)}</span>
                        <span className="text-xs font-semibold text-brand-gold">
                          {toPercent(row.margin_pct)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">No profitability data yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "BRANCHES" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {topBranches.map((branch) => (
              <article key={branch.id} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {branch.branch}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                  {toCurrency(branch.revenue)}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  {toPercent(branch.marginPct)} margin
                </p>
              </article>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              All branches
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              How your locations compare
            </h3>
          </div>

          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
            <div className="overflow-x-auto">
              <NativeTable
                table={branchTable}
                tableClassName="w-full min-w-[860px]"
                headerClassName="border-b border-surface-4/80 bg-surface-3/40"
                bodyClassName="divide-y divide-surface-4/50"
                headerCellClassName="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="align-middle transition-colors hover:bg-surface-3/20"
                cellClassName="px-4 py-3"
              />
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "ACCURACY" ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Forecast accuracy
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              How well PrepIQ predicted demand
            </h3>
            <p className="mt-1 text-sm text-text-secondary">{timeframeLabel}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Accuracy</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toPercent(forecastImpact?.accuracy_pct ?? 0)}
              </p>
              <p className="mt-2 text-xs text-text-muted">How often we got it right</p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste prevented</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toCurrency(forecastImpact?.waste_prevented ?? 0)}
              </p>
              <p className="mt-2 text-xs text-text-muted">Compared to prior period</p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Stockout revenue saved</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toCurrency(forecastImpact?.stockouts_avoided ?? 0)}
              </p>
              <p className="mt-2 text-xs text-text-muted">Revenue you didn&apos;t lose</p>
            </article>
          </div>
        </div>
      ) : null}

      {activeTab === "TRENDS" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Cost trends
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
                How your numbers have moved
              </h3>
              <p className="mt-1 text-sm text-text-secondary">{timeframeLabel}</p>
            </div>
            <button
              type="button"
              onClick={exportTrendCsv}
              disabled={!costTrends.length}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-semibold text-text-primary transition-all hover:border-brand-gold hover:text-brand-gold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { label: "Revenue", color: "text-status-success", series: trendSeries.revenue },
              { label: "Food cost", color: "text-text-secondary", series: trendSeries.food },
              { label: "Waste cost", color: "text-status-critical", series: trendSeries.waste },
              { label: "Margin", color: "text-brand-gold", series: trendSeries.margin },
            ].map((chart) => {
              const points = buildSparklinePoints(chart.series, 520, 160);
              return (
                <div key={chart.label} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
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
                              {toCurrency(
                                chart.series[Math.max(0, chart.series.length - 6 + index)] ?? 0,
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-text-muted">Not enough data yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
        </>
      )}
    </WorkspaceShell>
  );
}
