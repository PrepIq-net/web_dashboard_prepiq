"use client";

import { WarningTriangle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { Freshness, InsightSeverity } from "@/services/insights/types";

/**
 * Severity colouring, in one place.
 *
 * Gold is reserved for the brand's active/highlight role, so it marks MEDIUM
 * rather than being spent on the routine case; CRITICAL and HIGH carry the
 * status reds so the eye lands on them first.
 */
const SEVERITY_TONE: Record<InsightSeverity, string> = {
  CRITICAL: "border-status-critical/40 bg-status-critical/10 text-status-critical",
  HIGH: "border-status-critical/30 bg-status-critical/5 text-status-critical",
  MEDIUM: "border-brand-gold/30 bg-brand-gold/10 text-brand-gold",
  LOW: "border-surface-4 bg-surface-3 text-text-muted",
};

export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-md border px-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${SEVERITY_TONE[severity]}`}
    >
      {t(`workspace.insights.severity.${severity.toLowerCase()}`)}
    </span>
  );
}

/**
 * Confidence, stated as the pipeline computed it.
 *
 * Never rendered as 100%: the detectors clamp at 0.97 because a statistical
 * claim from eight weekly samples is not a certainty, and printing "100%
 * confident" would promise something the maths does not support.
 */
export function ConfidenceChip({ value }: { value: number }) {
  const { t } = useTranslation();
  return (
    <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
      {t("workspace.insights.confidence", { value: Math.round(value * 100) })}
    </span>
  );
}

/** Where a finding came from — a rule we can replay, or the narration layer. */
export function SourceChip({ source }: { source: "RULE" | "LLM" }) {
  const { t } = useTranslation();
  return (
    <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
      {t(`workspace.insights.source.${source.toLowerCase()}`)}
    </span>
  );
}

/**
 * The freshness strip.
 *
 * The load-bearing state of this whole workspace: without it an empty tab
 * means both "your kitchen is clean" and "the nightly job died on Friday", and
 * the two render identically. Shows nothing when the data is current — a
 * banner that is always on stops being read.
 */
export function FreshnessNotice({ freshness }: { freshness: Freshness }) {
  const { t } = useTranslation();
  if (!freshness.never_run && !freshness.is_stale) return null;

  const lastRun = freshness.last_run;
  const message = freshness.never_run
    ? t("workspace.insights.freshness.neverRun")
    : lastRun
      ? t("workspace.insights.freshness.stale", { date: lastRun.run_date })
      : t("workspace.insights.freshness.staleUnknown");

  return (
    <div className="mb-6 flex items-start gap-3 border-l-4 border-status-warning bg-status-warning/5 py-3 pl-4 pr-4">
      <WarningTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
      <div>
        <p className="text-[13px] text-text-secondary">{message}</p>
        <p className="mt-1 text-[12px] text-text-muted">
          {t("workspace.insights.freshness.detail")}
        </p>
      </div>
    </div>
  );
}

/**
 * The empty state, with its reason.
 *
 * Always takes a `reason`. "Nothing here" without a cause is the state that
 * erodes trust fastest, because the reader cannot tell whether the silence is
 * good news or a broken pipeline.
 */
export function EmptyState({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-[15px] text-text-secondary">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[22px] text-text-muted">
        {reason}
      </p>
    </div>
  );
}

/** A labelled figure. Value already carries its own unit or currency. */
export function Metric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "positive" | "negative";
}) {
  const valueTone =
    tone === "positive"
      ? "text-status-success"
      : tone === "negative"
        ? "text-status-critical"
        : "text-text-primary";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </p>
      <p className={`mt-1.5 font-display text-[24px] font-semibold ${valueTone}`}>
        {value}
      </p>
      {detail ? <p className="mt-1 text-[12px] text-text-muted">{detail}</p> : null}
    </div>
  );
}

/**
 * Signed percentages, with the arithmetic sign made explicit.
 *
 * `+3%` and `3%` read the same at a glance otherwise, and on a revenue delta
 * that is the difference between a good day and a flat one.
 */
export function signedPercent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function percent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** Direction of a change where up is good (revenue) or bad (waste). */
export function deltaTone(
  value: number | null,
  upIsGood: boolean,
): "default" | "positive" | "negative" {
  if (value === null || value === 0) return "default";
  const good = value > 0 ? upIsGood : !upIsGood;
  return good ? "positive" : "negative";
}
