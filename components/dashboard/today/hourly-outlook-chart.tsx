"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "@/lib/i18n";
import { useMoney } from "@/lib/branch-currency";
import {
  CHART,
  compactNumber,
} from "@/components/dashboard/home/analytics/chart-theme";
import type { HourlyOutlook } from "@/services/production-intelligence/types";

type Row = { hour: number; label: string; value: number };

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}${period}`;
}

/**
 * Pre-service forecast by hour, not just daypart — the finer-grained sibling
 * of DaypartOutlookStrip above, from the same real hour-of-day CDF that
 * already powers the live pace chart (service-item-chart.tsx). Only hours
 * with a real forecast come back from the backend (see hourly_outlook's
 * docstring on daypart_profile.py) — a closed overnight hour is simply
 * absent, not a zero bar.
 *
 * Unlike the 4-bar Daypart Outlook, this can be 12-18 bars for a typical
 * operating day, so it gets its own full-width row rather than sharing the
 * 2-column grid, and skips on-bar value labels (the dataviz skill's "never a
 * number on every point" rule) in favor of the tooltip. The single busiest
 * hour still gets the gold/gray emphasis pattern — a visual anchor, not a
 * narrated claim (hour-to-hour amounts are noisier than daypart totals, so
 * this chart doesn't assert a "busiest hour" sentence the way the daypart
 * chart does).
 */
export function HourlyOutlookChart({
  outlook,
}: {
  outlook: HourlyOutlook | null | undefined;
}) {
  const { t } = useTranslation();
  const { money } = useMoney();

  const rows = useMemo<Row[]>(() => {
    if (!outlook) return [];
    return Object.entries(outlook.hourly_totals)
      .map(([hour, value]) => ({
        hour: Number(hour),
        label: formatHourLabel(Number(hour)),
        value,
      }))
      .sort((a, b) => a.hour - b.hour);
  }, [outlook]);

  if (rows.length === 0) return null;

  const peakHour = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]).hour;

  return (
    <div className="mb-8 pb-8 border-b border-surface-4/50">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {t("today.hourlyOutlook.eyebrow")}
      </p>
      <div className="mt-4 rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART.axisText, fontSize: 10 }}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(value: number) => compactNumber(value)}
                tick={{ fill: CHART.axisText, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ fill: CHART.grid, opacity: 0.3 }}
                content={<HourlyTooltip formatValue={(value) => money(value)} />}
              />
              <Bar
                dataKey="value"
                radius={[CHART.barRadius, CHART.barRadius, 0, 0]}
                maxBarSize={CHART.barMaxWidth}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.hour}
                    fill={row.hour === peakHour ? CHART.actual : CHART.forecast}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function HourlyTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
    >
      <p className="text-xs font-semibold text-text-primary">{row.label}</p>
      <p className="text-xs text-text-secondary">{formatValue(row.value)}</p>
    </div>
  );
}
