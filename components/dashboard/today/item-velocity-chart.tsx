"use client";

import { useMemo, type ReactNode } from "react";
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
import {
  CHART,
  compactNumber,
} from "@/components/dashboard/home/analytics/chart-theme";
import type { IntradayTimelineItem } from "@/services/production-intelligence/types";

/**
 * Today's cumulative sales against this dish's own historical pace, with a
 * ±1σ band of genuine day-to-day variation.
 *
 * The band comes from the backend's per-hour standard deviation across the
 * sampled days — it is measured, not modelled, so "outside the band" really
 * does mean today is behaving unusually for this dish. When there are too
 * few comparable days the band is omitted rather than faked.
 */

type VelocityPoint = {
  hour: number;
  sold: number | null;
  expected: number | null;
  /** [lower, upper] — recharts renders a two-value Area as a band. */
  band: [number, number] | null;
};

function formatHourLabel(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

function VelocityTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: VelocityPoint }>;
  unit: string;
}) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  const rows: Array<{ label: string; value: string; swatch: ReactNode }> = [];
  if (point.sold != null) {
    rows.push({
      label: t("workspace.today.itemDetail.velocity.sold"),
      value: formatQuantity(point.sold, unit),
      swatch: (
        <span
          className="inline-block h-0.5 w-3.5 rounded"
          style={{ background: CHART.actual }}
        />
      ),
    });
  }
  if (point.expected != null) {
    rows.push({
      label: t("workspace.today.itemDetail.velocity.expected"),
      value: formatQuantity(point.expected, unit),
      swatch: (
        <span
          className="inline-block w-3.5 border-t-2 border-dashed"
          style={{ borderColor: CHART.forecast }}
        />
      ),
    });
  }
  if (point.band) {
    rows.push({
      label: t("workspace.today.itemDetail.velocity.band"),
      value: `${formatQuantity(point.band[0], unit)} – ${formatQuantity(
        point.band[1],
        unit,
      )}`,
      swatch: (
        <span
          className="inline-block h-2 w-3.5 rounded-sm"
          style={{ background: CHART.forecast, opacity: 0.25 }}
        />
      ),
    });
  }

  return (
    <div
      className="rounded-lg border px-3 py-2.5 shadow-lg"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
    >
      <p className="mb-1.5 text-xs font-semibold text-text-primary">
        {formatHourLabel(point.hour)}
      </p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-6"
          >
            <span className="flex items-center gap-2 text-[11px] text-text-muted">
              {row.swatch}
              {row.label}
            </span>
            <span className="text-xs font-semibold text-text-primary">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ItemVelocityChart({
  timelineItem,
  unit,
  plannedQty,
  currentHour,
}: {
  timelineItem: IntradayTimelineItem | undefined;
  unit: string;
  plannedQty: number | null;
  currentHour: number | undefined;
}) {
  const { t } = useTranslation();

  const { data, hasBand } = useMemo(() => {
    if (!timelineItem) return { data: [] as VelocityPoint[], hasBand: false };

    const soldByHour = new Map(
      timelineItem.sold_series.map((p) => [p.hour, p.cumulative]),
    );
    const expectedByHour = new Map(
      timelineItem.expected_series.map((p) => [p.hour, p.cumulative]),
    );
    const bandByHour = new Map(
      (timelineItem.expected_band ?? []).map((p) => [
        p.hour,
        [p.lower, p.upper] as [number, number],
      ]),
    );

    const firstActive = Math.min(
      timelineItem.expected_series.find((p) => p.cumulative > 0.01)?.hour ?? 8,
      timelineItem.sold_series.find((p) => p.cumulative > 0.01)?.hour ?? 8,
    );
    const lastHour = Math.max(
      timelineItem.expected_series.at(-1)?.hour ?? 23,
      timelineItem.sold_series.at(-1)?.hour ?? 12,
    );
    const start = Math.max(0, firstActive - 1);

    const points: VelocityPoint[] = [];
    for (let hour = start; hour <= lastHour; hour += 1) {
      points.push({
        hour,
        sold: soldByHour.has(hour) ? (soldByHour.get(hour) ?? 0) : null,
        expected: expectedByHour.has(hour)
          ? (expectedByHour.get(hour) ?? 0)
          : null,
        band: bandByHour.get(hour) ?? null,
      });
    }
    return {
      data: points,
      hasBand: points.some((point) => point.band !== null),
    };
  }, [timelineItem]);

  // Where today sits against the typical curve, at the latest shared hour.
  const paceNote = useMemo(() => {
    const latest = [...data]
      .reverse()
      .find((point) => point.sold != null && (point.expected ?? 0) > 0.01);
    if (!latest || latest.expected == null || latest.sold == null) return null;
    const ratio = latest.sold / latest.expected;
    const pct = `${Math.round(Math.abs(ratio - 1) * 100)}%`;
    if (latest.band && latest.sold >= latest.band[0] && latest.sold <= latest.band[1]) {
      return t("workspace.today.itemDetail.velocity.onPace");
    }
    if (ratio >= 1.05) {
      return t("workspace.today.itemDetail.velocity.aheadOfPace", { pct });
    }
    if (ratio <= 0.95) {
      return t("workspace.today.itemDetail.velocity.behindPace", { pct });
    }
    return t("workspace.today.itemDetail.velocity.onPace");
  }, [data, t]);

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
        {t("workspace.today.itemDetail.velocity.title")}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {t("workspace.today.itemDetail.velocity.description")}
      </p>

      <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
        {data.length < 2 ? (
          <p className="py-6 text-center text-sm text-text-muted">
            {t("workspace.today.itemDetail.velocity.noData")}
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-4 text-[10px] text-text-muted">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-4 rounded"
                  style={{ background: CHART.actual }}
                />
                {t("workspace.today.itemDetail.velocity.sold")}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4 border-t-2 border-dashed"
                  style={{ borderColor: CHART.forecast }}
                />
                {t("workspace.today.itemDetail.velocity.expected")}
              </span>
              {hasBand ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-4 rounded-sm"
                    style={{ background: CHART.forecast, opacity: 0.25 }}
                  />
                  {t("workspace.today.itemDetail.velocity.band")}
                </span>
              ) : null}
              {plannedQty != null ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-4 border-t border-dotted border-text-muted" />
                  {t("workspace.today.itemDetail.velocity.planned")}
                </span>
              ) : null}
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke={CHART.grid}
                    strokeWidth={1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={formatHourLabel}
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
                    width={40}
                  />
                  <Tooltip
                    cursor={{ stroke: CHART.axisText, strokeWidth: 1 }}
                    content={<VelocityTooltip unit={unit} />}
                  />

                  {/* Measured ±1σ spread — drawn first so the lines sit on top. */}
                  {hasBand ? (
                    <Area
                      type="monotone"
                      dataKey="band"
                      stroke="none"
                      fill={CHART.forecast}
                      fillOpacity={0.16}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  ) : null}

                  {plannedQty != null ? (
                    <ReferenceLine
                      y={plannedQty}
                      stroke={CHART.axisText}
                      strokeDasharray="2 4"
                      strokeWidth={1}
                    />
                  ) : null}
                  {currentHour != null ? (
                    <ReferenceLine
                      x={currentHour}
                      stroke={CHART.axisText}
                      strokeOpacity={0.5}
                      strokeWidth={1}
                    />
                  ) : null}

                  <Line
                    type="monotone"
                    dataKey="expected"
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
                    dataKey="sold"
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

            {paceNote ? (
              <p className="mt-3 border-t border-surface-4 pt-3 text-xs text-text-secondary">
                {paceNote}
              </p>
            ) : null}
            {!hasBand ? (
              <p className="mt-2 text-[11px] text-text-muted">
                {t("workspace.today.itemDetail.velocity.noBand")}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
