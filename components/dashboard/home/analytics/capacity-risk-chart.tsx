"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle,
  GraphUp,
  HelpCircle,
  Table2Columns,
  WarningTriangle,
  Group,
} from "iconoir-react";
import type {
  CapacityRiskDay,
  DashboardCapacityRisk,
} from "@/services/production-intelligence/types";
import { useTranslation } from "@/lib/i18n";
import { CHART, compactNumber } from "./chart-theme";

// Heatmap form: one column per day, a single-series demand bar on top and a
// status cell per risk dimension below. Statuses use the reserved palette and
// always travel with an icon + label (legend, tooltip, table view) — never
// color alone. No second y-scale anywhere.

type CellState = {
  tone: "critical" | "warning" | "success" | "neutral";
  labelKey: string;
};

function inventoryCell(day: CapacityRiskDay): CellState {
  switch (day.inventory.status) {
    case "STOCKOUT_RISK":
      return { tone: "critical", labelKey: "dashboard.home.analytics.inventoryShort" };
    case "OK":
      return { tone: "success", labelKey: "dashboard.home.analytics.inventoryOk" };
    default:
      return { tone: "neutral", labelKey: "dashboard.home.analytics.noData" };
  }
}

function laborCell(day: CapacityRiskDay): CellState {
  switch (day.labor.status) {
    case "UNDER":
      return { tone: "critical", labelKey: "dashboard.home.analytics.laborUnder" };
    case "OVER":
      return { tone: "warning", labelKey: "dashboard.home.analytics.laborOver" };
    case "OK":
      return { tone: "success", labelKey: "dashboard.home.analytics.laborOk" };
    default:
      return { tone: "neutral", labelKey: "dashboard.home.analytics.noData" };
  }
}

const TONE_STYLES: Record<CellState["tone"], { bg: string; fg: string }> = {
  critical: { bg: "rgba(196, 73, 73, 0.16)", fg: CHART.critical },
  warning: { bg: "rgba(196, 139, 42, 0.16)", fg: CHART.warning },
  success: { bg: "rgba(63, 143, 104, 0.14)", fg: CHART.success },
  neutral: { bg: CHART.neutralCell, fg: CHART.axisText },
};

function ToneIcon({ state }: { state: CellState }) {
  const cls = "h-4 w-4";
  if (state.tone === "critical" || state.tone === "warning")
    return <WarningTriangle className={cls} />;
  if (state.tone === "success") return <CheckCircle className={cls} />;
  return <HelpCircle className={cls} />;
}

