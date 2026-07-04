"use client";

import { useState } from "react";
import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { MorningBrief } from "@/services/production-intelligence/types";

/**
 * Morning brief hero — the pipeline's own explanation of why today differs
 * from a normal day. Unboxed, spacing-led section per the brand system;
 * every number in the narrative comes from the backend drivers.
 */

type MorningBriefPanelProps = {
  brief: MorningBrief;
  onOpenProvenance: () => void;
};

export function MorningBriefPanel({
  brief,
  onOpenProvenance,
}: MorningBriefPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const signals = brief.drivers?.signals;
  const activeSignals = brief.drivers?.active_signals ?? [];

  // Each chip carries the signal label and, when the branch has learned a
  // response, the learned delta + a "learned from N days" affordance so the
  // chip reads as evidence rather than a flag.
  type Chip = { label: string; learnedPct: number | null; title?: string };
  const signalChips: Chip[] = [];

  if (activeSignals.length > 0) {
    for (const signal of activeSignals) {
      const typeKey = `today.signalType.${signal.signal_type}`;
      const typed = t(typeKey);
      // Prefer the localized label; fall back to the backend label.
      const baseLabel = typed === typeKey ? signal.label : typed;
      // Append the specific name (e.g. the match) when it adds detail.
      const label =
        signal.name && signal.name.toLowerCase() !== baseLabel.toLowerCase()
          ? `${baseLabel} · ${signal.name}`
          : baseLabel;
      const learned = signal.learned ?? null;
      signalChips.push({
        label,
        learnedPct: learned?.delta_pct ?? null,
        title:
          learned && learned.sample_count > 0
            ? t("today.brief.learnedTag", { count: learned.sample_count })
            : undefined,
      });
    }
  } else {
    // Fallback for older API responses without active_signals.
    if (signals?.is_rain) signalChips.push({ label: t("today.brief.signal.rain"), learnedPct: null });
    if (signals?.public_holiday) signalChips.push({ label: t("today.brief.signal.holiday"), learnedPct: null });
    if (signals?.special_event) signalChips.push({ label: t("today.brief.signal.event"), learnedPct: null });
  }

  const traffic = signals?.expected_traffic_multiplier;
  if (traffic != null && Math.abs(traffic - 1) >= 0.05) {
    signalChips.push({
      label: t("today.brief.signal.traffic", {
        pct: `${traffic >= 1 ? "+" : ""}${Math.round((traffic - 1) * 100)}%`,
      }),
      learnedPct: null,
    });
  }

  const watchouts = brief.watchouts ?? [];
  const narrativeIsLong = brief.narrative.length > 220;

  return (
    <section className="mb-8 border-b border-surface-4/50 pb-8 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-2xl flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.brief.eyebrow")}
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.3px] text-text-primary">
            {brief.headline}
          </h2>
          <p
            className={`mt-2 text-sm leading-relaxed text-text-secondary ${
              !expanded && narrativeIsLong ? "line-clamp-3" : ""
            }`}
          >
            {brief.narrative}
          </p>
          {narrativeIsLong ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-secondary"
            >
              {expanded ? t("today.brief.showLess") : t("today.brief.showMore")}
              {expanded ? (
                <NavArrowUp className="h-3 w-3" />
              ) : (
                <NavArrowDown className="h-3 w-3" />
              )}
            </button>
          ) : null}

          {watchouts.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {watchouts.slice(0, 3).map((watchout) => (
                <li
                  key={watchout}
                  className="flex items-start gap-2 text-xs text-text-secondary"
                >
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-status-warning" />
                  {watchout}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {signalChips.length > 0 ? (
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("today.brief.signalsEyebrow")}
            </p>
            <div className="mt-2 flex max-w-60 flex-wrap gap-1.5">
              {signalChips.map((chip) => (
                <span
                  key={chip.label}
                  title={chip.title}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium ${
                    chip.learnedPct != null
                      ? "border-brand-gold/40 text-text-secondary"
                      : "border-surface-4 text-text-secondary"
                  }`}
                >
                  {chip.label}
                  {chip.learnedPct != null ? (
                    <span
                      className={`font-semibold ${
                        chip.learnedPct >= 0 ? "text-status-success" : "text-status-critical"
                      }`}
                    >
                      {chip.learnedPct >= 0 ? "+" : ""}
                      {chip.learnedPct.toFixed(0)}%
                    </span>
                  ) : null}
                  {chip.title ? (
                    <span className="h-1 w-1 rounded-full bg-brand-gold" aria-hidden />
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onOpenProvenance}
          className="inline-flex h-8 items-center rounded-lg border border-[#2E2E33] px-3 text-xs font-semibold text-text-primary transition-colors duration-200 hover:bg-surface-3"
        >
          {t("today.brief.provenanceCta")}
        </button>
        <p className="text-[11px] text-text-muted">
          {brief.generated_by === "llm"
            ? t("today.brief.llmBadge")
            : t("today.brief.templateBadge")}
        </p>
      </div>
    </section>
  );
}
