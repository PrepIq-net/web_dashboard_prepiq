"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useItemHistory,
  useProductionIntelligenceAccessScope,
} from "@/services/production-intelligence/hooks";
import type { ItemTimeSeriesRow } from "@/services/production-intelligence/types";

const EMPTY_LIST: never[] = [];

function toCurrency(v: number) {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtQty(v: number, unit: string) {
  return `${v % 1 === 0 ? v : v.toFixed(1)} ${unit}`;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving")
    return <span className="text-status-success">↑</span>;
  if (trend === "declining")
    return <span className="text-status-critical">↓</span>;
  return <span className="text-text-muted">→</span>;
}

function ItemSparkline({
  timeSeries,
  unit,
}: {
  timeSeries: ItemTimeSeriesRow[];
  unit: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const maxVal = useMemo(
    () =>
      Math.max(
        ...timeSeries.flatMap((r) => [
          r.planned_qty,
          r.actual_sales,
          r.ai_forecast,
        ]),
        1,
      ),
    [timeSeries],
  );

  const W = 600;
  const H = 130;
  const PAD_X = 8;
  const PAD_Y = 12;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;
  const n = timeSeries.length;
  if (!n) return null;

  const slotW = chartW / n;
  const barW = Math.max(2, slotW * 0.55);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 130 }}
      >
        {timeSeries.map((row, i) => {
          const cx = PAD_X + (i + 0.5) * slotW;
          const actualH = (row.actual_sales / maxVal) * chartH;
          const plannedH = (row.planned_qty / maxVal) * chartH;
          const aiY = H - PAD_Y - (row.ai_forecast / maxVal) * chartH;
          const isStockout = row.stockout_flag;
          const wasteRatio =
            row.planned_qty > 0 ? row.waste_qty / row.planned_qty : 0;
          const hasWaste = !isStockout && wasteRatio > 0.08;
          const actualColor = isStockout
            ? "#ef4444"
            : hasWaste
              ? "#f59e0b"
              : "#22c55e";
          const isHovered = hovered === i;

          return (
            <g
              key={row.date}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Planned bar (ghost) */}
              <rect
                x={cx - barW / 2}
                y={H - PAD_Y - plannedH}
                width={barW}
                height={plannedH}
                fill="white"
                fillOpacity={isHovered ? 0.15 : 0.07}
                rx={1}
              />
              {/* Actual bar */}
              <rect
                x={cx - barW / 2}
                y={H - PAD_Y - actualH}
                width={barW}
                height={actualH}
                fill={actualColor}
                fillOpacity={isHovered ? 0.9 : 0.65}
                rx={1}
              />
              {/* AI forecast dot */}
              <circle
                cx={cx}
                cy={aiY}
                r={isHovered ? 3.5 : 2}
                fill="white"
                fillOpacity={0.7}
              />
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered !== null && timeSeries[hovered] && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
          <div className="rounded-lg border border-surface-4 bg-surface-1 px-3 py-2 shadow-xl text-xs text-text-secondary">
            <p className="font-semibold text-text-primary mb-1">
              {formatDate(timeSeries[hovered].date)}
            </p>
            <p>AI forecast: {fmtQty(timeSeries[hovered].ai_forecast, unit)}</p>
            <p>Planned: {fmtQty(timeSeries[hovered].planned_qty, unit)}</p>
            <p>Sold: {fmtQty(timeSeries[hovered].actual_sales, unit)}</p>
            {timeSeries[hovered].waste_qty > 0 && (
              <p className="text-status-warning">
                Waste: {fmtQty(timeSeries[hovered].waste_qty, unit)}
              </p>
            )}
            {timeSeries[hovered].stockout_flag && (
              <p className="text-status-critical">Ran short</p>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-white/20" />
          Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-status-success/70" />
          Sold clean
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-status-warning/70" />
          Waste
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-status-critical/70" />
          Stockout
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
          AI forecast
        </span>
      </div>
    </div>
  );
}

function ItemHistoryContent() {
  const params = useParams<{ itemId: string }>();
  const searchParams = useSearchParams();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const itemId = String(params?.itemId ?? "");
  const branchId =
    searchParams.get("branch") ??
    searchParams.get("branch_id") ??
    accessScope?.default_branch_id ??
    "";
  const [days, setDays] = useState(30);

  const { data: report, isLoading } = useItemHistory(itemId, {
    branch_id: branchId,
    days,
  });

  const summary = report?.summary ?? null;
  const insights = report?.ai_insights ?? null;

  const { cleanRows, wasteRows, stockoutRows, overrideRows } = useMemo(() => {
    const ts = report?.time_series ?? EMPTY_LIST;
    const clean: typeof ts = [];
    const waste: typeof ts = [];
    const stockout: typeof ts = [];
    const overrides: typeof ts = [];
    for (const r of ts) {
      if (r.stockout_flag) stockout.push(r);
      else if (
        r.waste_qty > 0 &&
        r.waste_qty / Math.max(r.planned_qty, 0.01) > 0.08
      )
        waste.push(r);
      else clean.push(r);
      if (r.decision && r.decision.toUpperCase().includes("OVERRIDE"))
        overrides.push(r);
    }
    return {
      cleanRows: clean,
      wasteRows: waste,
      stockoutRows: stockout,
      overrideRows: overrides,
    };
  }, [report?.time_series]);

  const unit = report?.unit ?? "";

  return (
    <WorkspaceShell
      eyebrow="Item track record"
      title={report?.item_title ?? (isLoading ? "Loading…" : "Item")}
      description={`How this item has performed service after service — what the AI is learning and where gaps keep appearing.`}
      insight=""
    >
      {/* ── Back link + window selector ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/workspace/history${branchId ? `?branch=${branchId}` : ""}`}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          ← History
        </Link>
        <div className="flex h-10 items-center gap-1 rounded-button border border-border-default bg-surface-3 px-2">
          {[7, 14, 30, 60].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`h-7 rounded-md px-3 text-xs font-medium transition-colors ${
                days === w
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p className="mt-10 text-center text-sm text-text-muted">Loading…</p>
      )}

      {!isLoading && !summary && (
        <div className="mt-10 rounded-xl border border-surface-4 bg-surface-2 px-6 py-10 text-center">
          <p className="text-sm text-text-muted">
            {report?.data_note ??
              "No history data found for this item in the selected window."}
          </p>
        </div>
      )}

      {summary && (
        <>
          {/* ── KPI row ── */}
          <div className="mt-6 grid grid-cols-2 gap-px bg-surface-4/40 rounded-xl overflow-hidden sm:grid-cols-4">
            {[
              {
                label: "Revenue",
                value: toCurrency(summary.total_revenue),
                sub: `${summary.days_tracked} service days`,
              },
              {
                label: "Waste cost",
                value: toCurrency(summary.total_waste_cost),
                sub:
                  summary.total_waste_cost > 0
                    ? "Over-prep losses"
                    : "No waste",
              },
              {
                label: "Stockout days",
                value: String(summary.stockout_days),
                sub:
                  summary.stockout_days > 0
                    ? `${toCurrency(summary.total_lost_revenue)} missed revenue`
                    : "Never ran short",
              },
              {
                label: "Avg accuracy",
                value: `${summary.avg_accuracy.toFixed(0)}%`,
                sub: "AI forecast vs actual",
              },
            ].map((k) => (
              <div key={k.label} className="bg-surface-2 px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {k.label}
                </p>
                <p className="mt-2 font-display text-2xl font-semibold text-text-primary">
                  {k.value}
                </p>
                <p className="mt-0.5 text-[11px] text-text-muted">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── AI learning panel ── */}
          {insights && (
            <div className="mt-6 rounded-xl border border-surface-4 bg-surface-2 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
                What the AI is learning
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] text-text-muted">Accuracy trend</p>
                  <p className="mt-0.5 text-sm font-semibold text-text-primary flex items-center gap-1">
                    <TrendIcon trend={insights.accuracy_trend} />
                    {insights.accuracy_trend.charAt(0).toUpperCase() +
                      insights.accuracy_trend.slice(1)}
                  </p>
                  {insights.accuracy_prior_14d > 0 && (
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {insights.accuracy_14d.toFixed(0)}% last 14 days vs{" "}
                      {insights.accuracy_prior_14d.toFixed(0)}% prior
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] text-text-muted">
                    Avg forecast error
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-text-primary">
                    {insights.avg_error_pct.toFixed(1)}% off
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {insights.avg_error_pct < 10
                      ? "Very precise"
                      : insights.avg_error_pct < 20
                        ? "Reasonable"
                        : "Still learning this item"}
                  </p>
                </div>
                {insights.override_count > 0 && (
                  <div>
                    <p className="text-[11px] text-text-muted">
                      Your overrides
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-text-primary">
                      {insights.override_count} times
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {insights.override_win_count}/{insights.override_count}{" "}
                      paid off
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Sparkline chart ── */}
          {(report?.time_series?.length ?? 0) > 0 && (
            <div className="mt-6 rounded-xl border border-surface-4 bg-surface-2 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-4">
                AI forecast vs planned vs sold — last {days} days
              </p>
              <ItemSparkline timeSeries={report!.time_series} unit={unit} />
            </div>
          )}

          {/* ── Day-by-day table ── */}
          {(report?.time_series?.length ?? 0) > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-3">
                Every service day
              </p>
              <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
                {/* Stockouts first */}
                {[...stockoutRows, ...wasteRows, ...cleanRows].map((row) => {
                  const isStockout = row.stockout_flag;
                  const wasteRatio =
                    row.planned_qty > 0 ? row.waste_qty / row.planned_qty : 0;
                  const hasWaste = !isStockout && wasteRatio > 0.08;
                  const outcome = isStockout
                    ? { icon: "⚡", cls: "text-status-critical" }
                    : hasWaste
                      ? { icon: "○", cls: "text-status-warning" }
                      : { icon: "✓", cls: "text-status-success" };
                  const isOverride =
                    row.decision?.toUpperCase().includes("OVERRIDE") ?? false;
                  return (
                    <div
                      key={row.date}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
                    >
                      <span
                        className={`w-4 shrink-0 text-center font-semibold ${outcome.cls}`}
                      >
                        {outcome.icon}
                      </span>
                      <p className="w-28 shrink-0 text-xs text-text-muted">
                        {formatDate(row.date)}
                      </p>
                      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-text-muted">
                        <span>
                          AI:{" "}
                          <span className="font-medium text-text-secondary">
                            {fmtQty(row.ai_forecast, unit)}
                          </span>
                        </span>
                        <span>
                          Planned:{" "}
                          <span className="font-medium text-text-secondary">
                            {fmtQty(row.planned_qty, unit)}
                          </span>
                        </span>
                        <span>
                          Sold:{" "}
                          <span className="font-semibold text-text-primary">
                            {fmtQty(row.actual_sales, unit)}
                          </span>
                        </span>
                        {row.waste_qty > 0 && (
                          <span className="text-status-warning">
                            Waste: {fmtQty(row.waste_qty, unit)}
                          </span>
                        )}
                        {row.lost_revenue_estimate > 0 && (
                          <span className="text-status-critical">
                            ~{toCurrency(row.lost_revenue_estimate)} missed
                          </span>
                        )}
                      </div>
                      {isOverride && (
                        <span className="shrink-0 rounded-full border border-brand-gold/30 px-2 py-0.5 text-[10px] font-medium text-brand-gold">
                          Your call
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}

export default function ItemHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          Loading item history…
        </div>
      }
    >
      <ItemHistoryContent />
    </Suspense>
  );
}
