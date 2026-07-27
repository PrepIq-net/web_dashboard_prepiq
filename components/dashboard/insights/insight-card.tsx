"use client";

import { useState } from "react";
import { Check, NavArrowDown, NavArrowRight, Xmark } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { Insight, InsightSeverity, InsightStatus } from "@/services/insights/types";
import { ConfidenceChip, SeverityBadge, SourceChip } from "./insight-primitives";

/**
 * Severity is carried by a left border rather than a filled card.
 *
 * Straight out of the brand system's notification rule — critical red, warning
 * gold — and it keeps the feed spacing-led instead of a column of stacked
 * boxes, which the layout guidance rules out for dashboard surfaces.
 */
const SEVERITY_BORDER: Record<InsightSeverity, string> = {
  CRITICAL: "border-status-critical",
  HIGH: "border-status-critical/70",
  MEDIUM: "border-brand-gold",
  LOW: "border-surface-4",
};

type InsightCardProps = {
  insight: Insight;
  /** Tab 3 opens the costed breakdown; the feed does not. */
  showVectors?: boolean;
  canManage: boolean;
  pending: boolean;
  onStatusChange: (status: InsightStatus) => void;
};

export function InsightCard({
  insight,
  showVectors = false,
  canManage,
  pending,
  onStatusChange,
}: InsightCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { body } = insight;
  const vectors = body.vectors ?? [];
  const action = body.quantified_action;
  const isDismissed = insight.status === "DISMISSED";
  const isImplemented = insight.status === "IMPLEMENTED";

  return (
    <article className={`border-l-4 pl-5 ${SEVERITY_BORDER[insight.severity]}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <SeverityBadge severity={insight.severity} />
            <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
              {insight.type.replace(/_/g, " ")}
            </span>
            {isImplemented ? (
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-status-success">
                <Check className="h-3 w-3" />
                {t("workspace.insights.status.implemented")}
              </span>
            ) : null}
            {isDismissed ? (
              <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                {insight.suppressed_until
                  ? t("workspace.insights.status.dismissedUntil", {
                      date: insight.suppressed_until,
                    })
                  : t("workspace.insights.status.dismissed")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-display text-[18px] font-semibold leading-7 text-text-primary">
            {insight.title}
          </h3>
        </div>

        {insight.savings ? (
          <div className="shrink-0 text-right">
            <p className="font-display text-[22px] font-semibold text-brand-gold">
              {insight.savings.display}
            </p>
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
              {t(
                `workspace.insights.period.${insight.savings_period.toLowerCase()}`,
              )}
            </p>
          </div>
        ) : null}
      </div>

      {body.observation ? (
        <p className="mt-3 max-w-3xl text-[14px] leading-[24px] text-text-secondary">
          {body.observation}
        </p>
      ) : null}

      {body.recommendation ? (
        <p className="mt-3 max-w-3xl text-[14px] leading-[24px] text-text-primary">
          {body.recommendation}
        </p>
      ) : null}

      {/* The deterministic instruction. Never model-authored — it is a fitted
          slope applied forward, which is why it can be stated as a quantity. */}
      {action && action.delta_qty !== null ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-surface-4 bg-surface-3 px-3 py-2">
          <span className="text-[13px] text-text-secondary">{action.item_name}</span>
          <span className="font-display text-[15px] font-semibold text-brand-gold">
            {action.delta_qty > 0 ? "+" : ""}
            {action.delta_qty}
          </span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
            {action.unit}
          </span>
        </div>
      ) : null}

      {body.evidence && body.evidence.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {body.evidence.map((item) => (
            <div key={`${item.label}-${item.value}`}>
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                {item.label}
              </p>
              <p className="mt-0.5 text-[13px] text-text-secondary">
                {item.value}
                {item.unit ? ` ${item.unit}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {showVectors && vectors.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            {expanded ? (
              <NavArrowDown className="h-3.5 w-3.5" />
            ) : (
              <NavArrowRight className="h-3.5 w-3.5" />
            )}
            {t("workspace.insights.opportunities.breakdown", {
              count: vectors.length,
            })}
          </button>

          {expanded ? (
            <ul className="mt-3 space-y-2 border-t border-surface-4/60 pt-3">
              {vectors.map((vector) => (
                <li
                  key={vector.item_id ?? vector.label}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-text-secondary">
                      {vector.item_name || vector.label}
                    </p>
                    {vector.daily_surplus_units ? (
                      <p className="text-[12px] text-text-muted">
                        {t("workspace.insights.opportunities.surplusPerDay", {
                          count: vector.daily_surplus_units,
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* Share bar. Widths come from the server's own shares, so
                        the bars add to the header total rather than to a second
                        percentage computed here. */}
                    {vector.share ? (
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-4 sm:block">
                        <div
                          className="h-full rounded-full bg-brand-gold"
                          style={{ width: `${Math.round(vector.share * 100)}%` }}
                        />
                      </div>
                    ) : null}
                    <p className="w-28 text-right font-display text-[14px] font-semibold text-text-primary">
                      {vector.amount.toLocaleString()} {vector.currency}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-surface-4/60 pt-3">
        <ConfidenceChip value={insight.confidence} />
        <SourceChip source={insight.source} />
        {insight.occurrence_count > 1 ? (
          <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
            {t("workspace.insights.seenTimes", { count: insight.occurrence_count })}
          </span>
        ) : null}
        {insight.resurfaced_count > 0 ? (
          <span className="text-[11px] uppercase tracking-[0.12em] text-status-warning">
            {t("workspace.insights.resurfaced")}
          </span>
        ) : null}

        {canManage ? (
          <div className="ml-auto flex items-center gap-2">
            {isDismissed || isImplemented ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onStatusChange("ACTIVE")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-[12px] text-text-secondary transition-colors hover:bg-surface-3 disabled:opacity-50"
              >
                {t("workspace.insights.actions.restore")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onStatusChange("IMPLEMENTED")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-[12px] text-text-secondary transition-colors hover:bg-surface-3 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t("workspace.insights.actions.markDone")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onStatusChange("DISMISSED")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-[12px] text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary disabled:opacity-50"
                >
                  <Xmark className="h-3.5 w-3.5" />
                  {t("workspace.insights.actions.dismiss")}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
