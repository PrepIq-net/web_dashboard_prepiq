"use client";

import { ArrowDown, ArrowRight, ArrowUp } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type {
  InsightStatus,
  InsightSummary,
  ScoreComponent,
} from "@/services/insights/types";
import { InsightCard } from "./insight-card";
import {
  deltaTone,
  EmptyState,
  Metric,
  ratioPercent,
  signedPercent,
} from "./insight-primitives";

const STATUS_TONE: Record<string, string> = {
  OK: "text-status-success",
  WARN: "text-status-warning",
  FAIL: "text-status-critical",
  NA: "text-text-muted",
};

/** Health bands. Deliberately coarse — a 71 and a 74 are the same news. */
function scoreTone(value: number): string {
  if (value >= 80) return "text-status-success";
  if (value >= 60) return "text-brand-gold";
  return "text-status-critical";
}

export function SummaryTab({
  data,
  canManage,
  pending,
  onStatusChange,
}: {
  data: InsightSummary;
  canManage: boolean;
  pending: boolean;
  onStatusChange: (insightId: string, status: InsightStatus) => void;
}) {
  const { t } = useTranslation();
  const { score, yesterday, recommended_action: action } = data;

  return (
    <div className="space-y-12">
      {/* ── Health score ──────────────────────────────────────────────── */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
          {t("workspace.insights.summary.healthTitle")}
        </p>

        {score ? (
          <div className="mt-4 grid gap-10 lg:grid-cols-[240px_1fr]">
            <div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-display text-[56px] font-semibold leading-none tracking-[-0.5px] ${scoreTone(
                    score.overall_health,
                  )}`}
                >
                  {Math.round(score.overall_health)}
                </span>
                <span className="text-[16px] text-text-muted">/ 100</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <TrendBadge trend={score.trend} delta={score.delta_vs_prior} />
              </div>

              {/* A 92 from four days of data is not the same claim as a 92 from
                  ninety, and without this line they render identically. */}
              {score.sample_completeness !== null &&
              score.sample_completeness < 0.8 ? (
                <p className="mt-3 text-[12px] leading-[20px] text-text-muted">
                  {t("workspace.insights.summary.lowCompleteness", {
                    percent: Math.round(score.sample_completeness * 100),
                  })}
                </p>
              ) : null}

              <p className="mt-3 text-[12px] text-text-muted">
                {t("workspace.insights.summary.asOf", {
                  date: score.calculated_date,
                })}
              </p>
            </div>

            <div className="space-y-4">
              {score.components.map((component) => (
                <ComponentRow key={component.key} component={component} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title={t("workspace.insights.summary.noScore")}
            reason={t("workspace.insights.summary.noScoreReason")}
          />
        )}
      </section>

      {/* ── Yesterday ─────────────────────────────────────────────────── */}
      <section className="border-t border-surface-4 pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("workspace.insights.summary.yesterdayTitle")}
          </p>
          {yesterday ? (
            <p className="text-[12px] text-text-muted">{yesterday.metric_date}</p>
          ) : null}
        </div>

        {yesterday ? (
          <>
            <div className="mt-5 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={t("workspace.insights.summary.revenue")}
                // The server's display string, not a re-format: precision was
                // decided once, where the figure was computed.
                value={yesterday.revenue_display || "—"}
                detail={
                  yesterday.revenue_change_pct !== null
                    ? t("workspace.insights.summary.vsWeekday", {
                        change: signedPercent(yesterday.revenue_change_pct, 1),
                      })
                    : undefined
                }
                tone={deltaTone(yesterday.revenue_change_pct, true)}
              />
              <Metric
                label={t("workspace.insights.summary.forecastAccuracy")}
                // Ratio, not percentage — see ratioPercent. `percent` here
                // rendered a branch at 39.7% accuracy as "0.4%".
                value={ratioPercent(yesterday.forecast_accuracy, 1)}
                detail={
                  yesterday.forecast_accuracy_7d_avg !== null
                    ? t("workspace.insights.summary.sevenDayAvg", {
                        value: ratioPercent(yesterday.forecast_accuracy_7d_avg, 1),
                      })
                    : undefined
                }
              />
              <Metric
                label={t("workspace.insights.summary.wasteCost")}
                value={yesterday.waste_cost_display || "—"}
                detail={
                  yesterday.waste_change_pct !== null
                    ? t("workspace.insights.summary.vsBaseline", {
                        change: signedPercent(yesterday.waste_change_pct, 1),
                      })
                    : undefined
                }
                tone={deltaTone(yesterday.waste_change_pct, false)}
              />
              <Metric
                label={t("workspace.insights.summary.laborHours")}
                value={
                  yesterday.actual_labor_hours !== null
                    ? t("workspace.insights.summary.hours", {
                        value: yesterday.actual_labor_hours,
                      })
                    : "—"
                }
                detail={
                  yesterday.scheduled_labor_hours !== null
                    ? t("workspace.insights.summary.scheduledHours", {
                        value: yesterday.scheduled_labor_hours,
                      })
                    : undefined
                }
                tone={deltaTone(yesterday.labor_hours_variance_pct, false)}
              />
            </div>

            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              {yesterday.best_item ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("workspace.insights.summary.bestItem")}
                  </p>
                  <p className="mt-1.5 text-[15px] text-text-primary">
                    {yesterday.best_item.title}
                  </p>
                </div>
              ) : null}
              {yesterday.volatility_item ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {t("workspace.insights.summary.hardestToPredict")}
                  </p>
                  <p className="mt-1.5 text-[15px] text-text-primary">
                    {yesterday.volatility_item.title}
                  </p>
                </div>
              ) : null}
            </div>

            {/* The null is shown, not hidden. It doubles as the in-product
                prompt for the wage data that would fill it. */}
            {yesterday.labor_cost === null ? (
              <p className="mt-6 text-[12px] text-text-muted">
                {t("workspace.insights.summary.noLaborCost")}
              </p>
            ) : null}
          </>
        ) : (
          <EmptyState
            title={t("workspace.insights.summary.noMetrics")}
            reason={t("workspace.insights.summary.noMetricsReason")}
          />
        )}
      </section>

      {/* ── The one thing to do ───────────────────────────────────────── */}
      <section className="border-t border-surface-4 pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("workspace.insights.summary.actionTitle")}
          </p>
          {data.open_insight_count > 0 ? (
            <p className="text-[12px] text-text-muted">
              {t("workspace.insights.summary.openCount", {
                count: data.open_insight_count,
              })}
            </p>
          ) : null}
        </div>

        {action ? (
          <div className="mt-5">
            <InsightCard
              insight={action}
              canManage={canManage}
              pending={pending}
              onStatusChange={(status) => onStatusChange(action.id, status)}
            />
          </div>
        ) : (
          <EmptyState
            title={t("workspace.insights.summary.noAction")}
            reason={t("workspace.insights.summary.noActionReason")}
          />
        )}
      </section>
    </div>
  );
}

function TrendBadge({
  trend,
  delta,
}: {
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  delta: number | null;
}) {
  const { t } = useTranslation();
  const Icon =
    trend === "IMPROVING" ? ArrowUp : trend === "DECLINING" ? ArrowDown : ArrowRight;
  const tone =
    trend === "IMPROVING"
      ? "text-status-success"
      : trend === "DECLINING"
        ? "text-status-critical"
        : "text-text-muted";

  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {t(`workspace.insights.trend.${trend.toLowerCase()}`)}
      {delta !== null && delta !== 0 ? (
        <span className="text-text-muted">
          ({delta > 0 ? "+" : ""}
          {delta.toFixed(1)})
        </span>
      ) : null}
    </span>
  );
}

function ComponentRow({ component }: { component: ScoreComponent }) {
  const { t } = useTranslation();
  const unavailable = component.status === "NA";

  return (
    <div className="border-b border-surface-4/60 pb-4 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[14px] text-text-secondary">{component.label}</p>
        <p
          className={`font-display text-[16px] font-semibold ${
            STATUS_TONE[component.status] ?? "text-text-muted"
          }`}
        >
          {unavailable || component.value === null
            ? t("workspace.insights.summary.notAvailable")
            : Math.round(component.value)}
        </p>
      </div>

      {/* Bar omitted entirely for NA rather than drawn at zero: an empty bar
          reads as a failing score, when the truth is we have no data. */}
      {!unavailable && component.value !== null ? (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-4">
          <div
            className="h-full rounded-full bg-brand-gold"
            style={{ width: `${Math.max(0, Math.min(100, component.value))}%` }}
          />
        </div>
      ) : null}

      {component.detail ? (
        <p className="mt-2 text-[12px] leading-[20px] text-text-muted">
          {component.detail}
        </p>
      ) : null}
    </div>
  );
}
