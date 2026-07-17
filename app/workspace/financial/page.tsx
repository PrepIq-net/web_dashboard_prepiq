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
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { useTranslation } from "@/lib/i18n";
import { formatMoney, formatCurrencyBreakdown } from "@/lib/format";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();
const branchColumnHelper = createColumnHelper<FinancialBranchRow>();

type FinancialBranchRow = {
  id: string;
  branch: string;
  currency: string;
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
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");
  const activeBranchId = branchFilter && branchFilter !== "ALL" ? branchFilter : undefined;
  const { tier, planType, isLoading: tierLoading, shouldBlockAccess, gateVariant } = useSubscriptionTier(activeBranchId);
  const [activeTab, setActiveTab] = useState<FinancialTab>("OVERVIEW");

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const financialQuery = useOrganizationFinancialOverview(
    user?.organization_id ?? "",
    {
      timeframe: timeframe as "7d" | "30d" | "90d",
      branch_id: branchFilter !== "ALL" ? branchFilter : undefined,
      // A branch is already single-currency; the currency scope only applies
      // to the org-wide view.
      currency:
        branchFilter === "ALL" && currencyFilter !== "ALL"
          ? currencyFilter
          : undefined,
    },
    canAccess && Boolean(user?.organization_id),
  );

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
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

  // Every branch operates in its own currency: single-branch / single-currency
  // scopes render local money, mixed org-wide scopes are USD-normalized by the
  // backend and flagged via is_multi_currency.
  const displayCurrency = financialData?.summary?.currency ?? "USD";
  const isMultiCurrency = Boolean(financialData?.summary?.is_multi_currency);
  const byCurrency = financialData?.summary?.by_currency ?? [];
  const money = (value: number) => formatMoney(value, displayCurrency);

  const orgCurrencies = useMemo(() => {
    const codes = new Set<string>();
    for (const branch of branchesQuery.data ?? []) {
      codes.add((branch.currency ?? "USD").toUpperCase());
    }
    for (const code of financialData?.currencies ?? []) codes.add(code.toUpperCase());
    return [...codes].sort();
  }, [branchesQuery.data, financialData?.currencies]);

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
      currency: (branch.currency ?? "USD").toUpperCase(),
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
      [
        t("workspace.financial.csv.date"),
        t("workspace.financial.csv.revenue"),
        t("workspace.financial.csv.foodCost"),
        t("workspace.financial.csv.wasteCost"),
        t("workspace.financial.csv.margin"),
      ],
      rows,
    );
  };

  const branchColumns = useMemo(
    () => [
      branchColumnHelper.accessor("branch", {
        header: t("workspace.financial.branchTable.branch"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {info.getValue()}
          </span>
        ),
      }),
      branchColumnHelper.accessor("revenue", {
        header: t("workspace.financial.branchTable.revenue"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {formatMoney(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      branchColumnHelper.accessor("foodCost", {
        header: t("workspace.financial.branchTable.foodCost"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {formatMoney(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      branchColumnHelper.accessor("wasteCost", {
        header: t("workspace.financial.branchTable.wasteCost"),
        cell: (info) => (
          <span className="text-sm font-semibold text-status-warning">
            {formatMoney(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      branchColumnHelper.accessor("grossMargin", {
        header: t("workspace.financial.branchTable.grossMargin"),
        cell: (info) => (
          <span className="text-sm font-semibold text-status-success">
            {formatMoney(info.getValue(), info.row.original.currency)}
          </span>
        ),
      }),
      branchColumnHelper.accessor("marginPct", {
        header: t("workspace.financial.branchTable.marginPct"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {toPercent(info.getValue())}
          </span>
        ),
      }),
    ],
    [t],
  );

  const branchTable = useReactTable({
    data: branchRows,
    columns: branchColumns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  const timeframeLabel =
    timeframe === "7d"
      ? t("workspace.financial.timeframe.7d")
      : timeframe === "90d"
        ? t("workspace.financial.timeframe.90d")
        : t("workspace.financial.timeframe.30d");

  const exportReport = () => {
    const rows = branchRows.map((row) => [
      row.branch,
      row.currency,
      row.revenue.toFixed(2),
      row.foodCost.toFixed(2),
      row.wasteCost.toFixed(2),
      row.grossMargin.toFixed(2),
      row.marginPct.toFixed(2),
    ]);
    downloadCsv(
      `financials-${timeframe}.csv`,
      [
        t("workspace.financial.csv.branch"),
        t("workspace.financial.csv.currency"),
        t("workspace.financial.csv.revenue"),
        t("workspace.financial.csv.foodCost"),
        t("workspace.financial.csv.wasteCost"),
        t("workspace.financial.csv.grossMargin"),
        t("workspace.financial.csv.marginPct"),
      ],
      rows,
    );
  };

  return (
    <WorkspaceShell
      eyebrow={t("workspace.financial.eyebrow")}
      title={t("workspace.financial.title")}
      description={t("workspace.financial.description")}
      insight=""
    >
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="min-w-45">
          <Select
            label={t("workspace.financial.filter.timeframe")}
            leadingIcon={<Calendar className="h-4 w-4" />}
            options={[
              { value: "7d", label: t("workspace.financial.timeframe.7d") },
              { value: "30d", label: t("workspace.financial.timeframe.30d") },
              { value: "90d", label: t("workspace.financial.timeframe.90d") },
            ]}
            value={timeframe}
            onChange={setTimeframe}
          />
        </div>
        <div className="min-w-45">
          <Select
            label={t("workspace.financial.filter.branch")}
            options={[
              { value: "ALL", label: t("workspace.financial.filter.allBranches") },
              ...branchOptions,
            ]}
            value={branchFilter}
            onChange={setBranchFilter}
            disabled={financialData?.scope === "BRANCH"}
          />
        </div>
        {orgCurrencies.length > 1 ? (
          <div className="min-w-45">
            <Select
              label={t("workspace.financial.filter.currency")}
              options={[
                { value: "ALL", label: t("workspace.financial.filter.allCurrencies") },
                ...orgCurrencies.map((code) => ({ value: code, label: code })),
              ]}
              value={branchFilter === "ALL" ? currencyFilter : "ALL"}
              onChange={setCurrencyFilter}
              disabled={branchFilter !== "ALL"}
            />
          </div>
        ) : null}
        {financialData ? (
          <p className="pb-3 text-xs text-text-muted">
            {financialData.start_date} → {financialData.end_date}
            {financialData.branch_name ? ` · ${financialData.branch_name}` : ""}
            {financialData.currency_filter ? ` · ${financialData.currency_filter}` : ""}
          </p>
        ) : null}
        <button
          type="button"
          onClick={exportReport}
          disabled={branchRows.length === 0}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg border border-surface-4 bg-surface-3 px-4 text-xs font-semibold text-text-primary transition-all hover:border-brand-gold hover:text-brand-gold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {t("workspace.financial.export")}
        </button>
      </div>

      {activeBranchId && !tierLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : !tierLoading && tier < 2 ? (
        <SubscriptionRequiredState variant="intelligence_required" currentPlanType={planType} compact />
      ) : (
        <>
      {financialData ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-status-success">
              {money(summary?.revenue ?? 0)}
            </span>{" "}
            {t("workspace.financial.kpi.revenue")}
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-status-success">
              {money(summary?.gross_margin ?? 0)}
            </span>{" "}
            {t("workspace.financial.kpi.grossMargin")}
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-brand-gold">
              {toPercent(summary?.margin_pct ?? 0)}
            </span>{" "}
            {t("workspace.financial.kpi.margin")}
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-status-critical">
              {money(summary?.waste_cost ?? 0)}
            </span>{" "}
            {t("workspace.financial.kpi.wasted")}
          </span>
        </div>
      ) : null}

      {isMultiCurrency ? (
        <div className="mb-6 rounded-lg border border-brand-gold/25 bg-brand-gold/5 px-4 py-3 text-xs text-text-secondary">
          <p className="font-semibold text-brand-gold">
            {t("workspace.financial.multiCurrency.note")}
          </p>
          {byCurrency.length ? (
            <p className="mt-1">
              {t("workspace.financial.multiCurrency.revenueBreakdown")}{" "}
              <span className="font-semibold text-text-primary">
                {formatCurrencyBreakdown(
                  byCurrency.map((row) => ({ currency: row.currency, amount: row.revenue })),
                )}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-6 flex gap-1 border-b border-surface-4/60">
        {(
          [
            { id: "OVERVIEW", label: t("workspace.financial.tab.overview") },
            { id: "BRANCHES", label: t("workspace.financial.tab.branches") },
            { id: "ACCURACY", label: t("workspace.financial.tab.forecastImpact") },
            { id: "TRENDS", label: t("workspace.financial.tab.trends") },
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.financial.overview.revenueLabel", {
                  branch: branchFilter === "ALL" || !financialData?.branch_name
                    ? t("workspace.financial.overview.allBranches")
                    : financialData.branch_name
                })}
              </p>
              <p className="mt-3 font-display text-4xl font-semibold text-status-success tracking-tight">
                {money(summary?.revenue ?? 0)}
              </p>
              <p className="mt-3 text-xs text-text-muted">{formatDelta(summary?.revenue_delta_pct)}</p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.financial.overview.grossMargin")}</p>
              <p className="mt-3 font-display text-4xl font-semibold text-brand-gold tracking-tight">
                {toPercent(summary?.margin_pct ?? 0)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {money(summary?.gross_margin ?? 0)} {t("workspace.financial.overview.gross")}
              </p>
              <p className="mt-2 text-xs text-text-muted">
                {summary?.margin_pct_delta != null
                  ? `${summary.margin_pct_delta >= 0 ? "+" : ""}${summary.margin_pct_delta.toFixed(1)} pp vs prior`
                  : "—"}
              </p>
            </article>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-surface-4/60 pb-6 text-sm">
            <span className="text-text-muted">
              {t("workspace.financial.overview.foodCost")}{" "}
              <span className="font-semibold text-text-primary">
                {money(summary?.food_cost ?? 0)}
              </span>
              <span className="ml-1.5 text-text-muted/70 text-xs">
                {formatDelta(summary?.food_cost_delta_pct)}
              </span>
            </span>
            <span className="text-text-muted">
              {t("workspace.financial.overview.waste")}{" "}
              <span className="font-semibold text-status-critical">
                {money(summary?.waste_cost ?? 0)}
              </span>
              <span className="ml-1.5 text-text-muted/70 text-xs">
                {formatDelta(summary?.waste_cost_delta_pct)}
              </span>
            </span>
            <span className="text-text-muted">
              {t("workspace.financial.overview.grossMarginLabel")}{" "}
              <span className="font-semibold text-status-success">
                {money(summary?.gross_margin ?? 0)}
              </span>
              <span className="ml-1.5 text-text-muted/70 text-xs">
                {formatDelta(summary?.gross_margin_delta_pct)}
              </span>
            </span>
          </div>

          <div className="rounded-xl border border-surface-4/60 bg-surface-2 px-5 py-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.financial.overview.prepIqImpact", { timeframe: timeframeLabel })}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="text-text-muted">
                <span className="font-semibold text-status-success">
                  {toPercent(impactReport?.accuracy_pct ?? 0)}
                </span>{" "}
                {t("workspace.financial.overview.forecastAccuracy")}
              </span>
              <span className="text-text-muted">
                <span className="font-semibold text-status-success">
                  {money(impactReport?.waste_reduced ?? 0)}
                </span>{" "}
                {t("workspace.financial.overview.wasteReduced")}
              </span>
              <span className="text-text-muted">
                <span className="font-semibold text-text-primary">
                  {impactReport?.stockouts_avoided ?? 0}
                </span>{" "}
                {t("workspace.financial.overview.stockoutsAvoided")}
              </span>
              <span className="text-text-muted">
                <span className="font-semibold text-status-success">
                  {money(impactReport?.revenue_protected ?? 0)}
                </span>{" "}
                {t("workspace.financial.overview.revenueProtected")}
              </span>
            </div>
            {(stockoutImpact?.lost_revenue ?? 0) > 0 || (stockoutImpact?.stockout_events ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-surface-4/50 pt-3 text-sm">
                <span className="text-text-muted">
                  <span className="font-semibold text-status-critical">
                    {money(stockoutImpact?.lost_revenue ?? 0)}
                  </span>{" "}
                  {t("workspace.financial.overview.lostToStockouts")}
                </span>
                <span className="text-text-muted">
                  <span className="font-semibold text-text-primary">
                    {stockoutImpact?.stockout_events ?? 0}
                  </span>{" "}
                  {t("workspace.financial.overview.stockoutEvents")}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  {t("workspace.financial.overview.biggestWasteSources")}
                </p>
                <Link
                  href={`/workspace/sales-waste${financialData?.branch_id ? `?branch=${financialData.branch_id}` : ""}`}
                  className="text-xs text-text-muted transition-colors hover:text-brand-gold"
                >
                  {t("workspace.financial.overview.seeAllItems")}
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
                        {money(item.waste_cost)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">{t("workspace.financial.overview.noWasteEvents")}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.financial.overview.bestPerformers")}
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
                        <span className="text-sm text-text-muted">{money(row.revenue)}</span>
                        <span className="text-xs font-semibold text-brand-gold">
                          {toPercent(row.margin_pct)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">{t("workspace.financial.overview.noProfitabilityData")}</p>
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
                  {formatMoney(branch.revenue, branch.currency)}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  {toPercent(branch.marginPct)} {t("workspace.financial.branches.margin")}
                </p>
              </article>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.financial.branches.allBranches")}
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              {t("workspace.financial.branches.subtitle")}
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
              {t("workspace.financial.accuracy.title")}
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              {t("workspace.financial.accuracy.subtitle")}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">{timeframeLabel}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.financial.accuracy.accuracy")}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toPercent(forecastImpact?.accuracy_pct ?? 0)}
              </p>
              <p className="mt-2 text-xs text-text-muted">{t("workspace.financial.accuracy.howOftenRight")}</p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.financial.accuracy.wastePrevented")}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {money(forecastImpact?.waste_prevented ?? 0)}
              </p>
              <p className="mt-2 text-xs text-text-muted">{t("workspace.financial.accuracy.comparedToPrior")}</p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{t("workspace.financial.accuracy.stockoutRevenueSaved")}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {money(forecastImpact?.stockouts_avoided ?? 0)}
              </p>
              <p className="mt-2 text-xs text-text-muted">{t("workspace.financial.accuracy.revenueNotLost")}</p>
            </article>
          </div>
        </div>
      ) : null}

      {activeTab === "TRENDS" ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.financial.trends.title")}
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
                {t("workspace.financial.trends.subtitle")}
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
              {t("workspace.financial.trends.downloadCsv")}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { label: t("workspace.financial.trends.chartRevenue"), color: "text-status-success", series: trendSeries.revenue },
              { label: t("workspace.financial.trends.chartFoodCost"), color: "text-text-secondary", series: trendSeries.food },
              { label: t("workspace.financial.trends.chartWasteCost"), color: "text-status-critical", series: trendSeries.waste },
              { label: t("workspace.financial.trends.chartMargin"), color: "text-brand-gold", series: trendSeries.margin },
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
                              {money(
                                chart.series[Math.max(0, chart.series.length - 6 + index)] ?? 0,
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-text-muted">{t("workspace.financial.trends.notEnoughData")}</p>
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
