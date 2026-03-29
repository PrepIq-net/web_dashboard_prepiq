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
import { useTranslation } from "@/lib/i18n";
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
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const role = user?.organization_role ?? "";
  const canAccess = [
    "ORG_OWNER",
    "ORG_ADMIN",
    "OPS_DIRECTOR",
    "GM",
    "BRANCH_MANAGER",
    "STAFF_OPERATOR",
  ].includes(role);

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
        header: t("workspace.history.table.item"),
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {info.getValue() ?? t("common.none")}
          </span>
        ),
      }),
      columnHelper.accessor("planned_qty", {
        header: t("workspace.history.table.planned"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "prepared",
        header: t("workspace.history.table.prepared"),
        cell: (info) => {
          const row = info.row.original;
          const prepared = row.planned_qty + row.additional_qty;
          return (
            <span className="text-sm text-text-secondary">{prepared}</span>
          );
        },
      }),
      columnHelper.accessor("actual_sales", {
        header: t("workspace.history.table.sold"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("waste_qty", {
        header: t("workspace.history.table.waste"),
        cell: (info) => (
          <span className="text-sm text-status-warning">{info.getValue()}</span>
        ),
      }),
      columnHelper.display({
        id: "stockout",
        header: t("workspace.history.table.stockout"),
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
              {row.stockout_flag ? t("common.yes") : t("common.no")}
            </span>
          );
        },
      }),
      columnHelper.accessor("revenue", {
        header: t("workspace.history.table.revenue"),
        cell: (info) => (
          <span className="text-sm text-text-secondary">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: items as HistoryItemRow[],
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <WorkspaceShell
      eyebrow={t("workspace.history.eyebrow")}
      title={t("workspace.history.title")}
      description={t("workspace.history.description")}
      insight={t("workspace.history.insight")}
    >
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("workspace.history.branchLabel")}
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
              placeholder={t("workspace.history.selectBranchPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("workspace.history.serviceDateLabel")}
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
              {t("workspace.history.serviceHistoryTitle")}
            </p>
            <p className="text-xs text-text-muted">
              {t("workspace.history.lastNDays", { count: report?.window_days ?? 14 })}
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
                      {t("workspace.history.accuracyLabel", { percent: day.forecast_accuracy.toFixed(0) })}
                    </p>
                    <p className="text-xs text-text-muted">
                      {t("workspace.history.wasteLabel", { cost: toCurrency(day.waste_cost) })}
                    </p>
                    <p className="text-xs text-text-muted">
                      {t("workspace.history.stockoutsLabel", { count: day.stockout_count })}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="text-sm text-text-muted">
                {t("workspace.history.noServiceDays")}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "SUMMARY", label: t("workspace.history.tabDailySummary") },
            { id: "ITEMS", label: t("workspace.history.tabItemPerformance") },
            { id: "EXCEPTIONS", label: t("workspace.history.tabWasteStockouts") },
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
                {t("workspace.history.serviceReviewTitle")}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-text-primary">
                {summary ? formatLongDate(summary.date) : t("workspace.history.noServiceSelected")}
              </h3>
              <p className="mt-2 text-sm text-text-muted">
                {summary
                  ? t("workspace.history.snapshotDescription")
                  : t("workspace.history.selectServiceDescription")}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  {
                    label: t("workspace.history.metricForecastAccuracy"),
                    value: summary ? `${summary.forecast_accuracy.toFixed(0)}%` : "—",
                  },
                  {
                    label: t("workspace.history.metricRevenue"),
                    value: summary ? toCurrency(summary.revenue) : "—",
                  },
                  {
                    label: t("workspace.history.metricWasteCost"),
                    value: summary ? toCurrency(summary.waste_cost) : "—",
                  },
                  {
                    label: t("workspace.history.metricStockouts"),
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
                {t("workspace.history.planningSignalsTitle")}
              </p>
              <div className="mt-4 space-y-4 text-sm text-text-secondary">
                <div className="flex items-center justify-between">
                  <span>{t("workspace.history.prepItemsPlanned")}</span>
                  <span className="font-semibold text-text-primary">
                    {summary ? summary.prep_items_planned : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("workspace.history.lostRevenueEstimate")}</span>
                  <span className="font-semibold text-text-primary">
                    {summary ? toCurrency(summary.lost_revenue_estimate) : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                {t("common.insight")}
              </p>
              <p className="mt-3 text-sm text-text-secondary">
                {t("workspace.history.insightText")}
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
                {t("workspace.history.tabItemPerformance")}
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-text-primary">
                {t("workspace.history.plannedVsActualTitle")}
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
              {t("workspace.history.topWasteItemsTitle")}
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
                        {item.item_title ?? t("common.none")}
                      </p>
                      <p className="text-xs text-text-muted">
                        {t("workspace.history.wasteQtyLabel", { quantity: item.waste_qty })}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-status-warning">
                      {toCurrency(item.waste_cost)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">
                  {t("workspace.history.noWasteOutliers")}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
              {t("workspace.history.topStockoutsTitle")}
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
                        {item.item_title ?? t("common.none")}
                      </p>
                      <p className="text-xs text-text-muted">
                        {t("workspace.history.lostRevenueLabel", { amount: toCurrency(item.lost_revenue_estimate) })}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-status-critical">
                      {item.stockout_flag ? t("workspace.history.stockoutStatus") : "—"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">
                  {t("workspace.history.noStockoutRisks")}
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
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          {t("workspace.history.loadingHistory")}
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
