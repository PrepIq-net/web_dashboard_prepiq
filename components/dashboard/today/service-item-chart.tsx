"use client";

import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useTranslation } from "@/lib/i18n";
import { formatQuantity } from "@/lib/format";
import { CHART, compactNumber } from "@/components/dashboard/home/analytics/chart-theme";
import type { IntradayTimelineItem } from "@/services/production-intelligence/types";

/**
 * Cumulative sold vs this dish's typical pace, for the live service cards.
 *
 * Deliberately the same visual language as the dashboard analytics lanes:
 * gold area + solid line for what actually happened, dashed neutral gray for
 * the reference curve, so a manager reads both surfaces the same way.
 * Identity never rides on hue alone — the dash pattern and legend carry it.
 */

type ChartPoint = {
  hour: number;
  sold: number | null;
  expected: number | null;
};

function formatHourLabel(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

function ServiceTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  unit: string;
}) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
    >
      <p className="mb-1.5 text-xs font-semibold text-text-primary">
        {formatHourLabel(point.hour)}
      </p>
      <div className="space-y-1">
        {point.sold != null && (
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-[11px] text-text-muted">
              <span
                className="inline-block h-0.5 w-3.5 rounded"
                style={{ background: CHART.actual }}
              />
              {t("today.live.chartSoldSeries")}
            </span>
            <span className="text-xs font-semibold text-text-primary">
              {formatQuantity(point.sold, unit)}
            </span>
          </div>
        )}
        {point.expected != null && (
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-[11px] text-text-muted">
              <span
                className="inline-block w-3.5 border-t-2 border-dashed"
                style={{ borderColor: CHART.forecast }}
              />
              {t("today.live.chartExpectedSeries")}
            </span>
            <span className="text-xs font-semibold text-text-primary">
              {formatQuantity(point.expected, unit)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ServiceItemChart({
  timelineItem,
  unit,
  plannedQty,
}: {
  timelineItem: IntradayTimelineItem | undefined;
  unit: string;
  plannedQty: number | null;
}) {
  const { t } = useTranslation();

  const data = useMemo<ChartPoint[]>(() => {
    if (!timelineItem) return [];
    const soldByHour = new Map(
      timelineItem.sold_series.map((point) => [point.hour, point.cumulative]),
    );
    const expectedByHour = new Map(
      timelineItem.expected_series.map((point) => [
        point.hour,
        point.cumulative,
      ]),
    );

    // Trim the dead hours before service so the curve fills the plot.
    const firstActive = Math.min(
      timelineItem.expected_series.find((p) => p.cumulative > 0.01)?.hour ?? 8,
      timelineItem.sold_series.find((p) => p.cumulative > 0.01)?.hour ?? 8,
    );
    const lastHour = Math.max(
      timelineItem.expected_series.at(-1)?.hour ?? 23,
      timelineItem.sold_series.at(-1)?.hour ?? 12,
    );
    const start = Math.max(0, firstActive - 1);

    const points: ChartPoint[] = [];
    for (let hour = start; hour <= lastHour; hour += 1) {
      points.push({
        hour,
        // Sales stop at "now" — a flat line to midnight would read as a
        // stall rather than as an absence of data.
        sold: soldByHour.has(hour) ? (soldByHour.get(hour) ?? 0) : null,
        expected: expectedByHour.has(hour)
          ? (expectedByHour.get(hour) ?? 0)
          : null,
      });
    }
    return points;
  }, [timelineItem]);

  if (!timelineItem || data.length < 2) {
    return (
      <p className="px-1 py-3 text-xs text-text-muted">
        {t("today.live.chartNoData")}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[10px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ background: CHART.actual }}
          />
          {t("today.live.chartSoldSeries")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 border-t-2 border-dashed"
            style={{ borderColor: CHART.forecast }}
          />
          {t("today.live.chartExpectedSeries")}
        </span>
        {plannedQty != null ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dotted border-text-muted" />
            {t("today.live.chartPlannedSeries")}
          </span>
        ) : null}
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={CHART.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="hour"
              tickFormatter={formatHourLabel}
              tick={{ fill: CHART.axisText, fontSize: 10 }}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              tickFormatter={compactNumber}
              tick={{ fill: CHART.axisText, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip
              cursor={{ stroke: CHART.axisText, strokeWidth: 1 }}
              content={<ServiceTooltip unit={unit} />}
            />
            {plannedQty != null ? (
              <ReferenceLine
                y={plannedQty}
                stroke={CHART.axisText}
                strokeDasharray="2 4"
                strokeWidth={1}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="sold"
              stroke="none"
              fill={CHART.actual}
              fillOpacity={CHART.areaOpacity}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke={CHART.forecast}
              strokeWidth={CHART.lineWidth}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{
                r: 3.5,
                fill: CHART.forecast,
                stroke: CHART.surface,
                strokeWidth: 2,
              }}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="sold"
              stroke={CHART.actual}
              strokeWidth={CHART.lineWidth}
              strokeLinecap="round"
              dot={false}
              activeDot={{
                r: 3.5,
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