function CellTooltip({ day, kind }: { day: CapacityRiskDay; kind: "inventory" | "labor" }) {
  const { t, language } = useTranslation();
  const locale = language === "fr" ? "fr-FR" : "en-US";
  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const state = kind === "inventory" ? inventoryCell(day) : laborCell(day);

  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-lg border px-4 py-3 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
      role="tooltip"
    >
      <p className="text-xs font-semibold text-text-primary">{dateLabel}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: TONE_STYLES[state.tone].fg }}>
        <ToneIcon state={state} />
        {t(state.labelKey)}
      </p>
      {kind === "labor" ? (
        <div className="mt-2 space-y-1 text-xs text-text-secondary">
          <p>
            {t("dashboard.home.analytics.laborHoursLine", {
              scheduled: day.labor.scheduled_hours,
              required: day.labor.required_hours,
            })}
          </p>
          <p>
            {t("dashboard.home.analytics.laborHeadcountLine", {
              scheduled: day.labor.scheduled_headcount,
              required: day.labor.required_headcount,
            })}
          </p>
          {day.labor.coverage_pct != null && (
            <p>
              {t("dashboard.home.analytics.laborCoverageLine", {
                pct: day.labor.coverage_pct,
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-1 text-xs text-text-secondary">
          {day.inventory.status === "STOCKOUT_RISK" ? (
            <>
              <p>
                {t("dashboard.home.analytics.inventoryShortfallLine", {
                  count: day.inventory.shortfall_count,
                })}
              </p>
              {day.inventory.top_shortfalls.map((line) => (
                <p key={`${line.ingredient_name}`} className="text-text-muted">
                  {line.ingredient_name}: {line.net_need ?? "—"} {line.unit ?? ""}
                </p>
              ))}
            </>
          ) : (
            <p>{t(state.labelKey)}</p>
          )}
        </div>
      )}
      {day.branches_at_risk.length > 0 && (
        <div className="mt-2 border-t border-surface-4 pt-2 text-xs text-text-muted">
          {day.branches_at_risk.map((branch) => (
            <p key={branch.branch_id} className="truncate">
              {branch.branch_name}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function CapacityRiskChart({ data }: { data: DashboardCapacityRisk }) {
  const { t, language } = useTranslation();
  const [showTable, setShowTable] = useState(false);
  const locale = language === "fr" ? "fr-FR" : "en-US";

  const maxDemand = useMemo(
    () =>
      Math.max(
        1,
        ...data.days.map((day) => day.demand_forecast_qty ?? 0),
      ),
    [data.days],
  );
  const peakDate = useMemo(() => {
    let peak: CapacityRiskDay | null = null;
    for (const day of data.days) {
      if (
        day.demand_forecast_qty != null &&
        (peak?.demand_forecast_qty == null ||
          day.demand_forecast_qty > peak.demand_forecast_qty)
      ) {
        peak = day;
      }
    }
    return peak?.date ?? null;
  }, [data.days]);

  const dayLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
      weekday: "short",
      day: "numeric",
    });

  const flaggedDays = data.days.filter((day) => day.risk_level !== "OK").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Status legend — icon + label, the identity channel for cells. */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5" style={{ color: TONE_STYLES.critical.fg }}>
            <WarningTriangle className="h-3.5 w-3.5" />
            {t("dashboard.home.analytics.legendCritical")}
          </span>
          <span className="flex items-center gap-1.5" style={{ color: TONE_STYLES.warning.fg }}>
            <WarningTriangle className="h-3.5 w-3.5" />
            {t("dashboard.home.analytics.legendWarning")}
          </span>
          <span className="flex items-center gap-1.5" style={{ color: TONE_STYLES.success.fg }}>
            <CheckCircle className="h-3.5 w-3.5" />
            {t("dashboard.home.analytics.legendOk")}
          </span>
          <span className="flex items-center gap-1.5 text-text-muted">
            <HelpCircle className="h-3.5 w-3.5" />
            {t("dashboard.home.analytics.noData")}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
          aria-pressed={showTable}
        >
          {showTable ? (
            <GraphUp className="h-3.5 w-3.5" />
          ) : (
            <Table2Columns className="h-3.5 w-3.5" />
          )}
          {showTable
            ? t("dashboard.home.analytics.showChart")
            : t("dashboard.home.analytics.showTable")}
        </button>
      </div>

      {flaggedDays > 0 && (
        <p className="mb-4 text-xs font-medium text-status-warning">
          {t("dashboard.home.analytics.flaggedDaysNote", { count: flaggedDays })}
        </p>
      )}

      {showTable ? (
        <RiskTable data={data} dayLabel={dayLabel} />
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[560px] gap-x-2"
            style={{
              gridTemplateColumns: `88px repeat(${data.days.length}, minmax(0, 1fr))`,
            }}
          >
            {/* Row 1 — forecast demand bars (single series → brand gold). */}
            <div className="flex items-end pb-1 text-[11px] leading-tight text-text-muted">
              {t("dashboard.home.analytics.rowDemand")}
            </div>
            {data.days.map((day) => {
              const value = day.demand_forecast_qty;
              const heightPct = value != null ? Math.max((value / maxDemand) * 100, 4) : 0;
              const isPeak = day.date === peakDate && value != null;
              return (
                <div key={day.date} className="group relative flex h-24 flex-col items-center justify-end">
                  {isPeak && (
                    <span className="mb-1 text-[10px] font-medium tabular-nums text-text-secondary">
                      {compactNumber(value!)}
                    </span>
                  )}
                  {value != null ? (
                    <div
                      className="w-full max-w-6 rounded-t"
                      style={{
                        height: `${heightPct}%`,
                        background: CHART.actual,
                        borderRadius: `${CHART.barRadius}px ${CHART.barRadius}px 0 0`,
                      }}
                    />
                  ) : (
                    <span className="text-[10px] text-text-muted">—</span>
                  )}
                  <div
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                    style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
                  >
                    {value != null
                      ? t("dashboard.home.analytics.demandTooltip", {
                          value: compactNumber(value),
                        })
                      : t("dashboard.home.analytics.noData")}
                  </div>
                </div>
              );
            })}

            {/* Row 2 — day labels */}
            <div />
            {data.days.map((day) => (
              <p
                key={day.date}
                className="mt-1.5 mb-2 text-center text-[11px] text-text-muted"
              >
                {dayLabel(day.date)}
              </p>
            ))}

            {/* Row 3 — inventory status cells */}
            <div className="flex items-center text-[11px] leading-tight text-text-muted">
              {t("dashboard.home.analytics.rowInventory")}
            </div>
            {data.days.map((day) => {
              const state = inventoryCell(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  className="group relative mb-1.5 flex h-9 w-full items-center justify-center rounded-lg outline-none transition-transform duration-150 hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  style={{ background: TONE_STYLES[state.tone].bg, color: TONE_STYLES[state.tone].fg }}
                  aria-label={`${dayLabel(day.date)} — ${t(state.labelKey)}`}
                >
                  <ToneIcon state={state} />
                  <CellTooltip day={day} kind="inventory" />
                </button>
              );
            })}

            {/* Row 4 — labor status cells */}
            <div className="flex items-center gap-1 text-[11px] leading-tight text-text-muted">
              <Group className="h-3.5 w-3.5 shrink-0" />
              {t("dashboard.home.analytics.rowLabor")}
            </div>
            {data.days.map((day) => {
              const state = laborCell(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  className="group relative flex h-9 w-full items-center justify-center rounded-lg outline-none transition-transform duration-150 hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                  style={{ background: TONE_STYLES[state.tone].bg, color: TONE_STYLES[state.tone].fg }}
                  aria-label={`${dayLabel(day.date)} — ${t(state.labelKey)}`}
                >
                  <ToneIcon state={state} />
                  <CellTooltip day={day} kind="labor" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** WCAG-clean twin — every cell's status and numbers as text. */
function RiskTable({
  data,
  dayLabel,
}: {
  data: DashboardCapacityRisk;
  dayLabel: (iso: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left border-collapse">
          <thead className="bg-surface-3 border-b border-surface-4">
            <tr>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.tablePeriod")}
              </th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.rowDemand")}
              </th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.rowInventory")}
              </th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.rowLabor")}
              </th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.tableCoverage")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-4">
            {data.days.map((day) => {
              const inv = inventoryCell(day);
              const lab = laborCell(day);
              return (
                <tr
                  key={day.date}
                  className="align-top transition-colors hover:bg-surface-3/40"
                >
                  <td className="px-5 py-3.5 text-sm text-text-secondary">
                    {dayLabel(day.date)}
                  </td>
                  <td className="px-5 py-3.5 text-sm tabular-nums text-text-primary">
                    {day.demand_forecast_qty != null
                      ? compactNumber(day.demand_forecast_qty)
                      : "—"}
                  </td>
                  <td
                    className="px-5 py-3.5 text-sm font-medium"
                    style={{ color: TONE_STYLES[inv.tone].fg }}
                  >
                    {t(inv.labelKey)}
                  </td>
                  <td
                    className="px-5 py-3.5 text-sm font-medium"
                    style={{ color: TONE_STYLES[lab.tone].fg }}
                  >
                    {t(lab.labelKey)}
                  </td>
                  <td className="px-5 py-3.5 text-sm tabular-nums text-text-secondary">
                    {day.labor.coverage_pct != null ? `${day.labor.coverage_pct}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
