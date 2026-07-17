"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatQuantity } from "@/lib/format";
import type {
  IntradayTimeline,
  IntradayTimelineItem,
} from "@/services/production-intelligence/types";

/**
 * Per-dish intraday timeline: cumulative sold (solid) vs the expected pace
 * curve (dashed) with the plan as a horizontal tick. Situational awareness
 * only — it never tells anyone to cook.
 *
 * Identity is never color-alone: sold is the only chromatic series (solid
 * gold), expected is neutral and dashed, the plan is a muted horizontal
 * tick. Rows arrive sorted by pace deviation; on-pace dishes collapse behind
 * a toggle so a long menu leads with what matters.
 */

type LiveTimelineSectionProps = {
  timeline: IntradayTimeline | null | undefined;
};

function seriesBounds(item: IntradayTimelineItem) {
  const soldMax = item.sold_series.at(-1)?.cumulative ?? 0;
  const expectedMax = item.expected_series.at(-1)?.cumulative ?? 0;
  const yMax =
    Math.max(
      soldMax,
      expectedMax,
      item.planned_qty ?? 0,
      item.forecast_qty,
      1,
    ) * 1.08;

  const firstActiveHour = Math.min(
    item.expected_series.find((p) => p.cumulative > 0.01)?.hour ?? 8,
    item.sold_series.find((p) => p.cumulative > 0.01)?.hour ?? 8,
  );
  const lastHour = Math.max(
    item.expected_series.at(-1)?.hour ?? 23,
    item.sold_series.at(-1)?.hour ?? 12,
  );
  return { yMax, firstActiveHour: Math.max(0, firstActiveHour - 1), lastHour };
}

