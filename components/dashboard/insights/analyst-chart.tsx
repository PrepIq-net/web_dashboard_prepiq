"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART,
  compactNumber,
} from "@/components/dashboard/home/analytics/chart-theme";
import type { AnalystArtifact } from "@/services/insights/types";

/**
 * Renders a chart artifact from the Analyst chat.
 *
 * The backend never fetches on the artifact's behalf — `labels`/`series` are
 * numbers the model already read from a grounded tool result this same turn
 * (see `insights/analyst_tools.py::_t_render_chart`) — so this component only
 * has to draw what it is given, the same trust boundary every other card in
 * this app already has with its data.
 *
 * Only two series get a distinct, CVD-validated color (chart-theme.ts's
 * `actual`/`forecast` pair); a third or fourth series — rare, since most
 * questions compare one or two metrics — reuses gold at falling opacity
 * rather than introducing an unvalidated hue.
 */

const SERIES_COLORS = [CHART.actual, CHART.forecast];
const SERIES_DASH = [undefined, "6 4"];

function seriesColor(index: number): string {
  return SERIES_COLORS[index] ?? CHART.actual;
}

function seriesOpacity(index: number): number {
  return index < 2 ? 1 : Math.max(0.35, 1 - (index - 1) * 0.25);
}

function AnalystChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
  unit?: string | null;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2.5 shadow-lg"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
    >
      <p className="mb-1.5 text-xs font-semibold text-text-primary">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-[11px] text-text-muted">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>
            <span className="text-xs font-semibold text-text-primary">
              {entry.value == null ? "—" : compactNumber(entry.value)}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalystChart({ artifact }: { artifact: AnalystArtifact }) {
  const labels = artifact.labels ?? [];
  const series = artifact.series ?? [];

  const data = useMemo(
    () =>
      labels.map((label, i) => {
        const row: Record<string, string | number | null> = { label };
        for (const s of series) row[s.name] = s.values[i] ?? null;
        return row;
      }),
    [labels, series],
  );

  if (data.length === 0 || series.length === 0) return null;

  const isBar = artifact.chart_type === "bar";
  const tickFormatter = (value: number) => compactNumber(value);

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4">
      {artifact.title ? (
        <p className="mb-3 text-xs font-semibold text-text-primary">
          {artifact.title}
        </p>
      ) : null}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {isBar ? (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART.axisText, fontSize: 11 }}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickFormatter={tickFormatter}
                tick={{ fill: CHART.axisText, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: CHART.grid, opacity: 0.3 }}
                content={<AnalystChartTooltip unit={artifact.unit} />}
              />
              {series.map((s, i) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  fill={seriesColor(i)}
                  fillOpacity={seriesOpacity(i)}
                  radius={[CHART.barRadius, CHART.barRadius, 0, 0]}
                  maxBarSize={CHART.barMaxWidth}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART.grid} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: CHART.axisText, fontSize: 11 }}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tickFormatter={tickFormatter}
                tick={{ fill: CHART.axisText, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<AnalystChartTooltip unit={artifact.unit} />} />
              {series.map((s, i) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={seriesColor(i)}
                  strokeOpacity={seriesOpacity(i)}
                  strokeWidth={CHART.lineWidth}
                  strokeDasharray={SERIES_DASH[i]}
                  dot={false}
                  activeDot={{ r: 4, fill: seriesColor(i), stroke: CHART.surface, strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {series.length > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-text-muted">
          {series.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded"
                style={{
                  background: seriesColor(i),
                  opacity: seriesOpacity(i),
                  borderTop: isBar ? undefined : SERIES_DASH[i] ? "2px dashed" : undefined,
                  borderColor: isBar ? undefined : seriesColor(i),
                }}
              />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
