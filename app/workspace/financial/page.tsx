"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
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

type FinancialTab =
  | "OVERVIEW"
  | "WASTE"
  | "STOCKOUT"
  | "ACCURACY"
  | "PROFIT"
  | "BRANCHES"
  | "TRENDS";

type ProfitSort = "REVENUE" | "MARGIN";

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
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
    "\n",
  );
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
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const canAccess = [
    "ORG_OWNER",
    "OPS_DIRECTOR",
    "GM",
    "BRANCH_MANAGER",
  ].includes(role);

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<FinancialTab>("OVERVIEW");
  const [profitSort, setProfitSort] = useState<ProfitSort>("REVENUE");

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

  const sortedProfitability = useMemo(() => {
    const rows = [...itemProfitability];
    if (profitSort === "MARGIN") {
      rows.sort((a, b) => b.margin_pct - a.margin_pct || b.revenue - a.revenue);
    } else {
      rows.sort((a, b) => b.revenue - a.revenue);
    }
    return rows.slice(0, 6);
  }, [itemProfitability, profitSort]);

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
        header: t("common.branch"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {info.getValue()}
          </span>
        ),
      }),
      branchColumnHelper.accessor("revenue", {
        header: t("financial.summary.revenue"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("foodCost", {
        header: t("financial.summary.foodCost"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("wasteCost", {
        header: t("financial.summary.wasteCost"),
        cell: (info) => (
          <span className="text-sm font-semibold text-status-warning">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("grossMargin", {
        header: t("financial.summary.grossMargin"),
        cell: (info) => (
          <span className="text-sm font-semibold text-status-success">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("marginPct", {
        header: t("financial.summary.marginPct"),
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
    timeframe === "7d"
      ? t("financial.last7Days")
      : timeframe === "90d"
        ? t("financial.last90Days")
        : t("financial.last30Days");

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
      `financial-overview-${timeframe}.csv`,
      [
        "Branch",
        "Revenue",
        "FoodCost",
        "WasteCost",
        "GrossMargin",
        "MarginPct",
      ],
      rows,
    );
  };

  return (
    <WorkspaceShell
      eyebrow={t("financial.eyebrow")}
      title={t("financial.title")}
      description={t("financial.description")}
      insight={t("financial.insight")}
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Select
            label={t("financial.timeframe")}
            leadingIcon={<Calendar className="h-4 w-4" />}
            options={[
              { value: "7d", label: t("financial.last7Days") },
              { value: "30d", label: t("financial.last30Days") },
              { value: "90d", label: t("financial.last90Days") },
            ]}
            value={timeframe}
            onChange={setTimeframe}
          />

          <Select
            label={t("financial.branchFocus")}
            options={[
              { value: "ALL", label: t("financial.allBranches") },
              ...branchOptions,
            ]}
            value={branchFilter}
            onChange={setBranchFilter}
            disabled={financialData?.scope === "BRANCH"}
          />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("financial.dataRange")}
            </label>
            <div className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 flex items-center text-sm text-text-secondary">
              {financialData
                ? `${financialData.start_date} → ${financialData.end_date}`
                : "—"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("financial.quickExport")}
            </label>
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-button border border-border-default bg-surface-3 text-sm font-medium text-text-primary transition-all duration-200 hover:bg-surface-4 hover:border-brand-gold hover:text-brand-gold active:scale-[0.98]"
              disabled={branchRows.length === 0}
            >
              <Download className="h-4 w-4" />
              {t("financial.exportData")}
            </button>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-surface-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "OVERVIEW", label: t("financial.tabs.overview") },
              { id: "WASTE", label: t("financial.tabs.waste") },
              { id: "STOCKOUT", label: t("financial.tabs.stockout") },
              { id: "ACCURACY", label: t("financial.tabs.accuracy") },
              { id: "PROFIT", label: t("financial.tabs.profit") },
              { id: "BRANCHES", label: t("financial.tabs.branches") },
              { id: "TRENDS", label: t("financial.tabs.trends") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as FinancialTab)}
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
        <section className="mt-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("financial.impact.title")}
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            {timeframeLabel}
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-10">
          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              {t("financial.accuracy.currentAccuracy")}
            </p>
            <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
              {toPercent(impactReport?.accuracy_pct ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">{t("financial.impact.avgAccuracy")}</p>
          </article>
          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              {t("financial.accuracy.wastePrevented")}
            </p>
            <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
              {toCurrency(impactReport?.waste_reduced ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">{t("financial.impact.periodImprovement")}</p>
          </article>
          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              {t("financial.stockout.stockoutEvents")}
            </p>
            <p className="font-display text-3xl font-semibold text-text-primary tracking-tight">
              {impactReport?.stockouts_avoided ?? 0}
            </p>
            <p className="mt-3 text-xs text-text-muted">{t("financial.impact.eventsPrevented")}</p>
          </article>
          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              {t("financial.stockout.protectedByPrepiq")}
            </p>
            <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
              {toCurrency(impactReport?.revenue_protected ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">{t("financial.impact.estimatedImpact")}</p>
          </article>
        </div>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("financial.summary.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {timeframeLabel}
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {branchFilter === "ALL" || !financialData?.branch_name
                ? t("financial.organizationWide")
                : t("financial.branchView", { name: financialData.branch_name })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.summary.revenue")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                {toCurrency(summary?.revenue ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {t("financial.summary.vsPrior", { sign: (summary?.revenue_delta_pct ?? 0) >= 0 ? "+" : "", value: Math.abs(summary?.revenue_delta_pct ?? 0).toFixed(1), suffix: "%" })}
              </p>
            </article>

            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.summary.foodCost")}
              </p>
              <p className="font-display text-3xl font-semibold text-text-primary tracking-tight">
                {toCurrency(summary?.food_cost ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {t("financial.summary.vsPrior", { sign: (summary?.food_cost_delta_pct ?? 0) >= 0 ? "+" : "", value: Math.abs(summary?.food_cost_delta_pct ?? 0).toFixed(1), suffix: "%" })}
              </p>
            </article>

            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.summary.wasteCost")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                {toCurrency(summary?.waste_cost ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {t("financial.summary.vsPrior", { sign: (summary?.waste_cost_delta_pct ?? 0) >= 0 ? "+" : "", value: Math.abs(summary?.waste_cost_delta_pct ?? 0).toFixed(1), suffix: "%" })}
              </p>
            </article>

            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.summary.grossMargin")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                {toCurrency(summary?.gross_margin ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {t("financial.summary.vsPrior", { sign: (summary?.gross_margin_delta_pct ?? 0) >= 0 ? "+" : "", value: Math.abs(summary?.gross_margin_delta_pct ?? 0).toFixed(1), suffix: "%" })}
              </p>
            </article>

            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.summary.marginPct")}
              </p>
              <p className="font-display text-3xl font-semibold text-brand-gold tracking-tight">
                {toPercent(summary?.margin_pct ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {summary?.margin_pct_delta != null
                  ? t("financial.summary.vsPrior", { sign: (summary.margin_pct_delta) >= 0 ? "+" : "", value: Math.abs(summary.margin_pct_delta).toFixed(1), suffix: " pp" })
                  : "—"}
              </p>
            </article>
        </div>
        </section>
      ) : null}

      {activeTab === "WASTE" ? (
        <section className="mt-10">
          <div>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("financial.waste.title")}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {timeframeLabel}
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("financial.waste.totalWaste")}
                </p>
                <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                  {toCurrency(wasteAnalysis?.total_waste_cost ?? 0)}
                </p>
                <p className="mt-3 text-xs text-text-muted">
                  {t("financial.summary.vsPrior", { sign: (summary?.waste_cost_delta_pct ?? 0) >= 0 ? "+" : "", value: Math.abs(summary?.waste_cost_delta_pct ?? 0).toFixed(1), suffix: "%" })}
                </p>
              </article>

              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("financial.waste.wasteRate")}
                </p>
                <p className="font-display text-3xl font-semibold text-brand-gold tracking-tight">
                  {toPercent(wasteAnalysis?.waste_rate_pct ?? 0)}
                </p>
                <p className="mt-3 text-xs text-text-muted">{t("financial.waste.shareOfRevenue")}</p>
              </article>
            </div>

            <div className="mt-6 bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-4">
                {t("financial.waste.topItems")}
              </p>
              <div className="space-y-3">
                {(wasteAnalysis?.top_items ?? []).length ? (
                  wasteAnalysis?.top_items.map((item) => (
                    <Link
                      key={item.item_id}
                      href={`/workspace/sales-waste?item=${item.item_id}${
                        financialData?.branch_id
                          ? `&branch=${financialData.branch_id}`
                          : ""
                      }${financialData?.end_date ? `&date=${financialData.end_date}` : ""}`}
                      className="flex items-center justify-between rounded-lg border border-surface-4 bg-surface-3/40 px-4 py-3 transition-colors hover:border-brand-gold/50 hover:bg-surface-3"
                    >
                      <span className="text-sm font-medium text-text-secondary">
                        {item.item_title}
                      </span>
                      <span className="text-sm font-semibold text-status-warning">
                        {toCurrency(item.waste_cost)}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">
                    {t("financial.waste.noEvents")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "STOCKOUT" ? (
        <section className="mt-10">
          <div>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("financial.stockout.title")}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {timeframeLabel}
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("financial.stockout.lostRevenue")}
                </p>
                <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
                  {toCurrency(stockoutImpact?.lost_revenue ?? 0)}
                </p>
                <p className="mt-3 text-xs text-text-muted">
                  {t("financial.summary.vsPrior", { sign: (stockoutImpact?.lost_revenue_delta_pct ?? 0) >= 0 ? "+" : "", value: Math.abs(stockoutImpact?.lost_revenue_delta_pct ?? 0).toFixed(1), suffix: "%" })}
                </p>
              </article>

              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("financial.stockout.stockoutEvents")}
                </p>
                <p className="font-display text-3xl font-semibold text-text-primary tracking-tight">
                  {stockoutImpact?.stockout_events ?? 0}
                </p>
                <p className="mt-3 text-xs text-text-muted">
                  {t("financial.stockout.serviceInterruptions")}
                </p>
              </article>

              <article className="bg-surface-2 rounded-xl p-6 border border-surface-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {t("financial.stockout.protectedByPrepiq")}
                </p>
                <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                  {toCurrency(stockoutImpact?.revenue_protected ?? 0)}
                </p>
                <p className="mt-3 text-xs text-text-muted">
                  {t("financial.summary.vsPrior", { sign: (stockoutImpact?.revenue_protected_delta_pct ?? 0) >= 0 ? "+" : "", value: Math.abs(stockoutImpact?.revenue_protected_delta_pct ?? 0).toFixed(1), suffix: "%" })}
                </p>
              </article>
            </div>

            <div className="mt-6 bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-4">
                {t("financial.stockout.topStockouts")}
              </p>
              <div className="space-y-3">
                {(stockoutImpact?.top_items ?? []).length ? (
                  stockoutImpact?.top_items.map((item) => (
                    <div
                      key={item.item_id}
                      className="flex items-center justify-between rounded-lg border border-surface-4 bg-surface-3/40 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-text-secondary">
                        {item.item_title}
                      </span>
                      <span className="text-sm font-semibold text-status-critical">
                        {toCurrency(item.lost_revenue)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">
                    {t("financial.stockout.noStockouts")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "ACCURACY" ? (
        <section className="mt-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("financial.accuracy.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {timeframeLabel}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.accuracy.currentAccuracy")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                {toPercent(forecastImpact?.accuracy_pct ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {t("financial.impact.avgAccuracy")}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.accuracy.wastePrevented")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                {toCurrency(forecastImpact?.waste_prevented ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {t("financial.accuracy.improvementVsPrior")}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                {t("financial.accuracy.stockoutsAvoided")}
              </p>
              <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                {toCurrency(forecastImpact?.stockouts_avoided ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">
                {t("financial.accuracy.avoidedLostRevenue")}
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "PROFIT" ? (
        <section className="mt-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("financial.profit.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("financial.profit.driversTitle")}
            </h3>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { id: "REVENUE", label: t("financial.profit.topRevenue") },
              { id: "MARGIN", label: t("financial.profit.topMarginPct") },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setProfitSort(option.id as ProfitSort)}
                className={`inline-flex h-9 items-center px-3 rounded-lg text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-200 ${
                  profitSort === option.id
                    ? "bg-brand-gold/20 text-brand-gold border border-brand-gold/40 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.today.closed.itemHeader")}
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("financial.summary.revenue")}
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("financial.summary.foodCost")}
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("financial.summary.grossMargin")}
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("financial.summary.marginPct")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4">
                  {sortedProfitability.length ? (
                    sortedProfitability.map((row) => (
                      <tr
                        key={row.item_id}
                        className="transition-all duration-200 hover:bg-surface-3/50"
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-text-primary">
                          {row.item_title}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary">
                          {toCurrency(row.revenue)}
                        </td>
                        <td className="px-6 py-4 text-sm text-text-secondary">
                          {toCurrency(row.food_cost)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-status-success">
                          {toCurrency(row.gross_margin)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-brand-gold">
                          {toPercent(row.margin_pct)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-6 text-sm text-text-muted"
                      >
                        {t("financial.profit.noData")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "BRANCHES" ? (
        <section className="mt-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
            {topBranches.map((branch) => (
              <article
                key={branch.id}
                className="bg-surface-2 rounded-xl p-6 border border-surface-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                  {branch.branch}
                </p>
                <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
                  {toCurrency(branch.revenue)}
                </p>
                <p className="mt-3 text-xs text-text-muted">
                  {t("financial.summary.marginPct")} {toPercent(branch.marginPct)}
                </p>
              </article>
            ))}
          </div>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("financial.branches.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("financial.branches.breakdownTitle")}
            </h3>
          </div>

          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <NativeTable
                table={branchTable}
                tableClassName="w-full min-w-[860px]"
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
        <section className="mt-10">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("financial.trends.title")}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {t("financial.trends.breakdownTitle")}
              </h3>
            </div>
            <button
              type="button"
              onClick={exportTrendCsv}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-3 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-text-primary transition-all duration-200 hover:bg-surface-4 hover:border-brand-gold hover:text-brand-gold active:scale-[0.98]"
              disabled={!costTrends.length}
            >
              <Download className="h-4 w-4" />
              {t("financial.trends.downloadCsv")}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[
              {
                label: t("financial.summary.revenue"),
                color: "text-status-success",
                series: trendSeries.revenue,
              },
              {
                label: t("financial.summary.foodCost"),
                color: "text-text-secondary",
                series: trendSeries.food,
              },
              {
                label: t("financial.summary.wasteCost"),
                color: "text-status-critical",
                series: trendSeries.waste,
              },
              {
                label: t("financial.summary.grossMargin"), // Using grossMargin for Margin
                color: "text-brand-gold",
                series: trendSeries.margin,
              },
            ].map((chart) => {
              const points = buildSparklinePoints(chart.series, 520, 160);
              return (
                <div
                  key={chart.label}
                  className="rounded-xl border border-surface-4 bg-surface-2 p-5"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                    {t("financial.trends.trendLabel", { label: chart.label })}
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
                                chart.series[
                                  Math.max(0, chart.series.length - 6 + index)
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
    </WorkspaceShell>
  );
}
