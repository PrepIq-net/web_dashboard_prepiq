"use client";

import Link from "next/link";
import { ArrowRight } from "iconoir-react";
import { ModalShell } from "@/components/ui/modal-shell";
import { formatMoney } from "@/lib/format";
import type {
  ExecutiveControlTowerSnapshot,
  OwnerMarginProtectionReport,
} from "@/services/production-intelligence/types";
import { alertCTA, type AlertEntry } from "./alert-cta";

export type KpiModalKey = "revenue" | "waste" | "forecast" | "alerts";

export type PulseMetrics = {
  revenueToday: number;
  revenueDeltaPct: number | null;
  wasteCost: number;
  wasteRiskPct: number;
  wasteAsRevenuePct: number;
  wasteIsBad: boolean;
  forecastAccuracyPct: number;
  forecastIsBad: boolean;
  forecastIsWarning: boolean;
};

function ModalStat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "red" | "amber";
}) {
  const valueColor =
    highlight === "red"
      ? "text-status-critical"
      : highlight === "amber"
        ? "text-status-warning"
        : "text-text-primary";
  return (
    <div className="bg-surface-3 rounded-lg p-4 border border-surface-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-1.5">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

type BarItem = {
  label: string;
  value: number;
  colorClass: string;
  display?: string;
};

function HorizontalBars({
  items,
  formatVal,
  emptyText = "No data",
}: {
  items: BarItem[];
  formatVal: (item: BarItem) => string;
  emptyText?: string;
}) {
  const max = Math.max(...items.map((d) => d.value), 1);
  if (items.length === 0) {
    return <p className="text-sm text-text-muted text-center py-6">{emptyText}</p>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-28 truncate shrink-0 text-right">
            {item.label}
          </span>
          <div className="flex-1 h-4 bg-surface-4 rounded-sm overflow-hidden">
            <div
              className={`h-full rounded-sm ${item.colorClass}`}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-text-primary w-16 text-right shrink-0 tabular-nums">
            {formatVal(item)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The four pulse-KPI drill-down modals (revenue / waste / forecast / alerts).
 * Pure presentation over already-fetched control-tower + margin-report data.
 */
export function KpiDetailModals({
  openModal,
  onClose,
  canSeeFinancials,
  tower,
  marginReport,
  metrics,
  alerts,
  highAlerts,
}: {
  openModal: KpiModalKey | null;
  onClose: () => void;
  canSeeFinancials: boolean;
  tower: ExecutiveControlTowerSnapshot | undefined;
  marginReport: OwnerMarginProtectionReport | undefined;
  metrics: PulseMetrics;
  alerts: AlertEntry[];
  highAlerts: AlertEntry[];
}) {
  const branchGrid = tower?.branch_grid ?? [];
  // Branch money is local-currency; org totals arrive in the summary currency
  // (the shared local currency, or USD when the fleet mixes currencies). Bars
  // that span branches scale on USD values so lengths stay comparable, while
  // labels show the branch's own currency.
  const towerCurrency = tower?.summary?.currency ?? "USD";
  const marginCurrency = marginReport?.summary?.currency ?? "USD";
  const isMultiCurrency = Boolean(tower?.summary?.is_multi_currency);
  const {
    revenueToday,
    revenueDeltaPct,
    wasteCost,
    wasteRiskPct,
    wasteAsRevenuePct,
    wasteIsBad,
    forecastAccuracyPct,
    forecastIsBad,
    forecastIsWarning,
  } = metrics;

  return (
    <>
      {/* Revenue modal */}
      <ModalShell
        open={openModal === "revenue"}
        onClose={onClose}
        title="Revenue"
        description="Today's revenue across all connected branches"
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <ModalStat
              label="Today"
              value={formatMoney(revenueToday, towerCurrency)}
              sub={
                revenueDeltaPct !== null
                  ? `${revenueDeltaPct >= 0 ? "+" : ""}${revenueDeltaPct.toFixed(1)}% vs yesterday`
                  : "No prior-day baseline"
              }
            />
            <ModalStat
              label="Units sold"
              value={(tower?.summary?.total_sold ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
              sub="across all branches"
            />
            <ModalStat
              label="Cost saved today"
              value={formatMoney(Number(tower?.summary?.cost_saved_today ?? 0), towerCurrency)}
              sub="vs unoptimized baseline"
            />
          </div>

          {branchGrid.some((b) => Number(b.revenue ?? 0) > 0) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                Revenue by branch
              </p>
              <HorizontalBars
                items={[...branchGrid]
                  .filter((b) => Number(b.revenue ?? 0) > 0)
                  .map((b) => ({
                    label: b.branch_name,
                    value: isMultiCurrency
                      ? Number(b.revenue_usd ?? b.revenue ?? 0)
                      : Number(b.revenue ?? 0),
                    colorClass: "bg-brand-gold/70",
                    display: formatMoney(Number(b.revenue ?? 0), b.currency ?? towerCurrency),
                  }))
                  .sort((a, b) => b.value - a.value)}
                formatVal={(item) => item.display ?? formatMoney(item.value, towerCurrency)}
                emptyText="No revenue data available"
              />
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
              Prepared vs sold
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ModalStat
                label="Total prepared"
                value={(tower?.summary?.total_prepared ?? 0).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 0 },
                )}
                sub="units across branches"
              />
              <ModalStat
                label="Predicted surplus"
                value={(tower?.summary?.predicted_surplus ?? 0).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 0 },
                )}
                sub="units at end of service"
                highlight={
                  Number(tower?.summary?.predicted_surplus ?? 0) > 0
                    ? "amber"
                    : undefined
                }
              />
            </div>
          </div>

          <Link
            href="/workspace/financial"
            className="inline-flex items-center gap-1.5 text-sm text-brand-gold hover:underline"
          >
            View full financial report
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ModalShell>

      {/* Waste modal */}
      <ModalShell
        open={openModal === "waste"}
        onClose={onClose}
        title={canSeeFinancials ? "Waste Cost" : "Waste Risk"}
        description="Item-level waste exposure across all branches today"
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <ModalStat
              label={canSeeFinancials ? "Total waste cost" : "Waste risk %"}
              value={
                canSeeFinancials
                  ? formatMoney(wasteCost, marginCurrency)
                  : `${wasteRiskPct.toFixed(1)}%`
              }
              sub={
                canSeeFinancials
                  ? `${wasteAsRevenuePct.toFixed(1)}% of revenue`
                  : "items at risk"
              }
              highlight={wasteIsBad ? "red" : undefined}
            />
            <ModalStat
              label="Branches above 7%"
              value={branchGrid
                .filter((b) => Number(b.waste_pct ?? 0) >= 7)
                .length.toString()}
              sub="critical threshold"
              highlight={
                branchGrid.some((b) => Number(b.waste_pct ?? 0) >= 7)
                  ? "red"
                  : undefined
              }
            />
            <ModalStat
              label="Branches 4–7%"
              value={branchGrid
                .filter((b) => {
                  const p = Number(b.waste_pct ?? 0);
                  return p >= 4 && p < 7;
                })
                .length.toString()}
              sub="approaching threshold"
              highlight={
                branchGrid.some((b) => {
                  const p = Number(b.waste_pct ?? 0);
                  return p >= 4 && p < 7;
                })
                  ? "amber"
                  : undefined
              }
            />
          </div>

          {marginReport?.summary?.margin_reliability?.is_reliable === false && (
            <div className="rounded-lg border border-surface-4 bg-surface-3 px-4 py-3">
              <p className="text-xs font-semibold text-text-primary">
                Data reliability note
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {marginReport.summary.margin_reliability.warning ??
                  `${marginReport.summary.margin_reliability.unreliable_items_count ?? "Some"} items have incomplete data — figures may be understated.`}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
              Waste % by branch — sorted worst first
            </p>
            <HorizontalBars
              items={[...branchGrid]
                .filter((b) => b.waste_pct !== null && b.waste_pct !== undefined)
                .sort((a, b) => Number(b.waste_pct ?? 0) - Number(a.waste_pct ?? 0))
                .map((b) => {
                  const p = Number(b.waste_pct ?? 0);
                  const mb = marginReport?.branches?.find(
                    (m) => m.branch_id === b.branch_id,
                  );
                  return {
                    label: b.branch_name,
                    value: p,
                    colorClass:
                      p >= 7
                        ? "bg-status-critical"
                        : p >= 4
                          ? "bg-status-warning"
                          : "bg-chart-baseline",
                    display: mb
                      ? formatMoney(Number(mb.total_waste_cost ?? "0"), mb.currency ?? marginCurrency)
                      : undefined,
                  };
                })}
              formatVal={(item) =>
                item.display
                  ? `${item.value.toFixed(1)}% · ${item.display}`
                  : `${item.value.toFixed(1)}%`
              }
              emptyText="No waste data available"
            />
          </div>

          {canSeeFinancials && marginReport?.branches && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                Waste cost by branch
              </p>
              <HorizontalBars
                items={[...marginReport.branches]
                  .filter((b) => Number(b.total_waste_cost ?? "0") > 0)
                  .map((b) => ({
                    label: b.branch_name,
                    value: isMultiCurrency
                      ? Number(b.total_waste_cost_usd ?? b.total_waste_cost ?? "0")
                      : Number(b.total_waste_cost ?? "0"),
                    colorClass: "bg-chart-baseline",
                    display: formatMoney(
                      Number(b.total_waste_cost ?? "0"),
                      b.currency ?? marginCurrency,
                    ),
                  }))
                  .sort((a, b) => b.value - a.value)}
                formatVal={(item) => item.display ?? formatMoney(item.value, marginCurrency)}
                emptyText="No cost data available"
              />
            </div>
          )}

          <Link
            href="/workspace/sales-waste"
            className="inline-flex items-center gap-1.5 text-sm text-brand-gold hover:underline"
          >
            View waste details
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ModalShell>

      {/* Forecast accuracy modal */}
      <ModalShell
        open={openModal === "forecast"}
        onClose={onClose}
        title="Forecast Accuracy"
        description="How well AI-predicted demand matched actual sales"
        maxWidthClassName="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <ModalStat
              label="7-day rolling"
              value={`${forecastAccuracyPct.toFixed(1)}%`}
              sub="across all branches"
              highlight={
                forecastIsBad ? "red" : forecastIsWarning ? "amber" : undefined
              }
            />
            <ModalStat
              label="Branches below 70%"
              value={branchGrid
                .filter(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined &&
                    Number(b.forecast_confidence) < 0.7,
                )
                .length.toString()}
              sub="need attention"
              highlight={
                branchGrid.some(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined &&
                    Number(b.forecast_confidence) < 0.7,
                )
                  ? "amber"
                  : undefined
              }
            />
            <ModalStat
              label="Active branches"
              value={branchGrid
                .filter(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined,
                )
                .length.toString()}
              sub="with forecast data"
            />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
              Forecast confidence by branch — worst first
            </p>
            <HorizontalBars
              items={[...branchGrid]
                .filter(
                  (b) =>
                    b.forecast_confidence !== null &&
                    b.forecast_confidence !== undefined,
                )
                .sort(
                  (a, b) =>
                    Number(a.forecast_confidence ?? 1) -
                    Number(b.forecast_confidence ?? 1),
                )
                .map((b) => {
                  const conf = Number(b.forecast_confidence ?? 0) * 100;
                  const mb = marginReport?.branches?.find(
                    (m) => m.branch_id === b.branch_id,
                  );
                  const accuracy = mb?.forecast_accuracy_summary;
                  return {
                    label: b.branch_name,
                    value: conf,
                    colorClass:
                      conf < 50
                        ? "bg-status-critical"
                        : conf < 65
                          ? "bg-status-warning"
                          : "bg-chart-baseline",
                    display:
                      accuracy != null
                        ? `${(accuracy * 100).toFixed(0)}% actual`
                        : undefined,
                  };
                })}
              formatVal={(item) =>
                item.display
                  ? `${item.value.toFixed(0)}% · ${item.display}`
                  : `${item.value.toFixed(0)}%`
              }
              emptyText="No forecast data available"
            />
          </div>

          <div className="rounded-lg border border-surface-4 bg-surface-3 px-4 py-3.5 space-y-1">
            <p className="text-xs font-semibold text-text-primary">
              What drives low confidence?
            </p>
            <ul className="text-xs text-text-muted space-y-0.5 list-disc list-inside">
              <li>Unmapped menu items not feeding the demand model</li>
              <li>Irregular sales patterns in the last 7 days</li>
              <li>POS sync gaps (missing sales data)</li>
              <li>New items with fewer than 14 days of history</li>
            </ul>
          </div>

          <Link
            href="/workspace/today"
            className="inline-flex items-center gap-1.5 text-sm text-brand-gold hover:underline"
          >
            Review today's prep plan
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </ModalShell>

      {/* Alerts modal */}
      <ModalShell
        open={openModal === "alerts"}
        onClose={onClose}
        title="Active Alerts"
        description={
          alerts.length > 0
            ? `${alerts.length} alert${alerts.length !== 1 ? "s" : ""} across your network${highAlerts.length > 0 ? ` · ${highAlerts.length} urgent` : ""}`
            : "No active alerts right now"
        }
        maxWidthClassName="max-w-xl"
      >
        {alerts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-text-primary">All clear</p>
            <p className="text-xs text-text-muted mt-1">
              No alerts detected across your branches.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-4 overflow-y-auto max-h-[calc(100vh-18rem)]">
            {[...alerts]
              .sort((a, b) => {
                const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                return (order[a.severity ?? ""] ?? 1) - (order[b.severity ?? ""] ?? 1);
              })
              .map((alert) => {
                const cta = alertCTA(alert);
                const isHigh = alert.severity === "HIGH";
                return (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between gap-4 py-4 first:pt-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                          isHigh ? "bg-status-critical" : "bg-status-warning"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-text-primary leading-snug">
                            {alert.title || alert.type}
                          </p>
                          {alert.type && (
                            <span className="text-[10px] uppercase tracking-wider text-text-muted">
                              {alert.type.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {alert.branch_name}
                        </p>
                        {alert.context && (
                          <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
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
                    <Link
                      href={cta.href}
                      className="shrink-0 inline-flex h-8 items-center gap-1 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-secondary whitespace-nowrap transition-colors hover:border-brand-gold/30 hover:text-text-primary"
                    >
                      {cta.label}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                );
              })}
          </div>
        )}
      </ModalShell>
    </>
  );
}
