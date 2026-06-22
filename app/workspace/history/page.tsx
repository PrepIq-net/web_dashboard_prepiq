"use client";

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
  useOperationsHistorySnapshot,
} from "@/services";

const EMPTY_LIST: never[] = [];
const CORE_ROW_MODEL = getCoreRowModel();

type HistoryTab = "SUMMARY" | "ITEMS" | "EXCEPTIONS";

type HistoryItemRow = {
  item_id: string;
  item_title: string | null;
  unit: string;
  planned_qty: number;
  additional_qty: number;
  actual_sales: number;
  waste_qty: number;
  stockout_flag: boolean;
  revenue: number;
  waste_cost: number;
  lost_revenue_estimate: number;
  forecast_qty: number;
  forecast_error: number;
};

const columnHelper = createColumnHelper<HistoryItemRow>();

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatLongDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const role = user?.organization_role ?? "";
  const canAccess = Boolean(user?.has_organization);

  const canViewAllBranches = Boolean(accessScope?.can_view_all_branches);
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;

  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const scopedBranchIds = new Set(accessibleBranches.map((branch) => branch.id));
  const branchOptions = useMemo(() => {
    if (canViewAllBranches) return branches;
    if (accessibleBranches.length) {
      if (!branches.length) return accessibleBranches;
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

  const [activeTab, setActiveTab] = useState<HistoryTab>("SUMMARY");
  const [selectedBranchId, setSelectedBranchId] = useState(
    queryBranchId || (defaultBranch?.id ?? ""),
  );
  const [selectedDate, setSelectedDate] = useState(queryDate || "");

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

  const historyQuery = useOperationsHistorySnapshot({
    branch_id: selectedBranchId,
    target_date: selectedDate || undefined,
  });

  const report = historyQuery.data;
  const summary = report?.summary ?? null;
  const timeline = report?.timeline ?? EMPTY_LIST;
  const items = report?.items ?? EMPTY_LIST;
  const exceptions = report?.exceptions;

  useEffect(() => {
    if (!selectedDate && report?.anchor_date) {
      setSelectedDate(report.anchor_date);
    }
  }, [report?.anchor_date, selectedDate]);

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
      columnHelper.accessor("planned_qty", {
        header: "Planned",
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "prepared",
        header: "Prepared",
        cell: (info) => {
          const row = info.row.original;
          const prepared = row.planned_qty + row.additional_qty;
          return (
            <span className="text-sm text-text-secondary">{prepared}</span>
          );
        },
      }),
      columnHelper.accessor("actual_sales", {
        header: "Sold",
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("waste_qty", {
        header: "Waste",
        cell: (info) => (
          <span className="text-sm text-status-warning">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "stockout",
        header: "Stockout",
        cell: (info) => {
          const row = info.row.original;
          return (
            <span
              className={
                row.stockout_flag
                  ? "text-sm text-status-critical font-semibold"
                  : "text-sm text-text-muted"
              }
            >
              {row.stockout_flag ? "Yes" : "No"}
            </span>
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
    ],
    [],
  );

  const table = useReactTable({
    data: items as HistoryItemRow[],
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <WorkspaceShell
      eyebrow="Review"
      title="History"
      description="Review past service days to learn what worked, where waste happened, and how prep decisions performed."
      insight="Use the review signals to fine-tune tomorrow’s prep plan and reduce repeat waste."
    >
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Branch
            </label>
            <Select
              value={selectedBranchId}
              onChange={(value) => {
                setSelectedBranchId(value);
                setSelectedDate("");
              }}
              options={branchOptions.map((branch) => ({
                label: branch.name,
                value: branch.id,
              }))}
              placeholder="Select branch"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Service Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 text-sm text-text-secondary"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Service History
            </p>
            <p className="text-xs text-text-muted">
              Last {report?.window_days ?? 14} days
            </p>
          </div>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {timeline.length ? (
              timeline.map((day) => {
                const isActive = day.date === (summary?.date ?? report?.anchor_date);
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={`min-w-[168px] rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-brand-gold/60 bg-brand-gold/10 text-text-primary"
                        : "border-surface-4 bg-surface-3 text-text-secondary hover:border-brand-gold/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{formatShortDate(day.date)}</p>
                    <p className="mt-2 text-xs text-text-muted">
                      Accuracy {day.forecast_accuracy.toFixed(0)}%
                    </p>
                    <p className="text-xs text-text-muted">
                      Waste {toCurrency(day.waste_cost)}
                    </p>
                    <p className="text-xs text-text-muted">
                      Stockouts {day.stockout_count}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-text-muted">
                No service days available yet.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "SUMMARY", label: "Daily Summary" },
            { id: "ITEMS", label: "Item Performance" },
            { id: "EXCEPTIONS", label: "Waste & Stockouts" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as HistoryTab)}
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
      </section>

      {report?.data_note ? (
        <div className="mt-6 rounded-xl border border-surface-4 bg-surface-2 px-4 py-3 text-sm text-text-muted">
          {report.data_note}
        </div>
      ) : null}

      {activeTab === "SUMMARY" ? (
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
                Service Review
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-text-primary">
                {summary ? formatLongDate(summary.date) : "No service selected"}
              </h3>
              <p className="mt-2 text-sm text-text-muted">
                {summary
                  ? "Snapshot of how prep decisions performed."
                  : "Select a service day to review performance."}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  {
                    label: "Forecast Accuracy",
                    value: summary ? `${summary.forecast_accuracy.toFixed(0)}%` : "—",
                  },
                  {
                    label: "Revenue",
                    value: summary ? toCurrency(summary.revenue) : "—",
                  },
                  {
                    label: "Waste Cost",
                    value: summary ? toCurrency(summary.waste_cost) : "—",
                  },
                  {
                    label: "Stockouts",
                    value: summary ? summary.stockout_count : "—",
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-surface-4 bg-surface-3 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-text-primary">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                Planning Signals
              </p>
              <div className="mt-4 space-y-4 text-sm text-text-secondary">
                <div className="flex items-center justify-between">
                  <span>Prep items planned</span>
                  <span className="font-semibold text-text-primary">
                    {summary ? summary.prep_items_planned : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Lost revenue estimate</span>
                  <span className="font-semibold text-text-primary">
                    {summary ? toCurrency(summary.lost_revenue_estimate) : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                Insight
              </p>
              <p className="mt-3 text-sm text-text-secondary">
                Track how decisions map to waste and stockouts so tomorrow’s prep
                is tighter.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "ITEMS" ? (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
                Item Performance
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-text-primary">
                Planned vs Actual
              </h3>
            </div>
            <p className="text-xs text-text-muted">
              {summary ? formatLongDate(summary.date) : "—"}
            </p>
          </div>
          <div className="mt-6 rounded-2xl border border-surface-4 bg-surface-2 p-4">
            <NativeTable table={table} />
          </div>
        </section>
      ) : null}

      {activeTab === "EXCEPTIONS" ? (
        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
              Top Waste Items
            </p>
            <div className="mt-5 space-y-4">
              {exceptions?.top_waste_items?.length ? (
                exceptions.top_waste_items.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between border-b border-surface-4 pb-3 text-sm text-text-secondary last:border-none last:pb-0"
                  >
                    <div>
                      <p className="font-semibold text-text-primary">
                        {item.item_title ?? "Unknown"}
                      </p>
                      <p className="text-xs text-text-muted">
                        Waste qty {item.waste_qty}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-status-warning">
                      {toCurrency(item.waste_cost)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">
                  No waste outliers recorded.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
              Top Stockouts
            </p>
            <div className="mt-5 space-y-4">
              {exceptions?.top_stockout_items?.length ? (
                exceptions.top_stockout_items.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between border-b border-surface-4 pb-3 text-sm text-text-secondary last:border-none last:pb-0"
                  >
                    <div>
                      <p className="font-semibold text-text-primary">
                        {item.item_title ?? "Unknown"}
                      </p>
                      <p className="text-xs text-text-muted">
                        Lost revenue {toCurrency(item.lost_revenue_estimate)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-status-critical">
                      {item.stockout_flag ? "Stockout" : "—"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">
                  No stockout risks recorded.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          Loading service history…
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
