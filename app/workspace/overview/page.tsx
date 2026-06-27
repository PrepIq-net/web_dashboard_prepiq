"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shop, Calendar } from "iconoir-react";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
} from "@/services";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useOwnerNetworkIntelligenceInsights,
  useForecastMetrics,
  useDataQualityReport,
} from "@/services/production-intelligence/hooks";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { useTranslation } from "@/lib/i18n";

const EMPTY_LIST: never[] = [];

function percent(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumberishCurrency(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isNaN(parsed)) return "$0";
  return formatCurrency(parsed);
}

export default function WorkspaceOverviewPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const { tier, planType, isLoading: tierLoading } = useSubscriptionTier();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;

  const branchOptions = useMemo(() => {
    const accessibleBranchIds = new Set(
      accessibleBranches.map((branch) => branch.id),
    );
    const byId = new Map<string, (typeof branches)[number]>();
    for (const branch of branches) {
      byId.set(branch.id, branch);
    }
    for (const branch of accessibleBranches) {
      if (byId.has(branch.id)) continue;
      byId.set(branch.id, {
        id: branch.id,
        organization: user?.organization_id ?? "",
        organization_name: user?.organization_name ?? "",
        name: branch.name,
        code: "",
        address: "",
        phone: null,
        email: null,
        timezone: "UTC",
        is_primary: branch.is_primary,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    const merged = Array.from(byId.values());
    if (!accessibleBranchIds.size) return merged;
    return merged.filter((branch) => accessibleBranchIds.has(branch.id));
  }, [
    branches,
    accessibleBranches,
    user?.organization_id,
    user?.organization_name,
  ]);

  const defaultBranch =
    branchOptions.find(
      (branch) => branch.id === accessScope?.default_branch_id,
    ) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  const [targetDate, setTargetDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [branchId, setBranchId] = useState(defaultBranch?.id ?? "");

  useEffect(() => {
    if (!branchId && defaultBranch?.id) {
      setBranchId(defaultBranch.id);
    }
  }, [branchId, defaultBranch?.id]);

  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.VIEW_ALL_BRANCHES) || permissions.has(PERMISSIONS.MANAGE_BRANCHES);
  useEffect(() => {
    if (!userLoading && !canAccess) {
      router.replace("/");
    }
  }, [canAccess, router, userLoading]);

  const shouldHold =
    userLoading || (Boolean(user?.has_organization) && branchesQuery.isLoading);
  const hasBranches = (branchOptions.length ?? 0) > 0;
  const shouldShowBranchRequiredState =
    !userLoading &&
    Boolean(user?.has_organization) &&
    !hasBranches &&
    !branchesQuery.isLoading;

  const executiveQuery = useExecutiveControlTower(
    branchId ? { branch_id: branchId, target_date: targetDate } : undefined,
    Boolean(branchId),
  );
  const marginQuery = useOwnerMarginProtectionReport(
    branchId ? { branch_id: branchId, target_date: targetDate } : undefined,
    Boolean(branchId),
  );
  const metricsQuery = useForecastMetrics(
    branchId ? { branch_id: branchId, lookback_days: 60 } : undefined,
    Boolean(branchId),
  );
  const dataQualityQuery = useDataQualityReport(
    branchId ? { branch_id: branchId, days_window: 30 } : undefined,
    Boolean(branchId),
  );
  const organizationNetworkQuery = useOwnerNetworkIntelligenceInsights(
    user?.organization_id
      ? {
          organization_id: user.organization_id,
          target_date: targetDate,
          lookback_days: 30,
        }
      : undefined,
    Boolean(user?.organization_id),
  );

  const networkInsights = useMemo(() => {
    return (organizationNetworkQuery.data?.top_network_insights ?? [])
      .slice(0, 3)
      .map((row) => ({
        title: row.title,
        detail: t("dashboard.overview.observedInKitchens", { count: row.observed_in_kitchens }),
        confidence: row.confidence,
      }));
  }, [organizationNetworkQuery.data?.top_network_insights, t]);
  const locationRows = useMemo(() => {
    return (
      organizationNetworkQuery.data?.location_performance ??
      executiveQuery.data?.branch_grid ??
      []
    ).map((row) => {
      const rowRecord = row as Record<string, unknown>;
      const branchIdValue = String(rowRecord.branch_id ?? "");
      const branchNameValue = String(rowRecord.branch_name ?? "Branch");
      const marginRow = (marginQuery.data?.branches ?? []).find(
        (item) => item.branch_id === branchIdValue,
      );
      const revenueValue =
        typeof rowRecord.revenue === "number"
          ? rowRecord.revenue
          : typeof rowRecord.net_impact === "number"
            ? rowRecord.net_impact
            : 0;
      const wasteText =
        typeof rowRecord.waste_pct === "number"
          ? `${rowRecord.waste_pct.toFixed(1)}%`
          : formatCurrency(
              typeof rowRecord.waste_cost === "number"
                ? rowRecord.waste_cost
                : 0,
            );
      const forecastText =
        typeof rowRecord.forecast_accuracy === "number"
          ? `${rowRecord.forecast_accuracy.toFixed(1)}%`
          : typeof marginRow?.forecast_accuracy_summary === "number"
            ? `${marginRow.forecast_accuracy_summary.toFixed(1)}%`
            : "N/A";
      return {
        branchId: branchIdValue,
        branchName: branchNameValue,
        revenueValue,
        wasteText,
        forecastText,
        marginSignal: marginRow?.margin_signal_status ?? "N/A",
      };
    });
  }, [
    organizationNetworkQuery.data?.location_performance,
    executiveQuery.data?.branch_grid,
    marginQuery.data?.branches,
  ]);

  if (shouldHold) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted animate-pulse">
            {t("dashboard.overview.loading")}
          </p>
        </div>
      </main>
    );
  }

  if (shouldShowBranchRequiredState) {
    return <BranchRequiredState />;
  }

  if (!tierLoading && tier < 3) {
    return (
      <WorkspaceShell
        eyebrow={t("dashboard.overview.eyebrow")}
        title={t("dashboard.overview.title")}
        description={t("dashboard.overview.description")}
        insight={t("dashboard.overview.insight")}
      >
        <SubscriptionRequiredState variant="command_required" currentPlanType={planType} compact />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t("dashboard.overview.eyebrow")}
      title={t("dashboard.overview.title")}
      description={t("dashboard.overview.description")}
      insight={t("dashboard.overview.insight")}
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Select
            label={t("dashboard.overview.anchorBranch")}
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={branchId}
            onChange={setBranchId}
            disabled={!branchOptions.length}
            placeholder={
              !branchOptions.length ? t("dashboard.overview.noBranches") : t("dashboard.overview.selectBranch")
            }
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("dashboard.overview.date")}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="h-12 w-full rounded-button border border-border-default bg-surface-3 pl-10 pr-3 text-sm text-text-primary transition-all duration-200 hover:bg-surface-4 focus:outline-none focus:ring-1 focus:border-brand-gold focus:ring-brand-gold/20"
              />
            </div>
          </div>
          <article className="rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gold">
              {t("dashboard.overview.suggestedAction")}
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {organizationNetworkQuery.data?.top_network_insights?.[0]
                ?.suggested_action ??
                t("dashboard.overview.noAction")}
            </p>
          </article>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("dashboard.overview.forecastAccuracy")}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-text-primary">
            {metricsQuery.data?.forecast_accuracy != null
              ? `${metricsQuery.data.forecast_accuracy.toFixed(1)}%`
              : "—"}
          </p>
          <p className="text-xs text-text-secondary">
            {metricsQuery.data?.summary ?? t("dashboard.overview.awaitingMetrics")}
          </p>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("dashboard.overview.errorMetrics")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.overview.mape")}
              </p>
              <p className="mt-1 font-semibold text-text-primary">
                {metricsQuery.data?.mape != null
                  ? `${metricsQuery.data.mape.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/40 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.overview.rmse")}
              </p>
              <p className="mt-1 font-semibold text-text-primary">
                {metricsQuery.data?.rmse != null
                  ? metricsQuery.data.rmse.toFixed(2)
                  : "—"}
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs text-text-secondary">
            {t("dashboard.overview.stockout")} {metricsQuery.data?.stockout_rate?.toFixed(1) ?? "—"}% ·
            {t("dashboard.overview.waste")} {metricsQuery.data?.waste_rate?.toFixed(1) ?? "—"}%
          </div>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("dashboard.overview.dataQuality")}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-text-primary">
            {dataQualityQuery.data?.overall_quality_score != null
              ? `${dataQualityQuery.data.overall_quality_score.toFixed(0)}%`
              : "—"}
          </p>
          <p className="text-xs text-text-secondary">
            {dataQualityQuery.data?.quality_label ?? t("dashboard.overview.noQualityScore")}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {dataQualityQuery.data?.recommendation ??
              t("dashboard.overview.qualityChecks")}
          </p>
        </article>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("dashboard.overview.networkIntelligence")}
          </p>
          <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
            {t("dashboard.overview.topNetworkInsights")}
          </h3>
          {networkInsights.length ? (
            <div className="mt-3 space-y-2">
              {networkInsights.map((row) => (
                <div
                  key={`${row.title}-${row.detail}`}
                  className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-3"
                >
                  <p className="text-sm font-semibold text-text-primary">
                    {row.title}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {row.detail}
                    {typeof row.confidence === "number"
                      ? ` ${t("dashboard.overview.confidence")} ${percent(row.confidence)}.`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              {t("dashboard.overview.noInsights")}
            </p>
          )}
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("dashboard.overview.enterpriseValue")}
          </p>
          <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
            {t("dashboard.overview.crossLocationSnapshot")}
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.overview.locations")}
              </p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                {organizationNetworkQuery.data?.summary.branch_count ??
                  executiveQuery.data?.branch_count ??
                  0}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.overview.forecastAccuracy7d")}
              </p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                {percent(
                  executiveQuery.data?.summary?.forecast_accuracy_rolling_7d ??
                    0,
                )}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.overview.wasteRisk")}
              </p>
              <p className="mt-1 text-xl font-semibold text-status-warning">
                {(executiveQuery.data?.summary?.waste_risk_pct ?? 0).toFixed(1)}
                %
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.overview.totalWasteCost")}
              </p>
              <p className="mt-1 text-xl font-semibold text-status-critical">
                {formatNumberishCurrency(
                  marginQuery.data?.summary?.total_waste_cost,
                )}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3 col-span-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.overview.lifecycle")}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {t("dashboard.overview.candidate")} {organizationNetworkQuery.data?.summary.candidate_patterns ?? 0}
                {" · "}{t("dashboard.overview.validated")} {organizationNetworkQuery.data?.summary.validated_patterns ?? 0}
                {" · "}{t("dashboard.overview.deployed")} {organizationNetworkQuery.data?.summary.deployed_patterns ?? 0}
                {" · "}{t("dashboard.overview.freshness")} {percent(organizationNetworkQuery.data?.summary.average_freshness_score ?? 0)}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
          {t("dashboard.overview.locationPerformance")}
        </p>
        <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
          {t("dashboard.overview.sharedPatterns")}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {t("dashboard.overview.locationPerformanceDesc")}
        </p>
        <div className="mt-4 space-y-3 lg:hidden">
          {locationRows.map((row) => (
            <article
              key={`mobile-${row.branchId}`}
              className="rounded-xl border border-surface-4 bg-surface-3/30 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {row.branchName}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("dashboard.overview.forecast")} {row.forecastText} · {t("dashboard.overview.marginSignal")}{" "}
                    {row.marginSignal}
                  </p>
                </div>
                <Link
                  href={`/workspace/overview/branch/${row.branchId}?date=${targetDate}`}
                  className="inline-flex h-8 items-center rounded-full border border-brand-gold/45 px-3 text-xs font-semibold text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10"
                >
                  {t("dashboard.overview.open")}
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-surface-4 bg-surface-2/70 px-3 py-2">
                  <p className="text-text-muted">{t("dashboard.overview.revenue")}</p>
                  <p className="mt-1 font-semibold text-text-primary">
                    {formatCurrency(row.revenueValue)}
                  </p>
                </div>
                <div className="rounded-lg border border-surface-4 bg-surface-2/70 px-3 py-2">
                  <p className="text-text-muted">{t("dashboard.overview.waste")}</p>
                  <p className="mt-1 font-semibold text-status-warning">
                    {row.wasteText}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto border-y border-surface-4/60">
          <table className="hidden w-full min-w-[860px] lg:table">
            <thead className="border-b border-surface-4/70">
              <tr>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                  {t("dashboard.overview.table.location")}
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                  {t("dashboard.overview.table.revenue")}
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                  {t("dashboard.overview.table.wastePct")}
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                  {t("dashboard.overview.table.forecastAccuracy")}
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                  {t("dashboard.overview.table.marginSignal")}
                </th>
                <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                  {t("dashboard.overview.table.branchView")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-4/55">
              {locationRows.map((row) => {
                return (
                  <tr key={row.branchId}>
                    <td className="px-3 py-3 text-sm font-medium text-text-primary">
                      {row.branchName}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {formatCurrency(row.revenueValue)}
                    </td>
                    <td className="px-3 py-3 text-sm text-status-warning">
                      {row.wasteText}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {row.forecastText}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {row.marginSignal}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/workspace/overview/branch/${row.branchId}?date=${targetDate}`}
                        className="inline-flex h-8 items-center rounded-full border border-brand-gold/45 px-3 text-xs font-semibold text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10"
                      >
                        {t("dashboard.overview.open")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspaceShell>
  );
}
