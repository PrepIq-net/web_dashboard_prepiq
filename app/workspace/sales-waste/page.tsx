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
import { useSubscriptionTier } from "@/services/payment/hooks";
import { PlanGateState } from "@/components/dashboard/plan-gate-state";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type SalesWasteTab = "ITEMS" | "TRENDS" | "DRIVERS" | "INSIGHTS";

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

  const [activeTab, setActiveTab] = useState<SalesWasteTab>("ITEMS");
  const [selectedBranchId, setSelectedBranchId] = useState(
    queryBranchId || (defaultBranch?.id ?? ""),
  );
  const { tier, planType, isLoading: tierLoading, shouldBlockAccess, gateVariant } = useSubscriptionTier(selectedBranchId || undefined);
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

  const reportQuery = useSalesWasteReport({
    branch_id: selectedBranchId,
    period,
    target_date: anchorDate,
  });

  const report = reportQuery.data;

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
        header: "Wasted",
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
        header: "Margin",
        cell: (info) => (
          <span className={`text-sm font-semibold ${getProfitabilityTone(getProfitabilityLabel(info.row.original.margin_pct))}`}>
            {getProfitabilityLabel(info.row.original.margin_pct)}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <Link
            href={`/workspace/sales-waste/item?item=${info.row.original.item_id}&branch=${selectedBranchId}&date=${anchorDate}&period=${period}`}
            className="inline-flex h-7 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
          >
            Drill in
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
      wasteRate: trends.map((row) =>
        row.revenue > 0 ? (row.waste_cost / row.revenue) * 100 : 0,
      ),
    };
  }, [report?.trends]);

  const efficiencyRatio = report?.totals?.efficiency_ratio ?? 0;

  return (
    <WorkspaceShell
      eyebrow="Operations"
      title="Sales & Waste"
      description="Every item. What sold, what didn't, what was thrown away."
      insight=""
    >
      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="min-w-45">
          <Select
            label="Branch"
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
          />
        </div>
        <div className="min-w-37.5">
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
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Anchor date
          </label>
          <input
            type="date"
            value={anchorDate}
            onChange={(event) => setAnchorDate(event.target.value)}
            className="h-12 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-secondary focus:outline-none focus-visible:border-brand-gold"
          />
        </div>
        {report ? (
          <p className="pb-3 text-xs text-text-muted">
            {report.period_start_date} → {report.period_end_date}
          </p>
        ) : null}
      </div>

      {selectedBranchId && !tierLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : !tierLoading && tier < 2 ? (
        <PlanGateState requiredTier="INTELLIGENCE" currentPlanType={planType} />
      ) : (
        <>
      {/* KPI strip */}
      {report ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-status-success">
              {toCurrency(report.totals?.revenue ?? 0)}
            </span>{" "}
            revenue
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-status-critical">
              {toCurrency(report.totals?.waste_cost ?? 0)}
            </span>{" "}
            wasted
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-brand-gold">
              {toPercent(efficiencyRatio)}
            </span>{" "}
            kept
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-status-warning">
              {toPercent(report.totals?.waste_rate_pct ?? 0)}
            </span>{" "}
            waste rate
          </span>
        </div>
      ) : null}

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-surface-4/60">
        {(
          [
            { id: "ITEMS", label: "Items" },
            { id: "TRENDS", label: "Trends" },
            { id: "DRIVERS", label: "Why Waste" },
            { id: "INSIGHTS", label: "Insights" },
          ] as { id: SalesWasteTab; label: string }[]
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

      {activeTab === "ITEMS" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Revenue</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-success">
                {toCurrency(report?.totals?.revenue ?? 0)}
              </p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Food Cost %</p>
              <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
                {toPercent(report?.totals?.food_cost_ratio ?? 0)}
              </p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste Rate</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-warning">
                {toPercent(report?.totals?.waste_rate_pct ?? 0)}
              </p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Lost Revenue</p>
              <p className="mt-2 font-display text-2xl font-semibold text-status-critical">
                {toCurrency(report?.totals?.lost_revenue ?? 0)}
              </p>
            </article>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Item breakdown
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              What sold and what was left behind
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Items with high waste % need their prep targets adjusted.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
            <div className="overflow-x-auto">
              <NativeTable
                table={table}
                tableClassName="w-full min-w-[860px]"
                headerClassName="border-b border-surface-4/80 bg-surface-3/40"
                bodyClassName="divide-y divide-surface-4/50"
                headerCellClassName="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="align-middle transition-colors hover:bg-surface-3/20"
                cellClassName="px-4 py-3"
              />
            </div>
            {!items.length ? (
              <div className="py-12 text-center">
                <p className="text-sm text-text-muted">
                  No item data for this window yet.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "TRENDS" ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Trends
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              How sales and waste move day by day
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { label: "Revenue", color: "text-status-success", series: trendSeries.revenue },
              { label: "Waste Rate", color: "text-status-critical", series: trendSeries.wasteRate, suffix: "%" },
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
                      Not enough data yet.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "DRIVERS" ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Waste causes
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              Where your food is going
            </h3>
            {report?.waste_drivers?.data_note ? (
              <p className="mt-1 text-sm text-text-muted">{report.waste_drivers.data_note}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(report?.waste_drivers?.drivers ?? []).map((driver) => (
              <div key={driver.label} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">{driver.label}</p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-text-primary">
                    {toPercent(driver.pct)}
                  </p>
                  <p className="text-sm text-text-muted">{toCurrency(driver.cost)}</p>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-surface-3">
                  <div
                    className="h-1.5 rounded-full bg-brand-gold"
                    style={{ width: `${Math.min(driver.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!(report?.waste_drivers?.drivers ?? []).length ? (
              <p className="text-sm text-text-muted">No waste driver data for this window.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "INSIGHTS" ? (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Where to improve
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              Items worth fixing
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(report?.opportunity_insights ?? []).length ? (
              report?.opportunity_insights.map((insight) => (
                <article key={insight.item_id ?? insight.item_title} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <p className="text-sm font-semibold text-text-primary">
                    {insight.item_title ?? "Item"}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Waste rate:{" "}
                    <span className="font-semibold text-status-critical">
                      {toPercent(insight.waste_rate_pct)}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">{insight.suggested_action}</p>
                  <div className="mt-4 border-t border-surface-4/60 pt-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                      Potential savings
                    </p>
                    <p className="mt-1 text-lg font-semibold text-status-success">
                      {toCurrency(insight.potential_savings)}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-text-muted">
                You&apos;re in good shape for this window — no major waste flags.
              </p>
            )}
          </div>
        </div>
      ) : null}
        </>
      )}
    </WorkspaceShell>
  );
}

export default function SalesWastePage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          Loading…
        </div>
      }
    >
      <SalesWasteContent />
    </Suspense>
  );
}