function buildPath(
  points: { hour: number; cumulative: number }[],
  xOf: (hour: number) => number,
  yOf: (value: number) => number,
) {
  if (!points.length) return "";
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${xOf(point.hour).toFixed(2)},${yOf(point.cumulative).toFixed(2)}`,
    )
    .join(" ");
}

function Sparkline({ item }: { item: IntradayTimelineItem }) {
  const { yMax, firstActiveHour, lastHour } = seriesBounds(item);
  const width = 120;
  const height = 36;
  const span = Math.max(lastHour - firstActiveHour, 1);
  const xOf = (hour: number) =>
    ((hour - firstActiveHour) / span) * (width - 4) + 2;
  const yOf = (value: number) => height - 3 - (value / yMax) * (height - 6);

  const expectedPath = buildPath(
    item.expected_series.filter((p) => p.hour >= firstActiveHour),
    xOf,
    yOf,
  );
  const soldPath = buildPath(
    item.sold_series.filter((p) => p.hour >= firstActiveHour),
    xOf,
    yOf,
  );
  const lastSold = item.sold_series.at(-1);
  const planY = item.planned_qty != null ? yOf(item.planned_qty) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {planY !== null ? (
        <line
          x1={2}
          x2={width - 2}
          y1={planY}
          y2={planY}
          className="stroke-text-muted/40"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      ) : null}
      {expectedPath ? (
        <path
          d={expectedPath}
          fill="none"
          className="stroke-text-muted/60"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      ) : null}
      {soldPath ? (
        <path
          d={soldPath}
          fill="none"
          className="stroke-brand-gold"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {lastSold ? (
        <circle
          cx={xOf(lastSold.hour)}
          cy={yOf(lastSold.cumulative)}
          r={2.5}
          className="fill-brand-gold"
        />
      ) : null}
    </svg>
  );
}

function formatHourLabel(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric" });
}

function DetailChart({ item }: { item: IntradayTimelineItem }) {
  const { t } = useTranslation();
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const { yMax, firstActiveHour, lastHour } = seriesBounds(item);

  const width = 720;
  const height = 200;
  const pad = { top: 12, right: 16, bottom: 24, left: 40 };
  const span = Math.max(lastHour - firstActiveHour, 1);
  const xOf = (hour: number) =>
    pad.left + ((hour - firstActiveHour) / span) * (width - pad.left - pad.right);
  const yOf = (value: number) =>
    height - pad.bottom - (value / yMax) * (height - pad.top - pad.bottom);

  const expectedVisible = item.expected_series.filter(
    (p) => p.hour >= firstActiveHour,
  );
  const soldVisible = item.sold_series.filter((p) => p.hour >= firstActiveHour);
  const expectedPath = buildPath(expectedVisible, xOf, yOf);
  const soldPath = buildPath(soldVisible, xOf, yOf);
  const planY = item.planned_qty != null ? yOf(item.planned_qty) : null;

  const gridValues = [0.25, 0.5, 0.75, 1].map((f) =>
    Math.round((yMax / 1.08) * f),
  );
  const hourTicks: number[] = [];
  for (let hour = firstActiveHour; hour <= lastHour; hour += span > 10 ? 3 : 2) {
    hourTicks.push(hour);
  }

  const hoverSold = hoverHour !== null
    ? soldVisible.filter((p) => p.hour <= hoverHour).at(-1)?.cumulative
    : undefined;
  const hoverExpected = hoverHour !== null
    ? expectedVisible.filter((p) => p.hour <= hoverHour).at(-1)?.cumulative
    : undefined;

  return (
    <div className="overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[480px]"
        role="img"
        aria-label={t("today.timeline.chartAria", { item: item.item_title })}
        onMouseMove={(event) => {
          const svg = event.currentTarget;
          const rect = svg.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * width;
          const hour = Math.round(
            firstActiveHour + ((x - pad.left) / (width - pad.left - pad.right)) * span,
          );
          setHoverHour(Math.min(Math.max(hour, firstActiveHour), lastHour));
        }}
        onMouseLeave={() => setHoverHour(null)}
      >
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yOf(value)}
              y2={yOf(value)}
              className="stroke-surface-4/60"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={yOf(value) + 3}
              textAnchor="end"
              className="fill-text-muted text-[10px]"
            >
              {value}
            </text>
          </g>
        ))}
        {hourTicks.map((hour) => (
          <text
            key={hour}
            x={xOf(hour)}
            y={height - 6}
            textAnchor="middle"
            className="fill-text-muted text-[10px]"
          >
            {formatHourLabel(hour)}
          </text>
        ))}

        {planY !== null ? (
          <g>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={planY}
              y2={planY}
              className="stroke-text-muted/50"
              strokeWidth={1.5}
              strokeDasharray="2 4"
            />
            <text
              x={width - pad.right}
              y={planY - 4}
              textAnchor="end"
              className="fill-text-muted text-[10px] font-medium"
            >
              {t("today.timeline.planned", {
                quantity: formatQuantity(item.planned_qty ?? 0, item.unit),
              })}
            </text>
          </g>
        ) : null}

        {expectedPath ? (
          <path
            d={expectedPath}
            fill="none"
            className="stroke-text-muted/60"
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        ) : null}
        {soldPath ? (
          <path
            d={soldPath}
            fill="none"
            className="stroke-brand-gold"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {item.production_steps.map((step, index) => (
          <g key={`${step.hour}-${index}`}>
            <line
              x1={xOf(step.hour)}
              x2={xOf(step.hour)}
              y1={height - pad.bottom}
              y2={height - pad.bottom - 8}
              className="stroke-status-info"
              strokeWidth={2}
            />
            <title>
              {t("today.timeline.batchTooltip", {
                quantity: formatQuantity(step.quantity, item.unit),
                hour: formatHourLabel(step.hour),
              })}
            </title>
          </g>
        ))}

        {hoverHour !== null ? (
          <g>
            <line
              x1={xOf(hoverHour)}
              x2={xOf(hoverHour)}
              y1={pad.top}
              y2={height - pad.bottom}
              className="stroke-text-muted/40"
              strokeWidth={1}
            />
            <g
              transform={`translate(${Math.min(xOf(hoverHour) + 8, width - 150)}, ${pad.top + 4})`}
            >
              <rect
                width={140}
                height={52}
                rx={6}
                className="fill-surface-2 stroke-surface-4"
              />
              <text x={8} y={16} className="fill-text-primary text-[11px] font-semibold">
                {formatHourLabel(hoverHour)}
              </text>
              <text x={8} y={31} className="fill-text-secondary text-[10px]">
                {t("today.timeline.hoverSold", {
                  quantity: formatQuantity(hoverSold ?? 0, item.unit),
                })}
              </text>
              <text x={8} y={45} className="fill-text-muted text-[10px]">
                {t("today.timeline.hoverExpected", {
                  quantity: formatQuantity(hoverExpected ?? 0, item.unit),
                })}
              </text>
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function paceChip(t: (key: string) => string, status: string | null | undefined) {
  if (status === "SURGE") {
    return (
      <span className="inline-flex rounded-full border border-status-warning/40 bg-status-warning/10 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
        {t("today.pace.surge")}
      </span>
    );
  }
  if (status === "SLOWDOWN") {
    return (
      <span className="inline-flex rounded-full border border-status-info/40 bg-status-info/10 px-2 py-0.5 text-[10px] font-semibold text-status-info">
        {t("today.pace.slowdown")}
      </span>
    );
  }
  return null;
}

function DishTimelineRow({ item }: { item: IntradayTimelineItem }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const projected = item.projected_total_at_close;
  const target = item.planned_qty ?? item.forecast_qty;

  return (
    <div className="border-b border-surface-4/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-3/20"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text-primary">
              {item.item_title}
            </p>
            {paceChip(t, item.pace_status)}
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {t("today.timeline.rowNumbers", {
              sold: formatQuantity(item.sold_so_far, item.unit),
              target: formatQuantity(target, item.unit),
            })}
            {projected != null
              ? ` · ${t("today.timeline.projected", {
                  projected: formatQuantity(projected, item.unit),
                })}`
              : ""}
          </p>
        </div>
        <Sparkline item={item} />
      </button>
      {expanded ? (
        <div className="px-4 pb-4">
          <DetailChart item={item} />
        </div>
      ) : null}
    </div>
  );
}

export function LiveTimelineSection({ timeline }: LiveTimelineSectionProps) {
  const { t } = useTranslation();
  const [showOnPace, setShowOnPace] = useState(false);

  const { attentionRows, onPaceRows } = useMemo(() => {
    const items = timeline?.items ?? [];
    return {
      attentionRows: items.filter(
        (item) => item.pace_status === "SURGE" || item.pace_status === "SLOWDOWN",
      ),
      onPaceRows: items.filter(
        (item) => item.pace_status !== "SURGE" && item.pace_status !== "SLOWDOWN",
      ),
    };
  }, [timeline]);

  if (!timeline || !timeline.items.length) return null;

  return (
    <section className="mt-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("today.timeline.title")}
        </h4>
        {/* Legend: identity by line style as much as color */}
        <div className="flex items-center gap-4 text-[10px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" className="stroke-brand-gold" strokeWidth="2" />
            </svg>
            {t("today.timeline.legendSold")}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" className="stroke-text-muted/60" strokeWidth="2" strokeDasharray="3 3" />
            </svg>
            {t("today.timeline.legendExpected")}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" className="stroke-text-muted/40" strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
            {t("today.timeline.legendPlanned")}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
        {attentionRows.map((item) => (
          <DishTimelineRow key={item.item_id} item={item} />
        ))}
        {attentionRows.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">
            {t("today.timeline.allOnPace")}
          </p>
        ) : null}
      </div>

      {onPaceRows.length > 0 ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowOnPace((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl border border-surface-4/60 bg-surface-2 px-4 py-2.5 text-left transition-colors hover:border-surface-4"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("today.timeline.onPaceCount", { count: onPaceRows.length })}
            </span>
            <span className="text-xs text-text-muted">
              {showOnPace ? t("today.live.hide") : t("today.live.showAll")}
            </span>
          </button>
          {showOnPace ? (
            <div className="mt-1 overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
              {onPaceRows.map((item) => (
                <DishTimelineRow key={item.item_id} item={item} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
