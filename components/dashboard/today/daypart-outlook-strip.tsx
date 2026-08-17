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
import type {
  Daypart,
  DaypartDemandShare,
  DaypartOutlook,
} from "@/services/production-intelligence/types";

const DAYPART_ORDER: Daypart[] = ["BREAKFAST", "LUNCH", "DINNER", "LATE_NIGHT"];

type Row = { daypart: Daypart; label: string; value: number };

/**
 * Pre-service breakdown of today's forecast by daypart, in two independent,
 * cross-item-safe measures — deliberately not one "total covers" number,
 * since PrepIQ's forecasts are per-item quantities in different physical
 * units (KG rice, PCS burgers) that can't be summed into a demand count
 * honestly (see backend daypart_profile.py's docstrings on both functions
 * this reads from).
 *
 * Each daypart is one bar in a single-hue emphasis pattern — gold for the
 * busiest window, gray for the rest — the same CHART.actual/forecast pair
 * already validated (dataviz six-checks) for the flagship line charts, not
 * a new categorical palette. Breakfast→lunch→dinner→late-night is an
 * ordered sequence, not an arbitrary category set, so this is the correct
 * encoding, not just the cheapest one.
 *
 * Distinct from LiveMonitorSection below, which is continuous mid-service
 * pace tracking and is not derived from this pre-service snapshot.
 */
export function DaypartOutlookStrip({
  outlook,
  demand,
}: {
  outlook: DaypartOutlook | null | undefined;
  demand: DaypartDemandShare | null | undefined;
}) {
  const { t } = useTranslation();
  const { money } = useMoney();

  const labels: Record<Daypart, string> = {
    BREAKFAST: t("today.daypartOutlook.breakfast"),
    LUNCH: t("today.daypartOutlook.lunch"),
    DINNER: t("today.daypartOutlook.dinner"),
    LATE_NIGHT: t("today.daypartOutlook.lateNight"),
  };

  const moneyRows = useMemo<Row[]>(
    () =>
      DAYPART_ORDER.map((daypart) => ({
        daypart,
        label: labels[daypart],
        value: outlook?.daypart_totals[daypart] ?? 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outlook],
  );
  const demandRows = useMemo<Row[]>(
    () =>
      DAYPART_ORDER.map((daypart) => ({
        daypart,
        label: labels[daypart],
        value: (demand?.daypart_shares[daypart] ?? 0) * 100,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demand],
  );

  const hasMoney = moneyRows.some((row) => row.value > 0);
  const hasDemand = demandRows.some((row) => row.value > 0);

  // No data on either axis yet — say nothing rather than render two empty charts.
  if (!hasMoney && !hasDemand) return null;

  return (
    <div className="mb-8 pb-8 border-b border-surface-4/50">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {t("today.daypartOutlook.eyebrow")}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {hasMoney ? (
          <DaypartBarCard
            title={t("today.daypartOutlook.money")}
            rows={moneyRows}
            busiest={outlook?.busiest_daypart ?? null}
            busiestSentence={
              outlook?.busiest_daypart
                ? t("today.daypartOutlook.busiestSentence", {
                    daypart: labels[outlook.busiest_daypart],
                  })
                : null
            }
            formatValue={(value) => money(value)}
            tickFormatter={(value) => compactNumber(value)}
          />
        ) : null}
        {hasDemand ? (
          <DaypartBarCard
            title={t("today.daypartOutlook.demand")}
            rows={demandRows}
            busiest={demand?.busiest_daypart ?? null}
            busiestSentence={
              demand?.busiest_daypart
                ? t("today.daypartOutlook.busiestSentence", {
                    daypart: labels[demand.busiest_daypart],
                  })
                : null
            }
            formatValue={(value) => `${Math.round(value)}%`}
            tickFormatter={(value) => `${Math.round(value)}%`}
          />
        ) : null}
      </div>
    </div>
  );
}

function DaypartTooltip({
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

function DaypartBarCard({
  title,
  rows,
  busiest,
  busiestSentence,
  formatValue,
  tickFormatter,
}: {
  title: string;
  rows: Row[];
  busiest: Daypart | null;
  busiestSentence: string | null;
  formatValue: (value: number) => string;
  tickFormatter: (value: number) => string;
}) {
  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
        {title}
      </p>
      {busiestSentence ? (
        <p className="mt-1 text-xs text-text-secondary">{busiestSentence}</p>
      ) : null}
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART.axisText, fontSize: 10 }}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={tickFormatter}
              tick={{ fill: CHART.axisText, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: CHART.grid, opacity: 0.3 }}
              content={<DaypartTooltip formatValue={formatValue} />}
            />
            <Bar
              dataKey="value"
              radius={[CHART.barRadius, CHART.barRadius, 0, 0]}
              maxBarSize={CHART.barMaxWidth}
              isAnimationActive={false}
              label={{
                position: "top",
                fill: CHART.axisText,
                fontSize: 10,
                formatter: (value: unknown) =>
                  typeof value === "number" && value > 0 ? formatValue(value) : "",
              }}
            >
              {rows.map((row) => (
                <Cell
                  key={row.daypart}
                  fill={row.daypart === busiest ? CHART.actual : CHART.forecast}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
