"use client";

import Link from "next/link";
import { Brain, CheckCircle, Lock, NavArrowRight, WarningTriangle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { IntelligenceJourneySummary } from "@/services/production-intelligence/types";

/**
 * Intelligence Journey — the honest header for a kitchen that PrepIQ is still
 * learning.
 *
 * The product problem this solves: on day one every number is borrowed, and a
 * dashboard that shows borrowed numbers in the same typeface as measured ones
 * is lying by omission. So this strip states the stage, shows a progress bar
 * that moves *daily* rather than in three big jumps, and names the single next
 * thing that would move it.
 *
 * It is deliberately not a card — Today is already dense with them, and
 * DESIGN.md §7 forbids nesting. A left accent rule plus a surface shift carries
 * the grouping.
 */

const TOTAL_STAGES = 3;

/** Blocked is the only state that earns a status color; the rest is progress. */
function accentFor(summary: IntelligenceJourneySummary) {
  if (summary.blocked_reason) {
    return {
      rule: "border-l-status-warning",
      icon: "text-status-warning",
      Icon: WarningTriangle,
    };
  }
  if (summary.stage >= TOTAL_STAGES) {
    return {
      rule: "border-l-status-success",
      icon: "text-status-success",
      Icon: CheckCircle,
    };
  }
  return { rule: "border-l-brand-gold", icon: "text-brand-gold", Icon: Brain };
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-brand-gold transition-[width] duration-[--motion-duration-standard] ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function IntelligenceJourneyBanner({
  summary,
}: {
  summary: IntelligenceJourneySummary | null | undefined;
}) {
  const { t } = useTranslation();

  if (!summary) return null;

  const accent = accentFor(summary);
  const { Icon } = accent;
  const lockedCount = Math.max(
    0,
    summary.total_capabilities - summary.learned_count - summary.learning_count,
  );

  return (
    <section
      aria-label={t("today.journey.title")}
      className={`mt-4 mb-6 border-l-4 bg-surface-2 px-4 py-3.5 ${accent.rule}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className={`h-4.5 w-4.5 shrink-0 ${accent.icon}`} strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-text-primary">
              {summary.stage_label}
            </p>
            <p className="text-xs text-text-muted">
              {t("today.journey.stageOf", {
                current: summary.stage,
                total: TOTAL_STAGES,
              })}
            </p>
          </div>
        </div>

        <Link
          href="/workspace/intelligence"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
        >
          {t("today.journey.seeJourney")}
          <NavArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar pct={summary.progress_pct} />
        <span className="font-display text-sm font-semibold tabular-nums text-text-primary">
          {Math.round(summary.progress_pct)}%
        </span>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-text-secondary">
        {summary.headline}
      </p>

      {summary.blocked_reason ? (
        // A stage that has stalled must say so. Silence here reads as PrepIQ
        // being broken rather than the kitchen having a fixable data problem.
        <p className="mt-2 text-xs leading-relaxed text-text-primary">
          {summary.blocked_reason}
        </p>
      ) : null}

      <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle
            className="h-3.5 w-3.5 text-status-success"
            strokeWidth={1.5}
            aria-hidden
          />
          <dt className="sr-only">{t("today.journey.learned")}</dt>
          <dd className="text-text-secondary">
            <span className="tabular-nums text-text-primary">
              {summary.learned_count}
            </span>{" "}
            {t("today.journey.learned")}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} aria-hidden />
          <dt className="sr-only">{t("today.journey.learning")}</dt>
          <dd className="text-text-secondary">
            <span className="tabular-nums text-text-primary">
              {summary.learning_count}
            </span>{" "}
            {t("today.journey.learning")}
          </dd>
        </div>
        {lockedCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} aria-hidden />
            <dt className="sr-only">{t("today.journey.locked")}</dt>
            <dd className="text-text-secondary">
              <span className="tabular-nums text-text-primary">{lockedCount}</span>{" "}
              {t("today.journey.locked")}
            </dd>
          </div>
        ) : null}
        {/* Null confidence is a real state, not a loading one: it means nothing
            measurable exists yet. Showing 0% instead would be a fabrication. */}
        <div className="flex items-center gap-1.5">
          <dt className="text-text-muted">{t("today.journey.confidence")}</dt>
          <dd className="text-text-secondary">
            {summary.confidence_pct === null ? (
              t("today.journey.confidenceUnknown")
            ) : (
              <span className="tabular-nums text-text-primary">
                {Math.round(summary.confidence_pct)}%
              </span>
            )}
          </dd>
        </div>
      </dl>

      {summary.next_milestone ? (
        <p className="mt-2.5 border-t border-border-default pt-2.5 text-xs text-text-muted">
          <span className="text-text-secondary">{t("today.journey.next")}</span>{" "}
          {summary.next_milestone.label}
          {summary.next_milestone.remaining > 0 ? (
            <>
              {" — "}
              <span className="tabular-nums text-text-primary">
                {Math.round(summary.next_milestone.remaining)}
              </span>{" "}
              {t("today.journey.toGo")}
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
