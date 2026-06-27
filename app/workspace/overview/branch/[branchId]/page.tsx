"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ArrowLeft } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
} from "@/services";
import { useBranchDayToday } from "@/services/production-intelligence/hooks";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";

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

function isDiscreteUnit(unit: string) {
  return ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    (unit || "").toUpperCase(),
  );
}

function formatQuantity(value: number, unit: string) {
  if (isDiscreteUnit(unit)) return `${Math.round(value)} ${unit}`;
  return `${value.toFixed(2)} ${unit}`;
}

function BranchOverviewSnapshotContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ branchId: string }>();
  const searchParams = useSearchParams();
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchId = String(params?.branchId ?? "");
  const { tier, planType, isLoading: tierLoading, shouldBlockAccess, gateVariant } = useSubscriptionTier(branchId || undefined);
  const initialDate =
    searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const [targetDate, setTargetDate] = useState(initialDate);

  const allowedBranchIds = useMemo(
    () =>
      new Set((accessScope?.accessible_branches ?? []).map((row) => row.id)),
    [accessScope?.accessible_branches],
  );

  useEffect(() => {
    if (!branchId || !accessScope) return;
    if (!allowedBranchIds.has(branchId)) {
      router.replace("/workspace/overview");
    }
  }, [accessScope, allowedBranchIds, branchId, router]);

  const todayQuery = useBranchDayToday(
    { branch_id: branchId, date: targetDate },
    Boolean(branchId),
  );
  const branchDay = todayQuery.data;

  const riskLabel = useCallback(
    (value: number) => {
      if (value >= 0.45) return t("workspace.overview.branch.risk_high");
      if (value >= 0.25) return t("workspace.overview.branch.risk_medium");
      return t("workspace.overview.branch.risk_low");
    },
    [t],
  );

  const summary = useMemo(() => {
    if (!branchDay) {
      return {
        items: 0,
        projectedMargin: 0,
        prepCost: 0,
        riskExposure: 0,
        protectedMargin: 0,
        accepted: 0,
        overrides: 0,
      };
    }
    const rows = branchDay.prep_plan_items;
    const items = rows.length;
    const projectedMargin =
      branchDay.morning_overview?.projected_margin_total ?? 0;
    const prepCost = branchDay.morning_overview?.estimated_total_prep_cost ?? 0;
    const riskExposure = rows.reduce((sum, row) => {
      const riskScore = Math.max(
        row.forecast_context.risk_of_stockout,
        row.forecast_context.risk_of_waste,
      );
      return sum + row.forecast_context.projected_margin * riskScore;
    }, 0);
    const protectedMargin = Math.max(0, projectedMargin - riskExposure);
    const accepted = rows.filter(
      (row) => row.decision === "ACCEPTED_AI" || row.accepted_suggestion,
    ).length;
    const overrides = rows.filter(
      (row) => row.decision === "CHEF_OVERRIDE",
    ).length;
    return {
      items,
      projectedMargin,
      prepCost,
      riskExposure,
      protectedMargin,
      accepted,
      overrides,
    };
  }, [branchDay]);

  const branchName =
    branchDay?.branch_name ??
    accessScope?.accessible_branches?.find((row) => row.id === branchId)
      ?.name ??
    t("workspace.overview.branch.fallback_name");

  if (userLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
      </main>
    );
  }

  if (branchId && !tierLoading && shouldBlockAccess) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.overview.branch.eyebrow")}
        title={`${branchName} ${t("workspace.overview.branch.title_snapshot")}`}
        description={t("workspace.overview.branch.description")}
        insight={t("workspace.overview.branch.insight")}
      >
        <SubscriptionRequiredState variant={gateVariant} compact />
      </WorkspaceShell>
    );
  }

  if (!tierLoading && tier < 3) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.overview.branch.eyebrow")}
        title={`${branchName} ${t("workspace.overview.branch.title_snapshot")}`}
        description={t("workspace.overview.branch.description")}
        insight={t("workspace.overview.branch.insight")}
      >
        <SubscriptionRequiredState variant="command_required" currentPlanType={planType} compact />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t("workspace.overview.branch.eyebrow")}
      title={`${branchName} ${t("workspace.overview.branch.title_snapshot")}`}
      description={t("workspace.overview.branch.description")}
      insight={t("workspace.overview.branch.insight")}
    >
      <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/workspace/overview"
            className="inline-flex h-9 items-center gap-1 rounded-full border border-surface-4 px-3 text-xs font-semibold text-text-secondary hover:border-brand-gold hover:text-brand-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("workspace.overview.branch.back_to_overview")}
          </Link>
        </div>
        <div className="relative w-full max-w-[220px]">
          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="h-10 w-full rounded-full border border-surface-4 bg-surface-2 pl-10 pr-3 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30"
          />
        </div>
      </section>

      {todayQuery.isLoading ? (
        <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5 text-sm text-text-secondary">
          {t("workspace.overview.branch.loading")}
        </section>
      ) : null}

      {todayQuery.isError ? (
        <section className="rounded-xl border border-status-warning/40 bg-status-warning/10 px-5 py-5">
          <p className="text-sm font-semibold text-text-primary">
            {t("workspace.overview.branch.no_day_title")}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {t("workspace.overview.branch.no_day_description", {
              date: targetDate,
            })}
          </p>
        </section>
      ) : null}

      {branchDay ? (
        <>
          <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.overview.branch.current_phase")}
              </p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                {branchDay.status}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {t("workspace.overview.branch.plan_lock", {
                  status: branchDay.plan_lock?.is_locked
                    ? t("workspace.overview.branch.locked")
                    : t("workspace.overview.branch.open"),
                })}
              </p>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {t("workspace.overview.branch.projected_margin")}
              </p>
              <p className="mt-1 text-xl font-semibold text-status-success">
                {formatCurrency(summary.projectedMargin)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {t("workspace.overview.branch.prep_cost_estimate", {
                  cost: formatCurrency(summary.prepCost),
                })}
              </p>
            </article>
            <article className="rounded-xl border border-status-warning/35 bg-status-warning/10 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-status-warning">
                {t("workspace.overview.branch.margin_at_risk")}
              </p>
              <p className="mt-1 text-xl font-semibold text-status-warning">
                {formatCurrency(summary.riskExposure)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {t("workspace.overview.branch.risk_description")}
              </p>
            </article>
            <article className="rounded-xl border border-status-success/35 bg-status-success/10 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-status-success">
                {t("workspace.overview.branch.projected_protected_margin")}
              </p>
              <p className="mt-1 text-xl font-semibold text-status-success">
                {formatCurrency(summary.protectedMargin)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {t("workspace.overview.branch.ai_accepted", {
                  count: summary.accepted,
                })}{" "}
                ·{" "}
                {t("workspace.overview.branch.chef_overrides", {
                  count: summary.overrides,
                })}
              </p>
            </article>
          </section>

          <section className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.overview.branch.daily_projection")}
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                {t("workspace.overview.branch.expected_demand_delta_label")}{" "}
                <span className="font-semibold text-text-primary">
                  {(
                    branchDay.demand_signal.expected_demand_delta_pct ?? 0
                  ).toFixed(1)}
                  %
                </span>{" "}
                {t("workspace.overview.branch.vs_typical", {
                  day:
                    branchDay.demand_signal.typical_day_label ??
                    t("workspace.overview.branch.typical_day"),
                })}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {t("workspace.overview.branch.forecast_confidence_label")}{" "}
                <span className="font-semibold text-text-primary">
                  {percent(branchDay.forecast_confidence)}
                </span>
              </p>
              <div className="mt-3 space-y-2">
                {(branchDay.demand_signal.signals ?? []).map((signal) => (
                  <div
                    key={signal.key}
                    className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-2 text-xs"
                  >
                    <p className="font-semibold text-text-primary">
                      {signal.label}
                    </p>
                    <p className="mt-0.5 text-text-secondary">
                      {signal.direction === "neutral"
                        ? t("workspace.overview.branch.signal_neutral")
                        : `${signal.value_pct >= 0 ? "+" : ""}${signal.value_pct.toFixed(1)}%`}{" "}
                      · {signal.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.overview.branch.ai_operations_commentary")}
              </p>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                <p>
                  {t("workspace.overview.branch.tracked_items", {
                    count: summary.items,
                  })}
                </p>
                <p>
                  {t("workspace.overview.branch.high_risk_items", {
                    count:
                      branchDay.morning_overview?.high_risk_items ??
                      branchDay.demand_signal.high_risk_items ??
                      0,
                  })}
                </p>
                <p>
                  {t(
                    "workspace.overview.branch.forecast_quality_signal_label",
                  )}{" "}
                  <span className="font-semibold text-text-primary">
                    {branchDay.demand_signal.confidence_label ??
                      t("workspace.overview.branch.na")}
                  </span>{" "}
                  ({percent(branchDay.demand_signal.forecast_confidence)})
                </p>
                <p>
                  {t("workspace.overview.branch.ai_focus_advice")}
                </p>
                <p>
                  {t("workspace.overview.branch.ai_focus_detail")}
                </p>
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.overview.branch.branch_item_plan")}
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
              {t("workspace.overview.branch.item_plan_subtitle")}
            </h3>
            <div className="mt-4 space-y-3 lg:hidden">
              {branchDay.prep_plan_items.map((item) => {
                const planned =
                  item.planned_quantity ?? item.suggested_quantity;
                const riskScore = Math.max(
                  item.forecast_context.risk_of_stockout,
                  item.forecast_context.risk_of_waste,
                );
                return (
                  <article
                    key={`mobile-${item.id}`}
                    className="rounded-xl border border-surface-4 bg-surface-3/35 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {item.product_title}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {item.forecast_context.reasoning[0] ??
                            t("workspace.overview.branch.no_reasoning")}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full border border-surface-4 px-2 py-1 text-[11px] font-semibold text-text-secondary">
                        {riskLabel(riskScore)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-surface-4 bg-surface-2/70 px-3 py-2">
                        <p className="text-text-muted">
                          {t("workspace.overview.branch.forecast_label")}
                        </p>
                        <p className="mt-1 font-semibold text-text-primary">
                          {formatQuantity(item.suggested_quantity, item.unit)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-surface-4 bg-surface-2/70 px-3 py-2">
                        <p className="text-text-muted">
                          {t("workspace.overview.branch.planned_label")}
                        </p>
                        <p className="mt-1 font-semibold text-text-primary">
                          {formatQuantity(planned, item.unit)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-surface-4 bg-surface-2/70 px-3 py-2">
                        <p className="text-text-muted">
                          {t("workspace.overview.branch.confidence_label")}
                        </p>
                        <p className="mt-1 font-semibold text-text-primary">
                          {percent(item.forecast_context.confidence_score)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-surface-4 bg-surface-2/70 px-3 py-2">
                        <p className="text-text-muted">
                          {t("workspace.overview.branch.projected_margin_label")}
                        </p>
                        <p className="mt-1 font-semibold text-status-success">
                          {formatCurrency(
                            item.forecast_context.projected_margin,
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-text-secondary">
                      {t("workspace.overview.branch.stockout_risk", {
                        pct: percent(item.forecast_context.risk_of_stockout),
                      })}{" "}
                      ·{" "}
                      {t("workspace.overview.branch.waste_risk", {
                        pct: percent(item.forecast_context.risk_of_waste),
                      })}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {t("workspace.overview.branch.decision_label")}{" "}
                      {item.decision === "CHEF_OVERRIDE"
                        ? t("workspace.overview.branch.chef_override")
                        : t("workspace.overview.branch.ai_aligned")}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-4 hidden overflow-x-auto border-y border-surface-4/60 lg:block">
              <table className="w-full min-w-[1020px]">
                <thead className="border-b border-surface-4/70">
                  <tr>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.overview.branch.table_header_item")}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.overview.branch.table_header_forecast")}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.overview.branch.table_header_planned")}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.overview.branch.table_header_confidence")}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t("workspace.overview.branch.table_header_risk")}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t(
                        "workspace.overview.branch.table_header_projected_margin",
                      )}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                      {t(
                        "workspace.overview.branch.table_header_ai_reasoning",
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4/55">
                  {branchDay.prep_plan_items.map((item) => {
                    const planned =
                      item.planned_quantity ?? item.suggested_quantity;
                    const riskScore = Math.max(
                      item.forecast_context.risk_of_stockout,
                      item.forecast_context.risk_of_waste,
                    );
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-3 text-sm font-medium text-text-primary">
                          {item.product_title}
                        </td>
                        <td className="px-3 py-3 text-sm text-text-secondary">
                          {formatQuantity(item.suggested_quantity, item.unit)}
                        </td>
                        <td className="px-3 py-3 text-sm text-text-secondary">
                          {formatQuantity(planned, item.unit)}
                          <span className="ml-2 text-xs text-text-muted">
                            (
                            {item.decision === "CHEF_OVERRIDE"
                              ? t("workspace.overview.branch.override")
                              : t("workspace.overview.branch.ai_aligned_inline")}
                            )
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-text-secondary">
                          {percent(item.forecast_context.confidence_score)}
                        </td>
                        <td className="px-3 py-3 text-sm text-text-secondary">
                          {riskLabel(riskScore)}
                          <span className="ml-2 text-xs text-text-muted">
                            {t("workspace.overview.branch.stockout_abbr")}{" "}
                            {percent(
                              item.forecast_context.risk_of_stockout,
                            )}{" "}
                            · {t("workspace.overview.branch.waste_abbr")}{" "}
                            {percent(item.forecast_context.risk_of_waste)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-status-success">
                          {formatCurrency(
                            item.forecast_context.projected_margin,
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-text-secondary">
                          {item.forecast_context.reasoning[0] ??
                            t("workspace.overview.branch.no_reasoning")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </WorkspaceShell>
  );
}

export default function BranchOverviewSnapshotPage() {
  return (
    <Suspense fallback={null}>
      <BranchOverviewSnapshotContent />
    </Suspense>
  );
}
