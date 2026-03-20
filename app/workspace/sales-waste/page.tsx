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
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useSalesWasteReport,
} from "@/services";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type SalesWasteTab = "OVERVIEW" | "ITEMS" | "TRENDS";

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

function SalesWasteContent() {
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
      columnHelper.accessor("forecasted", {
        header: "Forecasted",
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("produced", {
        header: "Produced",
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
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
      columnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("waste_cost", {
        header: "Waste Cost",
        cell: (info) => (
          <span className="text-sm font-semibold text-status-warning">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "overUnder",
        header: "Over/Under",
        cell: (info) => {
          const row = info.row.original;
          const over = row.over_prep > 0 ? `+${row.over_prep}` : "0";
          const under = row.under_prep > 0 ? `-${row.under_prep}` : "0";
          return (
            <span className="text-sm text-text-muted">{over} / {under}</span>
          );
        },
      }),
      columnHelper.accessor("margin_impact", {
        header: "Margin Impact",
        cell: (info) => (
          <span className="text-sm font-semibold text-status-critical">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("margin_pct", {
        header: "Margin %",
        cell: (info) => (
          <span className="text-sm font-semibold text-brand-gold">
            {toPercent(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Action",
        cell: (info) => (
          <Link
            href={`/workspace/production?item=${info.row.original.item_id}&branch=${selectedBranchId}&date=${anchorDate}`}
            className="inline-flex h-8 items-center rounded-lg border border-surface-4 px-3 text-xs text-text-secondary hover:text-text-primary"
          >
            Drill In
          </Link>
        ),
      }),
    ],
    [anchorDate, selectedBranchId],
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
    };
  }, [report?.trends]);

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
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Sales Summary
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Performance at a Glance
            </h3>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
              Over/under prep shows forecasting drag. Margin impact combines waste and lost revenue.
            </p>
          </div>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Revenue</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toCurrency(report?.totals.revenue ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Food Cost Ratio</p>
              <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {toPercent(report?.totals.food_cost_ratio ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste Rate</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-warning">
                {toPercent(report?.totals.waste_rate_pct ?? 0)}
              </p>
            </article>
            <article className="bg-surface-2 rounded-xl p-5 border border-surface-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Lost Revenue</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-critical">
                {toCurrency(report?.totals.lost_revenue ?? 0)}
              </p>
            </article>
          </div>
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <NativeTable
                table={table}
                tableClassName="w-full min-w-[1200px]"
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
              Cost Trends
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Revenue, Waste, Food Cost, Margin
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[
              { label: "Revenue", color: "text-status-success", series: trendSeries.revenue },
              { label: "Food Cost", color: "text-text-secondary", series: trendSeries.food },
              { label: "Waste Cost", color: "text-status-critical", series: trendSeries.waste },
              { label: "Margin", color: "text-brand-gold", series: trendSeries.margin },
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
                              {toCurrency(chart.series[Math.max(0, chart.series.length - 6 + index)] ?? 0)}
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
