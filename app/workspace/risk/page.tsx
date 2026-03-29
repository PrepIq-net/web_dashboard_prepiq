"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useRiskSnapshot,
} from "@/services";

const EMPTY_LIST: never[] = [];

type RiskTab =
  | "OVERVIEW"
  | "STOCKOUT"
  | "WASTE"
  | "SUPPLY"
  | "VOLATILITY"
  | "NETWORK"
  | "ALERTS"
  | "TREND";

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function riskTone(score: number) {
  if (score >= 70) return "text-status-critical";
  if (score >= 45) return "text-status-warning";
  return "text-status-success";
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

function RiskPageContent() {
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

  const [activeTab, setActiveTab] = useState<RiskTab>("OVERVIEW");
  const [selectedBranchId, setSelectedBranchId] = useState(
    queryBranchId || (defaultBranch?.id ?? ""),
  );
  const [anchorDate, setAnchorDate] = useState(
    queryDate || new Date().toISOString().slice(0, 10),
  );

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

  const riskQuery = useRiskSnapshot({
    branch_id: selectedBranchId,
    target_date: anchorDate,
  });

  const risk = riskQuery.data;
  const breakdown = risk?.risk_score.breakdown;

  const trendSeries = useMemo(() => {
    const points = risk?.risk_trend ?? [];
    return {
      labels: points.map((row) => row.date.slice(5)),
      scores: points.map((row) => row.score),
    };
  }, [risk?.risk_trend]);

  return (
    <WorkspaceShell
      eyebrow={t("risk.eyebrow")}
      title={t("risk.title")}
      description={t("risk.description")}
      insight={t("risk.insight")}
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Select
            label={t("common.branch")}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("common.date")}
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
              className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 text-sm text-text-secondary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {t("financial.summary.title")}
            </label>
            <div className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 flex items-center text-sm text-text-secondary">
              {risk ? `${risk.branch_name} · ${risk.target_date}` : "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-surface-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "OVERVIEW", label: t("risk.tabs.overview") },
              { id: "STOCKOUT", label: t("risk.tabs.stockout") },
              { id: "WASTE", label: t("risk.tabs.waste") },
              { id: "SUPPLY", label: t("risk.tabs.supply") },
              { id: "VOLATILITY", label: t("risk.tabs.volatility") },
              { id: "NETWORK", label: t("risk.tabs.network") },
              { id: "ALERTS", label: t("risk.tabs.alerts") },
              { id: "TREND", label: t("risk.tabs.trend") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as RiskTab)}
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
        <section className="space-y-8">
          <div className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.overview.dailyScore")}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-text-muted">{t("risk.overview.kitchenLevel")}</p>
                <p className={`mt-1 text-3xl font-semibold ${riskTone(risk?.risk_score.score ?? 0)}`}>
                  {risk?.risk_score.level ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-muted">{t("risk.overview.score")}</p>
                <p className="mt-1 text-3xl font-semibold text-text-primary">
                  {risk?.risk_score.score ?? 0} / 100
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{t("risk.volatility.title")}</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">
                  {toPercent(breakdown?.demand_volatility ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.table.risk")}</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">
                  {toPercent(breakdown?.stock_risk ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{t("workspace.today.live.wasteRisk")}</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">
                  {toPercent(breakdown?.waste_risk ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{t("risk.supply.title")}</p>
                <p className="mt-2 text-xl font-semibold text-text-primary">
                  {toPercent(breakdown?.supply_risk ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.overview.calculationSignals")}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">{t("risk.overview.demandSignals")}</p>
                <p>{t("risk.overview.demandSignalsDetail")}</p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">{t("risk.overview.inventorySignals")}</p>
                <p>{t("risk.overview.inventorySignalsDetail")}</p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">{t("risk.overview.supplySignals")}</p>
                <p>{t("risk.overview.supplySignalsDetail")}</p>
              </div>
              <div className="rounded-lg border border-surface-4 bg-surface-3 p-4 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">{t("risk.overview.operationalSignals")}</p>
                <p>{t("risk.overview.operationalSignalsDetail")}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "STOCKOUT" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.stockout.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("risk.stockout.signalsTitle")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(risk?.stockout_forecast ?? []).length ? (
              risk?.stockout_forecast.map((item) => (
                <div key={item.item_id} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-text-primary">{item.item_title}</p>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                        item.risk === "HIGH"
                          ? "border-status-critical/40 text-status-critical"
                          : item.risk === "MEDIUM"
                            ? "border-status-warning/40 text-status-warning"
                            : "border-status-success/40 text-status-success"
                      }`}
                    >
                      {item.risk}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {t("risk.stockout.probability", { percent: toPercent(item.probability_pct) })}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-text-muted">
                    {item.reasons.map((reason, index) => (
                      <li key={`${item.item_id}-reason-${index}`}>• {reason}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    {t("workspace.today.context.suggested")} {item.suggested_action}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                {t("risk.stockout.noRisks")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "WASTE" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.waste.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("risk.waste.signalsTitle")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(risk?.waste_risk_forecast ?? []).length ? (
              risk?.waste_risk_forecast.map((item) => (
                <div key={item.item_id} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-text-primary">{item.item_title}</p>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                        item.risk === "HIGH"
                          ? "border-status-critical/40 text-status-critical"
                          : item.risk === "MEDIUM"
                            ? "border-status-warning/40 text-status-warning"
                            : "border-status-success/40 text-status-success"
                      }`}
                    >
                      {item.risk}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {t("risk.waste.projectedExcess", { quantity: item.projected_excess })}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-text-muted">
                    {item.drivers.map((reason, index) => (
                      <li key={`${item.item_id}-driver-${index}`}>• {reason}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    {t("workspace.today.context.suggested")} {item.suggested_action}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                {t("risk.waste.noRisks")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "SUPPLY" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.supply.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("risk.supply.signalsTitle")}
            </h3>
            {risk?.supply_risk?.data_note ? (
              <p className="mt-2 text-sm text-text-muted">{risk.supply_risk.data_note}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(risk?.supply_risk?.items ?? []).length ? (
              risk?.supply_risk.items.map((item) => (
                <div key={item.item_id} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-text-primary">{item.item_title}</p>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                        item.risk === "HIGH"
                          ? "border-status-critical/40 text-status-critical"
                          : item.risk === "MEDIUM"
                            ? "border-status-warning/40 text-status-warning"
                            : "border-status-success/40 text-status-success"
                      }`}
                    >
                      {item.risk}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-text-secondary">
                    <p>{t("risk.supply.currentStock", { quantity: item.current_stock, unit: item.unit })}</p>
                    <p>{t("risk.supply.expectedDepletion", { days: item.expected_depletion_days })}</p>
                    <p>{t("risk.supply.supplierLeadTime", { days: item.supplier_lead_time_days })}</p>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    {t("workspace.today.context.suggested")} {item.suggested_action}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                {t("risk.supply.noRisks")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "VOLATILITY" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.volatility.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("risk.volatility.signalsTitle")}
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(risk?.demand_volatility ?? []).length ? (
              risk?.demand_volatility.map((item) => (
                <div key={item.item_id} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-text-primary">{item.item_title}</p>
                    <span className="text-xs font-semibold text-text-muted">
                      {t("risk.volatility.confidence", { label: item.forecast_confidence })}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">
                    {t("risk.volatility.volatility", { percent: toPercent(item.volatility_pct) })}
                  </p>
                  <p className="mt-3 text-sm text-text-muted">{item.recent_pattern}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                {t("risk.volatility.noVolatility")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "NETWORK" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.network.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("risk.network.signalsTitle")}
            </h3>
          </div>
          {risk?.network_risk?.available ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(risk.network_risk.alerts ?? []).length ? (
                risk.network_risk.alerts?.map((alert) => (
                  <div key={alert.item_id} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                    <p className="text-lg font-semibold text-text-primary">{alert.item_title ?? t("workspace.today.table.item")}</p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {t("risk.network.wasteIncreasing", { count: alert.locations_affected })}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                      {t("risk.network.avgWasteChange", { percent: toPercent(alert.avg_waste_rate_change_pct) })}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-text-primary">
                      {t("workspace.today.context.suggested")} {alert.suggested_action}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                  {risk.network_risk.message ?? t("risk.network.noRisks")}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
              {risk?.network_risk?.message ?? t("risk.network.multipleBranchesRequired")}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "ALERTS" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.alerts.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("risk.alerts.signalsTitle")}
            </h3>
          </div>
          <div className="space-y-3">
            {(risk?.operational_alerts ?? []).length ? (
              risk?.operational_alerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-text-primary">{alert.title}</p>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                        alert.severity === "HIGH"
                          ? "border-status-critical/40 text-status-critical"
                          : alert.severity === "MEDIUM"
                            ? "border-status-warning/40 text-status-warning"
                            : "border-status-success/40 text-status-success"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{alert.detail}</p>
                  <p className="mt-3 text-sm font-semibold text-text-primary">
                    {t("workspace.today.context.suggested")} {alert.suggested_action}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-muted">
                {t("risk.alerts.noAlerts")}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "TREND" ? (
        <section>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("risk.trend.title")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {t("risk.trend.signalsTitle")}
            </h3>
          </div>
          <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
            {trendSeries.scores.length ? (
              <div>
                <svg viewBox="0 0 520 160" className="h-40 w-full">
                  <polyline
                    points={buildSparklinePoints(trendSeries.scores, 520, 160)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    className="text-brand-gold"
                  />
                </svg>
                <div className="mt-2 grid grid-cols-6 gap-2 text-[10px] text-text-muted">
                  {trendSeries.labels.slice(-6).map((label, index) => (
                    <div key={`${label}-${index}`}>
                      <p>{label}</p>
                      <p className="font-semibold text-text-secondary">
                        {(trendSeries.scores[Math.max(0, trendSeries.scores.length - 6 + index)] ?? 0).toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
                    <p className="text-sm text-text-muted">{t("risk.trend.noData")}</p>
            )}
          </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

export default function RiskPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          {t("risk.loading")}
        </div>
      }
    >
      <RiskPageContent />
    </Suspense>
  );
}
