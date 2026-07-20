"use client";

import { useMemo, useState } from "react";
import { Table2Columns, GraphUp } from "iconoir-react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type {
  DashboardSeries,
  DashboardSeriesPoint,
} from "@/services/production-intelligence/types";
import { formatMoney } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import { CHART, compactNumber } from "./chart-theme";

type Interval = "hourly" | "daily" | "weekly";

// One lane = one measure = one axis. Money and quantity never share a plot;
// the two lanes share the x-axis, crosshair and tooltip via syncId instead
// (the honest version of the "dual-axis" ask — two scales on one plot invent
// correlations).
type LaneKind = "sales" | "demand";

function useBucketLabel(interval: Interval, language: string) {
  const locale = language === "fr" ? "fr-FR" : "en-US";
  return useMemo(() => {
    return (bucket: string) => {
      if (interval === "hourly") return bucket.slice(11, 16);
      const date = new Date(`${bucket.slice(0, 10)}T00:00:00`);
      if (interval === "weekly") {
        return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
      }
      return date.toLocaleDateString(locale, { weekday: "short", day: "numeric" });
    };
  }, [interval, locale]);
}

function FidelityBadge({ point }: { point: DashboardSeriesPoint }) {
  const { t } = useTranslation();
  if (!point.forecast_fidelity) return null;
  const operational = point.forecast_fidelity === "OPERATIONAL";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        operational
          ? "bg-brand-gold/15 text-brand-gold"
          : "bg-surface-4 text-text-muted"
      }`}
    >
      {operational
        ? t("dashboard.home.analytics.fidelityOperational")
        : t("dashboard.home.analytics.fidelityBaseline")}
    </span>
  );
}

function LaneTooltip({
  active,
  payload,
  lane,
  currencyCode,
  interval,
  language,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardSeriesPoint }>;
  lane: LaneKind;
  currencyCode: string;
  interval: Interval;
  language: string;
}) {
  const { t } = useTranslation();
  const bucketLabel = useBucketLabel(interval, language);
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  const fmt = (value: number | null) => {
    if (value == null) return "—";
    return lane === "sales"
      ? formatMoney(value, currencyCode)
      : `${compactNumber(value)} ${t("dashboard.home.analytics.unitsSuffix")}`;
  };
  const actual = lane === "sales" ? point.sales_actual : point.demand_actual;
  const forecast = lane === "sales" ? point.sales_forecast : point.demand_forecast;
  const variancePct =
    actual != null && forecast != null && forecast > 0
      ? ((actual - forecast) / forecast) * 100
      : null;

  return (
    <div
      className="rounded-lg border px-4 py-3 shadow-lg"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-semibold text-text-primary">
          {bucketLabel(point.bucket)}
        </p>
        <FidelityBadge point={point} />
      </div>
      <div className="space-y-1.5">
        {actual != null && (
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-xs text-text-muted">
              <span
                className="inline-block h-0.5 w-4 rounded"
                style={{ background: CHART.actual }}
              />
              {t("dashboard.home.analytics.seriesActual")}
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {fmt(actual)}
            </span>
          </div>
        )}
        {forecast != null && (
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-xs text-text-muted">
              <span
                className="inline-block w-4 border-t-2 border-dashed"
                style={{ borderColor: CHART.forecast }}
              />
              {t("dashboard.home.analytics.seriesForecast")}
            </span>
            <span className="text-sm font-semibold text-text-primary">
              {fmt(forecast)}
            </span>
          </div>
        )}
        {variancePct != null && (
          <p
            className={`pt-1 text-xs font-medium ${
              variancePct < -5 ? "text-status-critical" : "text-text-muted"
            }`}
          >
            {t("dashboard.home.analytics.varianceLine", {
              value: `${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}`,
            })}
          </p>
        )}
      </div>
    </div>
  );
}

function Lane({
  lane,
  data,
  forecastStartBucket,
  currencyCode,
  interval,
  language,
  title,
}: {
  lane: LaneKind;
  data: DashboardSeriesPoint[];
  forecastStartBucket: string | null;
  currencyCode: string;
  interval: Interval;
  language: string;
  title: string;
}) {
  const bucketLabel = useBucketLabel(interval, language);
  const actualKey = lane === "sales" ? "sales_actual" : "demand_actual";
  const forecastKey = lane === "sales" ? "sales_forecast" : "demand_forecast";

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
        {title}
      </p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            syncId="sales-demand"
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              stroke={CHART.grid}
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="bucket"
              tickFormatter={bucketLabel}
              tick={{ fill: CHART.axisText, fontSize: 11 }}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tickFormatter={compactNumber}
              tick={{ fill: CHART.axisText, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            {forecastStartBucket && (
              <ReferenceArea
                x1={forecastStartBucket}
                fill={CHART.forecast}
                fillOpacity={0.04}
              />
            )}
            <Tooltip
              cursor={{ stroke: CHART.axisText, strokeWidth: 1 }}
              content={
                <LaneTooltip
                  lane={lane}
                  currencyCode={currencyCode}
                  interval={interval}
                  language={language}
                />
              }
            />
            <Area
              type="monotone"
              dataKey={actualKey}
              stroke="none"
              fill={CHART.actual}
              fillOpacity={CHART.areaOpacity}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey={forecastKey}
              stroke={CHART.forecast}
              strokeWidth={CHART.lineWidth}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{
                r: 4,
                fill: CHART.forecast,
                stroke: CHART.surface,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey={actualKey}
              stroke={CHART.actual}
              strokeWidth={CHART.lineWidth}
              strokeLinecap="round"
              dot={false}
              activeDot={{
                r: 4,
                fill: CHART.actual,
                stroke: CHART.surface,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SalesDemandChart({
  series,
  canSeeFinancials,
}: {
  series: DashboardSeries;
  canSeeFinancials: boolean;
}) {
  const { t, language } = useTranslation();
  const [showTable, setShowTable] = useState(false);
  const interval = series.interval;
  const bucketLabel = useBucketLabel(interval, language);
  const currencyCode = series.currency.code;

  const forecastStartBucket = useMemo(() => {
    const first = series.points.find((point) => point.is_forecast_window);
    return first?.bucket ?? null;
  }, [series.points]);

  return (
    <div>
      {/* Legend — the dependable identity channel for the two series. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-xs text-text-secondary">
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-5 rounded"
              style={{ background: CHART.actual }}
            />
            {t("dashboard.home.analytics.seriesActual")}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="inline-block w-5 border-t-2 border-dashed"
              style={{ borderColor: CHART.forecast }}
            />
            {t("dashboard.home.analytics.seriesForecast")}
          </span>
          {forecastStartBucket && (
            <span className="text-text-muted">
              {t("dashboard.home.analytics.forecastWindowNote")}
            </span>
          )}
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

      {showTable ? (
        <SeriesTable
          series={series}
          canSeeFinancials={canSeeFinancials}
          bucketLabel={bucketLabel}
        />
      ) : (
        <div className="space-y-6">
          {canSeeFinancials && (
            <Lane
              lane="sales"
              data={series.points}
              forecastStartBucket={forecastStartBucket}
              currencyCode={currencyCode}
              interval={interval}
              language={language}
              title={
                series.currency.is_multi_currency
                  ? t("dashboard.home.analytics.salesLaneTitleUsd")
                  : t("dashboard.home.analytics.salesLaneTitle", {
                      currency: currencyCode,
                    })
              }
            />
          )}
          <Lane
            lane="demand"
            data={series.points}
            forecastStartBucket={forecastStartBucket}
            currencyCode={currencyCode}
            interval={interval}
            language={language}
            title={t("dashboard.home.analytics.demandLaneTitle")}
          />
        </div>
      )}
    </div>
  );
}

/** WCAG-clean twin of the chart — every plotted value, no hover required. */
function SeriesTable({
  series,
  canSeeFinancials,
  bucketLabel,
}: {
  series: DashboardSeries;
  canSeeFinancials: boolean;
  bucketLabel: (bucket: string) => string;
}) {
  const { t } = useTranslation();
  const currencyCode = series.currency.code;
  const money = (value: number | null) =>
    value == null ? "—" : formatMoney(value, currencyCode);
  const qty = (value: number | null) =>
    value == null ? "—" : compactNumber(value);

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left border-collapse">
          <thead className="bg-surface-3 border-b border-surface-4">
            <tr>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.tablePeriod")}
              </th>
              {canSeeFinancials && (
                <>
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    {t("dashboard.home.analytics.tableSalesActual")}
                  </th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                    {t("dashboard.home.analytics.tableSalesForecast")}
                  </th>
                </>
              )}
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.tableDemandActual")}
              </th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.tableDemandForecast")}
              </th>
              <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                {t("dashboard.home.analytics.tableFidelity")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-4">
            {series.points.map((point) => (
              <tr
                key={point.bucket}
                className="align-top transition-colors hover:bg-surface-3/40"
              >
                <td className="px-5 py-3.5 text-sm text-text-secondary">
                  {bucketLabel(point.bucket)}
                </td>
                {canSeeFinancials && (
                  <>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-text-primary">
                      {money(point.sales_actual)}
                    </td>
                    <td className="px-5 py-3.5 text-sm tabular-nums text-text-secondary">
                      {money(point.sales_forecast)}
                    </td>
                  </>
                )}
                <td className="px-5 py-3.5 text-sm tabular-nums text-text-primary">
                  {qty(point.demand_actual)}
                </td>
                <td className="px-5 py-3.5 text-sm tabular-nums text-text-secondary">
                  {qty(point.demand_forecast)}
                </td>
                <td className="px-5 py-3.5 text-xs text-text-muted">
                  {point.forecast_fidelity
                    ? point.forecast_fidelity === "OPERATIONAL"
                      ? t("dashboard.home.analytics.fidelityOperational")
                      : t("dashboard.home.analytics.fidelityBaseline")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
