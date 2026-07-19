"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, StatsUpSquare, StatsDownSquare, Shop } from "iconoir-react";
import { useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";
import { formatMoney, formatCurrencyBreakdown } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import { alertCTA, type BranchEntry } from "./alert-cta";
import { KpiPulseCard } from "./kpi-pulse-card";
import { KpiDetailModals, type KpiModalKey } from "./kpi-detail-modals";

// ─────────────────────────────────────────────────────────────────────────────
// Branch diagnosis
// Ordered by impact: blocking ops first, financial loss second, data gaps third.
// Labels are i18n keys under dashboard.home.orgHome, resolved at render.
// ─────────────────────────────────────────────────────────────────────────────

type Diagnosis = {
  issueKey: string | null;
  issueVars?: Record<string, string | number>;
  detailKey: string | null;
  ctaKey: string;
  ctaHref: string;
  severity: "critical" | "warning" | "ok";
};

function diagnoseBranch(branch: BranchEntry): Diagnosis {
  // Each destination has its own URL param convention.
  // today page reads ?branch_id=, all others read ?branch=
  const bid = branch.branch_id;
  const toToday = `/workspace/today?branch_id=${bid}`;
  const toWaste = `/workspace/sales-waste?branch=${bid}`;
  const toSettings = `/workspace/settings?tab=integrations&branch=${bid}`;
  const wastePct = Number(branch.waste_pct ?? 0);

  // 1. Plan not locked — branch is blocked from starting live service
  if (
    !branch.plan_locked &&
    (branch.day_status === "MORNING" || branch.day_status == null)
  ) {
    return {
      issueKey: "dashboard.home.orgHome.diagPlanIssue",
      detailKey: "dashboard.home.orgHome.diagPlanDetail",
      ctaKey: "dashboard.home.orgHome.diagPlanCta",
      ctaHref: toToday,
      severity: "critical",
    };
  }

  // 2. POS not connected — sales data is blind
  if (branch.staff_activity_status === "NO_SYNC") {
    return {
      issueKey: "dashboard.home.orgHome.diagPosIssue",
      detailKey: "dashboard.home.orgHome.diagPosDetail",
      ctaKey: "dashboard.home.orgHome.diagPosCta",
      ctaHref: toSettings,
      severity: "critical",
    };
  }

  // 3. Critical waste — active financial loss
  if (wastePct >= 7) {
    return {
      issueKey: "dashboard.home.orgHome.diagWasteIssue",
      issueVars: { pct: wastePct.toFixed(1) },
      detailKey: "dashboard.home.orgHome.diagWasteDetail",
      ctaKey: "dashboard.home.orgHome.diagWasteCta",
      ctaHref: toWaste,
      severity: "critical",
    };
  }

  // 4. Staff gone idle during live service — likely a floor problem
  if (branch.staff_activity_status === "IDLE" && branch.day_status === "LIVE") {
    return {
      issueKey: "dashboard.home.orgHome.diagIdleIssue",
      detailKey: "dashboard.home.orgHome.diagIdleDetail",
      ctaKey: "dashboard.home.orgHome.diagIdleCta",
      ctaHref: toToday,
      severity: "critical",
    };
  }

  // 5. Moderate waste — approaching threshold, not yet critical
  if (wastePct >= 4) {
    return {
      issueKey: "dashboard.home.orgHome.diagWasteWarnIssue",
      issueVars: { pct: wastePct.toFixed(1) },
      detailKey: "dashboard.home.orgHome.diagWasteWarnDetail",
      ctaKey: "dashboard.home.orgHome.diagWasteWarnCta",
      ctaHref: toWaste,
      severity: "warning",
    };
  }

  // 6. Day closed or not yet started
  if (!branch.day_status || branch.day_status === "CLOSED") {
    return {
      issueKey: null,
      detailKey: null,
      ctaKey: "dashboard.home.orgHome.diagClosedCta",
      ctaHref: toToday,
      severity: "ok",
    };
  }

  // All good
  return {
    issueKey: null,
    detailKey: null,
    ctaKey: "dashboard.home.orgHome.diagOkCta",
    ctaHref: toToday,
    severity: "ok",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { labelKey: "dashboard.home.orgHome.quickToday", href: "/workspace/today" },
  { labelKey: "dashboard.home.orgHome.quickPlanning", href: "/workspace/planning" },
  { labelKey: "dashboard.home.orgHome.quickInventory", href: "/workspace/inventory" },
  { labelKey: "dashboard.home.orgHome.quickSalesWaste", href: "/workspace/sales-waste" },
];

export function DashboardView({
  canSeeFinancials,
  analyticsSlot,
}: {
  canSeeFinancials: boolean;
  /** Charts, rendered directly below the pulse KPIs — kept as a slot so page.tsx owns the wiring. */
  analyticsSlot?: ReactNode;
}) {
  const { t, language } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const [kpiModal, setKpiModal] = useState<KpiModalKey | null>(null);

  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  // undefined = today. Same key as CommandSection → shared React Query cache.
  const ctToday = useExecutiveControlTower(undefined, Boolean(user?.organization_id));
  const ctYesterday = useExecutiveControlTower(
    { target_date: yesterdayDate },
    Boolean(user?.organization_id),
  );
  const marginReport = useOwnerMarginProtectionReport(
    undefined,
    canSeeFinancials && Boolean(user?.organization_id),
  );

  const tower = ctToday.data;
  const alerts = tower?.alerts ?? [];
  const branchGrid = tower?.branch_grid ?? [];

  // Sort: problems first
  const sortedBranches = useMemo(() => {
    const order: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2 };
    return [...branchGrid].sort(
      (a, b) =>
        (order[a.compliance_badge ?? ""] ?? 1) -
        (order[b.compliance_badge ?? ""] ?? 1),
    );
  }, [branchGrid]);

  const highAlerts = alerts.filter((a) => a.severity === "HIGH");

  // Pulse metrics. Money arrives in the summary currency: the fleet's shared
  // branch currency, or USD when branches operate in different currencies
  // (the backend converts before summing).
  const towerCurrency = tower?.summary?.currency ?? "USD";
  const isMultiCurrency = Boolean(tower?.summary?.is_multi_currency);
  const revenueByCurrency = tower?.summary?.revenue_by_currency ?? [];
  const marginCurrency = marginReport.data?.summary?.currency ?? "USD";

  const revenueToday = Number(tower?.summary?.total_revenue ?? 0);
  const revenueYesterday = Number(ctYesterday.data?.summary?.total_revenue ?? 0);
  const revenueDeltaPct =
    revenueYesterday > 0
      ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100
      : null;

  const wasteCost = Number(marginReport.data?.summary?.total_waste_cost ?? "0");
  const wasteRiskPct = Number(tower?.summary?.waste_risk_pct ?? 0);
  const wasteAsRevenuePct = revenueToday > 0 ? (wasteCost / revenueToday) * 100 : 0;
  const wasteIsBad = canSeeFinancials ? wasteCost > 500 : wasteRiskPct > 8;

  const forecastAccuracyPct =
    Number(tower?.summary?.forecast_accuracy_rolling_7d ?? 0) * 100;
  const forecastIsBad = forecastAccuracyPct > 0 && forecastAccuracyPct < 70;
  const forecastIsWarning = forecastAccuracyPct >= 70 && forecastAccuracyPct < 85;

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12
      ? "dashboard.home.orgHome.goodMorning"
      : hour < 17
        ? "dashboard.home.orgHome.goodAfternoon"
        : "dashboard.home.orgHome.goodEvening";
  const greeting = user?.first_name
    ? `${t(greetingKey)}, ${user.first_name}`
    : t(greetingKey);

  const todayDisplay = new Date().toLocaleDateString(
    language === "fr" ? "fr-FR" : "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );

  const branchStatusLine = (branch: BranchEntry): string => {
    const status =
      branch.day_status === "LIVE"
        ? t("dashboard.home.orgHome.statusLive")
        : branch.day_status === "CLOSED"
          ? t("dashboard.home.orgHome.statusClosed")
          : branch.day_status === "MORNING"
            ? t("dashboard.home.orgHome.statusMorning")
            : t("dashboard.home.orgHome.statusNotStarted");
    const plan = branch.plan_locked
      ? t("dashboard.home.orgHome.planLocked")
      : t("dashboard.home.orgHome.planPending");
    const staff =
      branch.staff_activity_status === "ACTIVE"
        ? t("dashboard.home.orgHome.staffActive")
        : branch.staff_activity_status === "IDLE"
          ? t("dashboard.home.orgHome.staffIdle")
          : t("dashboard.home.orgHome.noStaffSync");
    return `${status} · ${plan} · ${staff}`;
  };

  return (
    <>
      {/* ── Morning brief ──────────────────────────────────────────────── */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
          {todayDisplay}
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
          {greeting}
        </h1>
        <p className="mt-4 text-base text-text-secondary">
          {branchGrid.length > 0
            ? branchGrid.length === 1
              ? t("dashboard.home.orgHome.branchReportingOne")
              : t("dashboard.home.orgHome.branchesReporting", {
                  count: branchGrid.length,
                })
            : ctToday.isLoading
              ? t("dashboard.home.orgHome.loadingEllipsis")
              : t("dashboard.home.orgHome.noBranchesYet")}
        </p>
        {/* Quick navigation into the day's working surfaces */}
        <div className="mt-6 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
            >
              {t(action.labelKey)}
              <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Pulse KPIs ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiPulseCard
          label={
            isMultiCurrency
              ? t("dashboard.home.orgHome.kpiRevenueTodayUsd")
              : t("dashboard.home.orgHome.kpiRevenueToday")
          }
          value={formatMoney(revenueToday, towerCurrency)}
          onOpen={() => setKpiModal("revenue")}
          openAriaLabel={t("dashboard.home.orgHome.kpiRevenueAria")}
          footer={
            <div className="flex flex-col gap-1">
              {isMultiCurrency && revenueByCurrency.length > 0 && (
                <span className="text-xs text-text-muted truncate">
                  {formatCurrencyBreakdown(
                    revenueByCurrency.map((row) => ({
                      currency: row.currency,
                      amount: row.amount,
                    })),
                  )}
                </span>
              )}
              <div className="flex items-center gap-2">
              {revenueDeltaPct !== null ? (
                <>
                  {revenueDeltaPct >= 0 ? (
                    <StatsUpSquare className="h-4 w-4 text-status-success shrink-0" />
                  ) : (
                    <StatsDownSquare className="h-4 w-4 text-status-critical shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${revenueDeltaPct >= 0 ? "text-status-success" : "text-status-critical"}`}
                  >
                    {t("dashboard.home.orgHome.vsYesterday", {
                      value: `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}`,
                    })}
                  </span>
                </>
              ) : (
                <span className="text-xs text-text-muted">
                  {t("dashboard.home.orgHome.noPriorBaseline")}
                </span>
              )}
              </div>
            </div>
          }
        />

        <KpiPulseCard
          label={
            canSeeFinancials
              ? t("dashboard.home.orgHome.kpiWasteCost")
              : t("dashboard.home.orgHome.kpiWasteRisk")
          }
          value={
            canSeeFinancials
              ? formatMoney(wasteCost, marginCurrency)
              : `${wasteRiskPct.toFixed(1)}%`
          }
          valueClass={wasteIsBad ? "text-status-critical" : "text-text-primary"}
          hoverBorderClass="hover:border-status-critical/20"
          onOpen={() => setKpiModal("waste")}
          openAriaLabel={t("dashboard.home.orgHome.kpiWasteAria")}
          footer={
            <p className="text-xs text-text-muted">
              {canSeeFinancials
                ? t("dashboard.home.orgHome.ofRevenue", {
                    value: wasteAsRevenuePct.toFixed(1),
                  })
                : t("dashboard.home.orgHome.itemsAtRiskToday")}
            </p>
          }
        />

        <KpiPulseCard
          label={t("dashboard.home.orgHome.kpiForecastAccuracy")}
          value={`${forecastAccuracyPct.toFixed(1)}%`}
          valueClass={
            forecastIsBad
              ? "text-status-critical"
              : forecastIsWarning
                ? "text-status-warning"
                : "text-text-primary"
          }
          onOpen={() => setKpiModal("forecast")}
          openAriaLabel={t("dashboard.home.orgHome.kpiForecastAria")}
          footer={
            <p className="text-xs text-text-muted">
              {t("dashboard.home.orgHome.rolling7d")}
            </p>
          }
        />

        <KpiPulseCard
          label={t("dashboard.home.orgHome.kpiActiveAlerts")}
          value={alerts.length}
          valueClass={
            highAlerts.length > 0 ? "text-status-critical" : "text-text-primary"
          }
          onOpen={() => setKpiModal("alerts")}
          openAriaLabel={t("dashboard.home.orgHome.kpiAlertsAria")}
          footer={
            <p className="text-xs text-text-muted">
              {highAlerts.length > 0
                ? t("dashboard.home.orgHome.needImmediate", {
                    count: highAlerts.length,
                  })
                : alerts.length > 0
                  ? t("dashboard.home.orgHome.noUrgent")
                  : t("dashboard.home.orgHome.allClear")}
            </p>
          }
        />
      </section>

      {/* ── Analytics — right below the pulse KPIs ───────────────────────── */}
      {analyticsSlot}

      {/* ── HIGH alerts — specific issue + specific action ─────────────── */}
      {highAlerts.length > 0 && (
        <section className="mb-12">
          {highAlerts.slice(0, 3).map((alert) => {
            const cta = alertCTA(alert);
            return (
              <div
                key={alert.id}
                className="mb-2.5 flex items-start justify-between gap-6 rounded-xl border border-surface-4 border-l-[3px] border-l-status-critical bg-surface-2 px-6 py-5"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-status-critical shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      {alert.title || alert.type}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {alert.branch_name}
                    </p>
                    {alert.context && (
                      <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                        {alert.context}
                      </p>
                    )}
                    {alert.suggested_action && (
                      <p className="mt-1 text-xs text-text-muted">
                        → {alert.suggested_action}
                      </p>
                    )}
                  </div>
                </div>
                {/* Specific action label — not generic "View" */}
                <Link
                  href={cta.href}
                  className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-4 text-xs font-medium text-text-secondary whitespace-nowrap hover:border-status-critical/40 hover:text-status-critical transition-colors"
                >
                  {t(cta.labelKey)}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Branch health grid ─────────────────────────────────────────── */}
      {sortedBranches.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("dashboard.home.orgHome.operationsKicker")}
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-text-primary">
                {sortedBranches.length === 1
                  ? t("dashboard.home.orgHome.locationsOne")
                  : t("dashboard.home.orgHome.locationsMany", {
                      count: sortedBranches.length,
                    })}
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {t("dashboard.home.orgHome.systemStatusLine")}
              </p>
            </div>
            {sortedBranches.some((b) => b.compliance_badge === "RED") && (
              <span className="text-xs font-medium text-status-critical shrink-0 mt-1">
                {t("dashboard.home.orgHome.needAttention", {
                  count: sortedBranches.filter(
                    (b) => b.compliance_badge === "RED",
                  ).length,
                })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedBranches.map((branch) => {
              const isRed = branch.compliance_badge === "RED";
              const diagnosis = diagnoseBranch(branch);
              const hasProblem = diagnosis.issueKey !== null;

              return (
                <article
                  key={branch.branch_id}
                  className={`bg-surface-2 rounded-xl border border-surface-4 p-6 flex flex-col gap-5 ${
                    isRed ? "border-l-[3px] border-l-status-critical" : ""
                  }`}
                >
                  {/* Header: name + revenue — always visible */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isRed
                            ? "bg-status-critical"
                            : branch.compliance_badge === "AMBER"
                              ? "bg-status-warning"
                              : "bg-status-success"
                        }`}
                      />
                      <h3 className="font-medium text-text-primary truncate">
                        {branch.branch_name}
                      </h3>
                    </div>
                    <p className="text-sm font-semibold text-text-primary shrink-0">
                      {formatMoney(Number(branch.revenue ?? 0), branch.currency ?? towerCurrency)}
                    </p>
                  </div>

                  {/* Body: problem branch shows diagnosis. Healthy branch shows status. */}
                  {hasProblem ? (
                    <div className="space-y-1.5">
                      <p
                        className={`text-sm font-semibold ${
                          diagnosis.severity === "critical"
                            ? "text-status-critical"
                            : "text-status-warning"
                        }`}
                      >
                        {t(diagnosis.issueKey!, diagnosis.issueVars)}
                      </p>
                      {diagnosis.detailKey && (
                        <p className="text-xs text-text-muted leading-relaxed">
                          {t(diagnosis.detailKey)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      {branchStatusLine(branch)}
                    </p>
                  )}

                  {/* CTA — specific label that says what the user will do */}
                  <Link
                    href={diagnosis.ctaHref}
                    className={`group inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors duration-150 ${
                      isRed && hasProblem
                        ? "border-status-critical/30 bg-status-critical/8 text-status-critical hover:bg-status-critical/15"
                        : "border-surface-4 bg-surface-3 text-text-secondary hover:border-brand-gold/40 hover:text-brand-gold"
                    }`}
                  >
                    {t(diagnosis.ctaKey)}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {branchGrid.length === 0 && !ctToday.isLoading && (
        <div className="mb-12 rounded-xl border border-surface-4 bg-surface-2 p-12 text-center">
          <p className="text-text-muted">
            {t("dashboard.home.orgHome.noBranchesYet")}
          </p>
          <Link href="/workspace/branches/new">
            <button className="mt-6 h-10 inline-flex items-center gap-2 rounded-lg bg-brand-gold hover:bg-brand-gold-hover text-background px-5 text-sm font-semibold transition-colors">
              <Shop className="h-4 w-4" />
              {t("dashboard.home.orgHome.addFirstBranch")}
            </button>
          </Link>
        </div>
      )}

      {/* ── KPI detail modals ──────────────────────────────────────────── */}
      <KpiDetailModals
        openModal={kpiModal}
        onClose={() => setKpiModal(null)}
        canSeeFinancials={canSeeFinancials}
        tower={tower}
        marginReport={marginReport.data}
        metrics={{
          revenueToday,
          revenueDeltaPct,
          wasteCost,
          wasteRiskPct,
          wasteAsRevenuePct,
          wasteIsBad,
          forecastAccuracyPct,
          forecastIsBad,
          forecastIsWarning,
        }}
        alerts={alerts}
        highAlerts={highAlerts}
      />
    </>
  );
}
