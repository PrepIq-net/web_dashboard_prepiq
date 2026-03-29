"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useBranches, useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useForecastMetrics,
  useDataQualityReport,
} from "@/services/production-intelligence/hooks";

type BranchControlRow = {
  id: string;
  branch: string;
  revenue: number;
  marginPct: number;
  riskScore: number;
  wastePct: number;
  efficiencyScore: number;
  status: "HEALTHY" | "AT_RISK" | "UNDERPERFORMING";
};

const EMPTY_LIST: never[] = [];
const branchColumnHelper = createColumnHelper<BranchControlRow>();
const CORE_ROW_MODEL = getCoreRowModel();

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function BranchesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const canAccess = ["OPS_DIRECTOR", "ORG_OWNER", "ORG_ADMIN"].includes(role);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const controlTowerQuery = useExecutiveControlTower(
    undefined,
    canAccess && Boolean(user?.organization_id),
  );
  const marginReportQuery = useOwnerMarginProtectionReport(
    undefined,
    canAccess && Boolean(user?.organization_id),
  );

  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [targetAdjustments, setTargetAdjustments] = useState<
    Record<string, number>
  >({});

  const compareMetricsA = useForecastMetrics(
    compareA ? { branch_id: compareA, lookback_days: 60 } : undefined,
    Boolean(compareA),
  );
  const compareMetricsB = useForecastMetrics(
    compareB ? { branch_id: compareB, lookback_days: 60 } : undefined,
    Boolean(compareB),
  );
  const compareQualityA = useDataQualityReport(
    compareA ? { branch_id: compareA, days_window: 30 } : undefined,
    Boolean(compareA),
  );
  const compareQualityB = useDataQualityReport(
    compareB ? { branch_id: compareB, days_window: 30 } : undefined,
    Boolean(compareB),
  );

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const branchGrid = controlTowerQuery.data?.branch_grid ?? EMPTY_LIST;
  const marginBranches = marginReportQuery.data?.branches ?? EMPTY_LIST;

  const rows = useMemo<BranchControlRow[]>(() => {
    return branchGrid.map((branch) => {
      const wastePct = Number(branch.waste_pct ?? 0);
      const surplusPct = Number(branch.surplus_pct ?? 0);
      const revenue = Number(branch.revenue ?? 0);
      const marginEntry = marginBranches.find(
        (item) => item.branch_id === branch.branch_id,
      );
      const marginPct =
        Number(marginEntry?.forecast_accuracy_summary ?? 0) > 0
          ? Number(marginEntry?.forecast_accuracy_summary ?? 0)
          : Math.max(0, 68 - wastePct * 0.7 - surplusPct * 0.3);

      const efficiencyScore = Math.max(0, 100 - wastePct - surplusPct * 0.6);
      const riskScore = Math.max(
        0,
        Math.min(100, wastePct * 10 + surplusPct * 7),
      );

      const status: BranchControlRow["status"] =
        wastePct >= 6 || riskScore >= 65
          ? "UNDERPERFORMING"
          : wastePct >= 3 || riskScore >= 35
            ? "AT_RISK"
            : "HEALTHY";

      return {
        id: branch.branch_id,
        branch: branch.branch_name,
        revenue,
        marginPct,
        riskScore,
        wastePct,
        efficiencyScore,
        status,
      };
    });
  }, [branchGrid, marginBranches]);

  const statusCounts = {
    healthy: rows.filter((row) => row.status === "HEALTHY").length,
    atRisk: rows.filter((row) => row.status === "AT_RISK").length,
    underperforming: rows.filter((row) => row.status === "UNDERPERFORMING")
      .length,
  };

  const compareMap = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );
  const compareDelta =
    compareA && compareB && compareA !== compareB
      ? (compareMap.get(compareA)?.efficiencyScore ?? 0) -
        (compareMap.get(compareB)?.efficiencyScore ?? 0)
      : 0;

  const columns = useMemo(
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
        header: t("branches.table.revenue"),
        cell: (info) => (
          <div className="inline-flex items-baseline gap-1">
            <span className="text-sm font-bold text-brand-gold tracking-tight">
              {toCurrency(info.getValue())}
            </span>
            <span className="text-xs text-text-muted font-medium">USD</span>
          </div>
        ),
      }),
      branchColumnHelper.accessor("marginPct", {
        header: t("branches.table.margin"),
        cell: (info) => (
          <span className="text-sm font-semibold text-status-success">
            {toPercent(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("riskScore", {
        header: t("branches.table.riskScore"),
        cell: (info) => {
          const value = info.getValue();
          const colorClass =
            value >= 65
              ? "text-status-critical"
              : value >= 35
                ? "text-status-warning"
                : "text-status-success";
          return (
            <span className={`text-sm font-bold ${colorClass}`}>
              {value.toFixed(0)}
            </span>
          );
        },
      }),
      branchColumnHelper.accessor("wastePct", {
        header: t("branches.table.wastePct"),
        cell: (info) => (
          <span className="text-sm font-semibold text-status-warning">
            {toPercent(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("efficiencyScore", {
        header: t("branches.table.efficiency"),
        cell: (info) => (
          <span className="text-sm font-medium text-text-secondary">
            {info.getValue().toFixed(1)}
          </span>
        ),
      }),
      branchColumnHelper.accessor("status", {
        header: t("common.status"),
        cell: (info) => {
          const status = info.getValue();
          const colorClass =
            status === "HEALTHY"
              ? "text-status-success bg-status-success/10 border-status-success/20"
              : status === "AT_RISK"
                ? "text-status-warning bg-status-warning/10 border-status-warning/20"
                : "text-status-critical bg-status-critical/10 border-status-critical/20";
          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${colorClass}`}
            >
              {status === "HEALTHY" ? t("branches.healthy") : status === "AT_RISK" ? t("branches.atRisk") : t("branches.underperforming")}
            </span>
          );
        },
      }),
      branchColumnHelper.display({
        id: "actions",
        header: t("branches.table.actions"),
        cell: (info) => {
          const row = info.row.original;
          const target = targetAdjustments[row.id] ?? 0;
          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(`/?branch=${row.id}`)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 bg-surface-3 px-3 text-xs font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold-hover active:scale-[0.98]"
              >
                {t("branches.table.open")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setTargetAdjustments((prev) => ({
                    ...prev,
                    [row.id]: target + 5,
                  }))
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-secondary transition-all duration-200 hover:border-surface-4 hover:bg-surface-2 hover:text-text-primary active:scale-[0.98]"
              >
                {t("branches.table.plus5Target")}
              </button>
              <Link
                href={`/workspace/settings?branch=${row.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-muted transition-all duration-200 hover:border-surface-4 hover:bg-surface-2 hover:text-text-secondary active:scale-[0.98]"
              >
                {t("branches.table.settings")}
              </Link>
            </div>
          );
        },
      }),
    ],
    [router, targetAdjustments],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <WorkspaceShell
      eyebrow={t("branches.eyebrow")}
      title={t("branches.title")}
      description={t("branches.description")}
      insight={t("branches.insight")}
    >
      <section className="grid grid-cols-1 gap-8 border-b border-surface-4 pb-12 mb-12 md:grid-cols-4">
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("branches.totalBranches")}
          </p>
          <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
            {rows.length}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">{t("branches.activeLocations")}</p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("branches.healthy")}
          </p>
          <p className="font-display text-4xl font-semibold text-status-success tracking-tight">
            {statusCounts.healthy}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">{t("branches.performingWell")}</p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("branches.atRisk")}
          </p>
          <p className="font-display text-4xl font-semibold text-status-warning tracking-tight">
            {statusCounts.atRisk}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">{t("branches.needsAttention")}</p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("branches.underperforming")}
          </p>
          <p className="font-display text-4xl font-semibold text-status-critical tracking-tight">
            {statusCounts.underperforming}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">{t("branches.criticalStatus")}</p>
          </div>
        </article>
      </section>

      <section className="mt-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("branches.performanceTitle")}
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            {t("branches.controlTable")}
          </h3>
        </div>

        <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <NativeTable
              table={table}
              tableClassName="w-full min-w-[1220px]"
              headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
              headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
              bodyRowClassName="align-top transition-all duration-200 hover:bg-surface-3/50"
              cellClassName="px-6 py-6"
            />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <article className="lg:col-span-2 bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-4">
              {t("branches.drillIn")}
            </p>
            <div className="space-y-3">
              {rows.slice(0, 5).map((row) => (
                <div
                  key={`drill-${row.id}`}
                  className="flex items-center justify-between pb-3 border-b border-surface-4 last:border-b-0 last:pb-0"
                >
                  <p className="text-sm font-semibold text-text-primary">
                    {row.branch}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {t("branches.table.revenue")} {toCurrency(row.revenue)} · {t("branches.table.margin")}{" "}
                    {toPercent(row.marginPct)} · {t("branches.table.riskScore")} {row.riskScore.toFixed(0)}
                  </p>
                </div>
              ))}
              {!rows.length ? (
                <p className="text-sm text-text-muted">
                  {t("branches.noBranchesFound")}
                </p>
              ) : null}
            </div>
          </article>

          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-4">
              {t("branches.compare")}
            </p>
            <div className="space-y-3">
              <select
                value={compareA}
                onChange={(event) => setCompareA(event.target.value)}
                className="h-10 w-full rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
              >
                <option value="">{t("branches.branchA")}</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.branch}
                  </option>
                ))}
              </select>
              <select
                value={compareB}
                onChange={(event) => setCompareB(event.target.value)}
                className="h-10 w-full rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
              >
                <option value="">{t("branches.branchB")}</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.branch}
                  </option>
                ))}
              </select>
              <div className="pt-3 mt-3 border-t border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">
                  {t("branches.efficiencyDelta")}
                </p>
                <p
                  className={`font-display text-3xl font-bold tracking-tight ${compareDelta >= 0 ? "text-status-success" : "text-status-critical"}`}
                >
                  {compareDelta >= 0 ? "+" : ""}
                  {compareDelta.toFixed(1)}
                </p>
              </div>
              {compareA || compareB ? (
                <div className="pt-4 mt-4 border-t border-surface-4 space-y-3 text-xs text-text-secondary">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        {t("branches.branchAAccuracy")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">
                        {compareMetricsA.data?.forecast_accuracy != null
                          ? `${compareMetricsA.data.forecast_accuracy.toFixed(1)}%`
                          : "—"}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {t("branches.quality")}{" "}
                        {compareQualityA.data?.overall_quality_score != null
                          ? `${compareQualityA.data.overall_quality_score.toFixed(0)}%`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        {t("branches.branchBAccuracy")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-text-primary">
                        {compareMetricsB.data?.forecast_accuracy != null
                          ? `${compareMetricsB.data.forecast_accuracy.toFixed(1)}%`
                          : "—"}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {t("branches.quality")}{" "}
                        {compareQualityB.data?.overall_quality_score != null
                          ? `${compareQualityB.data.overall_quality_score.toFixed(0)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <p>
                    {t("branches.compareNote")}
                  </p>
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </WorkspaceShell>
  );
}
