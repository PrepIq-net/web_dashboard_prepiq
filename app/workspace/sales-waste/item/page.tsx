"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type SalesWasteItemRow = {
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

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatQuantity(value: number, unit: string) {
  if (Number.isNaN(value)) return `0 ${unit}`;
  return `${value.toFixed(0)} ${unit}`;
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

function SalesWasteItemContent() {
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
  const queryPeriod = searchParams.get("period") ?? "";
  const queryItemId = searchParams.get("item") ?? "";

  const [selectedBranchId, setSelectedBranchId] = useState(
    queryBranchId || (defaultBranch?.id ?? ""),
  );
  const [anchorDate, setAnchorDate] = useState(
    queryDate || new Date().toISOString().slice(0, 10),
  );
  const [period, setPeriod] = useState(queryPeriod || "30d");

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
    item_id: queryItemId || undefined,
  });
  const report = reportQuery.data;

  const itemRow = useMemo(() => {
    if (!report?.items || !queryItemId) return null;
    return report.items.find((row) => row.item_id === queryItemId) ?? null;
  }, [report?.items, queryItemId]);

  const itemTrendSeries = useMemo(() => {
    const series = report?.item_trends ?? [];
    return {
      labels: series.map((row) => row.date.slice(5)),
      sold: series.map((row) => row.sold),
      revenue: series.map((row) => row.revenue),
      wasteUnits: series.map((row) => row.waste),
      wasteRate: series.map((row) => row.waste_rate_pct),
    };
  }, [report?.item_trends]);

  const handleDownloadCsv = () => {
    if (!report?.item_trends?.length) return;
    const headers = ["date", "sold_units", "revenue", "waste_units", "waste_cost", "waste_rate_pct"];
    const rows = report.item_trends.map((row) => [
      row.date,
      row.sold,
      row.revenue,
      row.waste,
      row.waste_cost,
      row.waste_rate_pct,
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((value) => `"${String(value)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `item-trends-${queryItemId}-${anchorDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const revenueShare =
    report?.totals?.revenue && itemRow
      ? Math.min(100, (itemRow.revenue / report.totals.revenue) * 100)
      : 0;

  if (!queryItemId) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.salesWaste.itemDetail.eyebrow")}
        title={t("common.info")}
        description={t("workspace.salesWaste.itemDetail.description")}
        insight=""
      >
        <section className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-secondary">
          {t("workspace.salesWaste.itemDetail.missingItemId")}
        </section>
      </WorkspaceShell>
    );
  }

  if (report && !itemRow) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.salesWaste.itemDetail.eyebrow")}
        title={t("common.info")}
        description={t("workspace.salesWaste.itemDetail.itemNotFound")}
        insight=""
      >
        <section className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-secondary">
          {t("workspace.salesWaste.itemDetail.itemNotFoundDesc")}
        </section>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t("workspace.salesWaste.itemDetail.eyebrow")}
      title={t("workspace.salesWaste.itemDetail.title")}
      description={t("workspace.salesWaste.itemDetail.description")}
      insight=""
    >
      <section className="mb-6 rounded-xl border border-surface-4 bg-surface-2 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.itemDrillDown")}
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {itemRow?.item_title ?? t("common.none")}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {t("workspace.salesWaste.itemDetail.unitLabel", {
                unit: itemRow?.unit ?? "PCS",
              })}{" · "}
              {t("workspace.salesWaste.itemDetail.revenueShareLabel", {
                percent: toPercent(revenueShare),
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex h-10 items-center rounded-lg border border-brand-gold/50 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold hover:text-brand-gold"
            >
              {t("workspace.salesWaste.itemDetail.downloadTrendCsv")}
            </button>
            <Link
              href={`/workspace/sales-waste?branch=${selectedBranchId}&date=${anchorDate}&period=${period}`}
              className="inline-flex h-10 items-center rounded-lg border border-surface-4 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary hover:text-text-primary"
            >
              {t("workspace.salesWaste.itemDetail.backToSalesWaste")}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4">
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
      </section>

      <section className="space-y-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.revenueLabel")}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-status-success">
              {toCurrency(itemRow?.revenue ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t("workspace.salesWaste.itemDetail.soldLabel", {
                quantity: formatQuantity(
                  itemRow?.sold ?? 0,
                  itemRow?.unit ?? "PCS",
                ),
              })}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.wasteCostLabel")}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-status-warning">
              {toCurrency(itemRow?.waste_cost ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t("workspace.salesWaste.itemDetail.wasteLabel", {
                quantity: formatQuantity(
                  itemRow?.waste ?? 0,
                  itemRow?.unit ?? "PCS",
                ),
              })}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.lostRevenueLabel")}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-status-critical">
              {toCurrency(itemRow?.lost_revenue ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t("workspace.salesWaste.itemDetail.underPrepLabel", {
                quantity: formatQuantity(
                  itemRow?.under_prep ?? 0,
                  itemRow?.unit ?? "PCS",
                ),
              })}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.marginPctLabel")}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-brand-gold">
              {toPercent(itemRow?.margin_pct ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              {t("workspace.salesWaste.itemDetail.marginImpactLabel", {
                amount: toCurrency(itemRow?.margin_impact ?? 0),
              })}
            </p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.forecastVsPrep")}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              {t("workspace.salesWaste.itemDetail.forecastedLabel", {
                quantity: formatQuantity(
                  itemRow?.forecasted ?? 0,
                  itemRow?.unit ?? "PCS",
                ),
              })}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {t("workspace.salesWaste.itemDetail.producedLabel", {
                quantity: formatQuantity(
                  itemRow?.produced ?? 0,
                  itemRow?.unit ?? "PCS",
                ),
              })}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.overUnderPrep")}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              {t("workspace.salesWaste.itemDetail.overPrepLabel", {
                quantity: formatQuantity(
                  itemRow?.over_prep ?? 0,
                  itemRow?.unit ?? "PCS",
                ),
              })}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {t("workspace.salesWaste.itemDetail.underPrepLabel", {
                quantity: formatQuantity(
                  itemRow?.under_prep ?? 0,
                  itemRow?.unit ?? "PCS",
                ),
              })}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {t("workspace.salesWaste.itemDetail.foodCostLabel")}
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              {t("workspace.salesWaste.itemDetail.foodCostLabel")}:{" "}
              {toCurrency(itemRow?.food_cost ?? 0)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {t("workspace.salesWaste.itemDetail.revenueShareLabel", {
                percent: toPercent(revenueShare),
              })}
            </p>
          </article>
        </div>

        <div className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {t("workspace.salesWaste.itemDetail.operationalSignals")}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-2">
            <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
              {(itemRow?.over_prep ?? 0) > 0
                ? t("workspace.salesWaste.itemDetail.overPrepDetected")
                : t("workspace.salesWaste.itemDetail.overPrepControl")}
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
              {(itemRow?.under_prep ?? 0) > 0
                ? t("workspace.salesWaste.itemDetail.underPrepRisk")
                : t("workspace.salesWaste.itemDetail.underPrepControl")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            {
              label: t("workspace.salesWaste.revenueTrendLabel"),
              color: "text-status-success",
              series: itemTrendSeries.revenue,
              format: "currency",
            },
            {
              label: t("workspace.salesWaste.wasteRateTrendLabel"),
              color: "text-status-critical",
              series: itemTrendSeries.wasteRate,
              suffix: "%",
              format: "percent",
            },
            {
              label: t("workspace.salesWaste.itemDetail.unitsSoldTrend"),
              color: "text-text-secondary",
              series: itemTrendSeries.sold,
              format: "number",
            },
            {
              label: t("workspace.salesWaste.itemDetail.wasteUnitsTrend"),
              color: "text-status-warning",
              series: itemTrendSeries.wasteUnits,
              format: "number",
            },
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
                      {itemTrendSeries.labels.slice(-6).map((label, index) => {
                        const value =
                          chart.series[
                            Math.max(0, chart.series.length - 6 + index)
                          ] ?? 0;
                        return (
                          <div key={`${chart.label}-${label}-${index}`}>
                            <p>{label}</p>
                            <p className="font-semibold text-text-secondary">
                              {chart.format === "currency"
                                ? toCurrency(value)
                                : chart.format === "percent"
                                  ? `${value.toFixed(1)}${chart.suffix ?? ""}`
                                  : value.toFixed(0)}
                            </p>
                          </div>
                        );
                      })}
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
    </WorkspaceShell>
  );
}

export default function SalesWasteItemPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          {t("workspace.salesWaste.itemDetail.loadingItemPerformance")}
        </div>
      }
    >
      <SalesWasteItemContent />
    </Suspense>
  );
}
