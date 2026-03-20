"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  NativeTable,
  useReactTable,
} from "@/components/ui/native-table";
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
  const role = user?.organization_role ?? "";

  const canAccess = ["ORG_OWNER", "OPS_DIRECTOR", "GM", "BRANCH_MANAGER"].includes(role);

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");

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

    return financialData?.branches.map((branch) => ({
      value: branch.branch_id,
      label: branch.branch_name,
    })) ?? [];
  }, [branches, financialData]);

  const summary = financialData?.summary;

  const branchRows = useMemo<FinancialBranchRow[]>(() => {
    return (
      financialData?.branches ?? []
    ).map((branch) => ({
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
    timeframe === "7d"
      ? "Last 7 Days"
      : timeframe === "90d"
        ? "Last 90 Days"
        : "Last 30 Days";

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
      ["Branch", "Revenue", "FoodCost", "WasteCost", "GrossMargin", "MarginPct"],
      rows,
    );
  };

  return (
    <WorkspaceShell
      eyebrow="Financial"
      title="Financial Intelligence"
      description="Operational financial performance across revenue, food cost, and waste."
      insight="Connect kitchen execution to margin performance in real time."
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
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

          <Select
            label="Branch Focus"
            options={[
              { value: "ALL", label: "All branches" },
              ...branchOptions,
            ]}
            value={branchFilter}
            onChange={setBranchFilter}
            disabled={financialData?.scope === "BRANCH"}
          />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Data Range
            </label>
            <div className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 flex items-center text-sm text-text-secondary">
              {financialData
                ? `${financialData.start_date} → ${financialData.end_date}`
                : "—"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Quick Export
            </label>
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-button border border-border-default bg-surface-3 text-sm font-medium text-text-primary transition-all duration-200 hover:bg-surface-4 hover:border-brand-gold hover:text-brand-gold active:scale-[0.98]"
              disabled={branchRows.length === 0}
            >
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Financial Overview
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            {timeframeLabel}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {branchFilter === "ALL" || !financialData?.branch_name
              ? "Organization-wide view"
              : `Branch: ${financialData.branch_name}`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              Revenue
            </p>
            <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
              {toCurrency(summary?.revenue ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              {formatDelta(summary?.revenue_delta_pct)}
            </p>
          </article>

          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              Food Cost
            </p>
            <p className="font-display text-3xl font-semibold text-text-primary tracking-tight">
              {toCurrency(summary?.food_cost ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              {formatDelta(summary?.food_cost_delta_pct)}
            </p>
          </article>

          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              Waste Cost
            </p>
            <p className="font-display text-3xl font-semibold text-status-critical tracking-tight">
              {toCurrency(summary?.waste_cost ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              {formatDelta(summary?.waste_cost_delta_pct)}
            </p>
          </article>

          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              Gross Margin
            </p>
            <p className="font-display text-3xl font-semibold text-status-success tracking-tight">
              {toCurrency(summary?.gross_margin ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              {formatDelta(summary?.gross_margin_delta_pct)}
            </p>
          </article>

          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
              Margin %
            </p>
            <p className="font-display text-3xl font-semibold text-brand-gold tracking-tight">
              {toPercent(summary?.margin_pct ?? 0)}
            </p>
            <p className="mt-3 text-xs text-text-muted">
              {summary?.margin_pct_delta != null
                ? `${summary.margin_pct_delta >= 0 ? "+" : ""}${summary.margin_pct_delta.toFixed(1)} pp vs prior`
                : "—"}
            </p>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Branch Performance
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Revenue, Cost, and Margin Breakdown
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
    </WorkspaceShell>
  );
}
