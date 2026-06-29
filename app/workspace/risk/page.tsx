"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useBranchDayToday,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useRiskSnapshot,
} from "@/services";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { useTranslation } from "@/lib/i18n";

const EMPTY_LIST: never[] = [];
const TODAY = new Date().toISOString().slice(0, 10);

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function riskBadgeClasses(level: string) {
  if (level === "HIGH")
    return "border-status-critical/30 bg-status-critical/10 text-status-critical";
  if (level === "MEDIUM")
    return "border-status-warning/30 bg-status-warning/10 text-status-warning";
  return "border-status-success/30 bg-status-success/10 text-status-success";
}

function alertRowClasses(level: string) {
  if (level === "HIGH") return "border-l-status-critical bg-status-critical/8";
  if (level === "MEDIUM") return "border-l-status-warning bg-status-warning/8";
  return "border-l-status-success/50 bg-status-success/5";
}

function scoreToneClass(score: number) {
  if (score >= 70) return "text-status-critical";
  if (score >= 45) return "text-status-warning";
  return "text-status-success";
}

function confidenceToneClass(value: number) {
  if (value >= 0.75) return "text-status-success";
  if (value >= 0.5) return "text-status-warning";
  return "text-status-critical";
}

function confidenceBarClass(value: number) {
  if (value >= 0.7) return "bg-status-success";
  if (value >= 0.45) return "bg-status-warning";
  return "bg-status-critical";
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="text-xs font-semibold text-text-primary">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-4">
        <div
          className={`h-full rounded-full transition-all ${confidenceBarClass(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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

  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.VIEW_COMPLIANCE);
  const canViewAllBranches = Boolean(accessScope?.can_view_all_branches);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const scopedBranchIds = new Set(accessibleBranches.map((b) => b.id));

  const branchOptions = useMemo(() => {
    if (canViewAllBranches) return branches;
    if (accessibleBranches.length) {
      if (!branches.length) return accessibleBranches;
      return branches.filter((b) => scopedBranchIds.has(b.id));
    }
    return [];
  }, [accessibleBranches, branches, canViewAllBranches, scopedBranchIds]);

  const defaultBranch =
    branchOptions.find((b) => b.id === accessScope?.default_branch_id) ??
    branchOptions.find((b) => b.is_primary) ??
    branchOptions[0] ??
    null;

  const queryBranchId = searchParams.get("branch") ?? "";
  const queryDate = searchParams.get("date") ?? "";

  const [selectedBranchId, setSelectedBranchId] = useState(
    queryBranchId || (defaultBranch?.id ?? ""),
  );
  const [anchorDate, setAnchorDate] = useState(queryDate || TODAY);

  const {
    tier,
    planType,
    isLoading: tierLoading,
    shouldBlockAccess,
    gateVariant,
  } = useSubscriptionTier(selectedBranchId || undefined);

  useEffect(() => {
    if (!selectedBranchId && defaultBranch?.id) setSelectedBranchId(defaultBranch.id);
  }, [defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!branchOptions.length || !selectedBranchId) return;
    const allowed = branchOptions.some((b) => b.id === selectedBranchId);
    if (!allowed && defaultBranch?.id) setSelectedBranchId(defaultBranch.id);
  }, [branchOptions, defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!isLoading && !canAccess) router.replace("/");
  }, [isLoading, canAccess, router]);

  const riskQuery = useRiskSnapshot({
    branch_id: selectedBranchId,
    target_date: anchorDate,
  });
  const risk = riskQuery.data;
  const breakdown = risk?.risk_score.breakdown;

  const isToday = anchorDate === TODAY;
  const canFetchToday =
    isToday && Boolean(selectedBranchId) && !tierLoading && !shouldBlockAccess;
  const branchDayQuery = useBranchDayToday(
    { branch_id: selectedBranchId, date: TODAY },
    canFetchToday,
  );
  const branchDay = branchDayQuery.data;
  const systemHealth = branchDay?.system_health;
  const confidenceBreakdown = branchDay?.demand_signal?.confidence_breakdown;
  const forecastConfidence = branchDay?.demand_signal?.forecast_confidence;

  const trendSeries = useMemo(() => {
    const points = risk?.risk_trend ?? [];
    return {
      labels: points.map((row) => row.date.slice(5)),
      scores: points.map((row) => row.score),
    };
  }, [risk?.risk_trend]);

  // Merge stockout + waste into one prioritized list, drop LOW
  const allItemRisks = useMemo(() => {
    type ItemRisk = {
      key: string;
      title: string;
      risk: string;
      detail: string;
      action: string;
    };
    const items: ItemRisk[] = [];
    for (const s of risk?.stockout_forecast ?? []) {
      if (s.risk === "LOW") continue;
      items.push({
        key: `stockout-${s.item_id}`,
        title: s.item_title,
        risk: s.risk,
        detail: t("workspace.risk.stockoutDetail", {
          pct: toPercent(s.probability_pct),
          reason: s.reasons.length ? ` · ${s.reasons[0]}` : "",
        }),
        action: s.suggested_action,
      });
    }
    for (const w of risk?.waste_risk_forecast ?? []) {
      if (w.risk === "LOW") continue;
      items.push({
        key: `waste-${w.item_id}`,
        title: w.item_title,
        risk: w.risk,
        detail: t("workspace.risk.excessDetail", {
          count: w.projected_excess,
          driver: w.drivers.length ? ` · ${w.drivers[0]}` : "",
        }),
        action: w.suggested_action,
      });
    }
    const rank = (r: string) => (r === "HIGH" ? 0 : r === "MEDIUM" ? 1 : 2);
    return items.sort((a, b) => rank(a.risk) - rank(b.risk));
  }, [risk, t]);

  return (
    <WorkspaceShell
      eyebrow={t("workspace.risk.eyebrow")}
      title={t("workspace.risk.title")}
      description={t("workspace.risk.description")}
      insight=""
    >
      {/* ── Context bar ── */}
      <div className="mb-8 flex flex-wrap items-end gap-4 border-b border-surface-4/60 pb-6">
        <div className="min-w-45 flex-1 max-w-xs">
          <Select
            label={t("workspace.risk.filterBranch")}
            options={branchOptions.map((b) => ({ value: b.id, label: b.name }))}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">
            {t("workspace.risk.filterDate")}
          </label>
          <input
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="h-10 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-secondary focus:outline-none focus-visible:border-brand-gold"
          />
        </div>
        {risk ? (
          <p className="pb-1 text-xs text-text-muted">
            {risk.branch_name} · {risk.target_date}
          </p>
        ) : null}
      </div>

      {selectedBranchId && !tierLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : !tierLoading && tier < 3 ? (
        <SubscriptionRequiredState
          variant="command_required"
          currentPlanType={planType}
          compact
        />
      ) : (
        <div className="space-y-10">

          {/* ── 1. System health banner (today only, non-GREEN) ── */}
          {systemHealth && systemHealth.readiness !== "GREEN" ? (
            <div
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                systemHealth.readiness === "RED"
                  ? "border-status-critical/35 bg-status-critical/8"
                  : "border-status-warning/35 bg-status-warning/8"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  systemHealth.readiness === "RED"
                    ? "bg-status-critical"
                    : "bg-status-warning animate-pulse"
                }`}
              />
              <p
                className={`text-sm font-medium ${
                  systemHealth.readiness === "RED"
                    ? "text-status-critical"
                    : "text-status-warning"
                }`}
              >
                {systemHealth.note}
              </p>
            </div>
          ) : null}

          {/* ── 2. Risk score strip ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.risk.dailyRiskScore")}
            </p>
            <div className="mt-3 flex flex-wrap items-start gap-6">
              <div className="min-w-25">
                <p
                  className={`text-3xl font-semibold ${scoreToneClass(risk?.risk_score.score ?? 0)}`}
                >
                  {risk?.risk_score.level ?? "—"}
                </p>
                <p className="mt-0.5 text-sm text-text-muted">
                  {t("workspace.risk.scoreOutOf", { score: risk?.risk_score.score ?? 0 })}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: t("workspace.risk.demandVolatility"), value: breakdown?.demand_volatility ?? 0 },
                  { label: t("workspace.risk.stockRisk"), value: breakdown?.stock_risk ?? 0 },
                  { label: t("workspace.risk.wasteRisk"), value: breakdown?.waste_risk ?? 0 },
                  { label: t("workspace.risk.supplyRisk"), value: breakdown?.supply_risk ?? 0 },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="min-w-32.5 rounded-lg border border-surface-4 bg-surface-2 px-4 py-2.5"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {m.label}
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${scoreToneClass(m.value)}`}>
                      {toPercent(m.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 3. Operational alerts ── */}
          {(risk?.operational_alerts ?? []).length ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.risk.activeAlerts")}
              </p>
              <div className="space-y-2">
                {risk!.operational_alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-r-lg border-l-4 px-4 py-3 ${alertRowClasses(alert.severity)}`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">{alert.detail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${riskBadgeClasses(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                      <p className="text-xs font-medium text-text-secondary">
                        {alert.suggested_action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── 4. Item risks — stockout + waste merged ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("workspace.risk.itemRisks")}
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
              {t("workspace.risk.stockoutWasteExposure")}
            </h3>
            <div className="mt-3 space-y-2">
              {allItemRisks.length ? (
                allItemRisks.map((item) => (
                  <div
                    key={item.key}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-r-lg border-l-4 px-4 py-3 ${alertRowClasses(item.risk)}`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">{item.detail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${riskBadgeClasses(item.risk)}`}
                      >
                        {item.risk}
                      </span>
                      <p className="text-xs font-medium text-text-secondary">
                        {item.action}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">
                  {t("workspace.risk.noItemRisks")}
                </p>
              )}
            </div>
          </div>

          {/* ── 5. Forecast health — today only, from branchDayToday ── */}
          {isToday && (confidenceBreakdown ?? forecastConfidence !== undefined) ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.risk.forecastHealth")}
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-text-primary">
                {t("workspace.risk.forecastHealthDesc")}
              </h3>
              <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 p-5">
                <div className="mb-5 flex items-baseline gap-2">
                  <p
                    className={`text-2xl font-semibold ${confidenceToneClass(forecastConfidence ?? 0)}`}
                  >
                    {forecastConfidence !== undefined
                      ? forecastConfidence >= 0.75
                        ? t("workspace.risk.highConfidence")
                        : forecastConfidence >= 0.5
                          ? t("workspace.risk.mediumConfidence")
                          : t("workspace.risk.lowConfidence")
                      : "—"}
                  </p>
                  {forecastConfidence !== undefined ? (
                    <p className="text-sm text-text-muted">
                      ({Math.round(forecastConfidence * 100)}%)
                    </p>
                  ) : null}
                </div>
                {confidenceBreakdown ? (
                  <>
                    <div className="space-y-3">
                      <ConfidenceBar
                        label={t("workspace.risk.dataCoverage")}
                        value={confidenceBreakdown.data_coverage}
                      />
                      <ConfidenceBar
                        label={t("workspace.risk.recentAccuracy")}
                        value={confidenceBreakdown.recent_accuracy}
                      />
                      <ConfidenceBar
                        label={t("workspace.risk.demandStability")}
                        value={confidenceBreakdown.demand_stability}
                      />
                      <ConfidenceBar
                        label={t("workspace.risk.modelAgreement")}
                        value={confidenceBreakdown.model_agreement}
                      />
                    </div>
                    <p className="mt-4 text-xs text-text-muted">
                      {confidenceBreakdown.limiting_factor ===
                      "All signals are consistent" ? (
                        <span className="text-status-success">
                          {t("workspace.risk.allSignalsConsistent")}
                        </span>
                      ) : (
                        <>
                          <span className="font-semibold text-status-warning">
                            {t("workspace.risk.limitingFactor")}{" "}
                          </span>
                          {confidenceBreakdown.limiting_factor}
                        </>
                      )}
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ── 6. Risk trend sparkline ── */}
          {trendSeries.scores.length > 1 ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                {t("workspace.risk.riskTrend")}
              </p>
              <div className="rounded-xl border border-surface-4 bg-surface-2 p-5">
                <svg viewBox="0 0 520 80" className="h-20 w-full">
                  <polyline
                    points={buildSparklinePoints(trendSeries.scores, 520, 80)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="text-brand-gold"
                  />
                </svg>
                <div className="mt-2 flex justify-between text-[10px] text-text-muted">
                  {trendSeries.labels.slice(-6).map((label, i) => (
                    <div key={`${label}-${i}`}>
                      <p>{label}</p>
                      <p className="font-semibold text-text-secondary">
                        {(
                          trendSeries.scores[
                            Math.max(0, trendSeries.scores.length - 6 + i)
                          ] ?? 0
                        ).toFixed(0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Empty state */}
          {!riskQuery.isLoading && !risk ? (
            <div className="rounded-xl border border-surface-4 bg-surface-2 p-10 text-center">
              <p className="text-sm text-text-muted">
                {t("workspace.risk.noRiskData")}
              </p>
            </div>
          ) : null}

        </div>
      )}
    </WorkspaceShell>
  );
}

export default function RiskPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          {t("workspace.risk.loadingFallback")}
        </div>
      }
    >
      <RiskPageContent />
    </Suspense>
  );
}
