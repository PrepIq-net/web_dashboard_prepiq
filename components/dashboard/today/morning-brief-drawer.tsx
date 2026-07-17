"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Xmark, SparksSolid } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { MorningBrief } from "@/services/production-intelligence/types";

/**
 * The morning brief, rebuilt for layout stability:
 *
 * - `MorningBriefStrip` is a fixed-height row that renders instantly — a
 *   skeleton while the brief loads, then a one-line greeting + button. The
 *   page never jumps when the brief arrives.
 * - `MorningBriefDrawer` is the full breakdown (narrative, watchouts,
 *   learnings, signals) in a right-side drawer, with a quick-chat field that
 *   hands questions to the PrepIQ assistant.
 */

export function MorningBriefStrip({
  loading,
  brief,
  userName,
  onOpenBrief,
}: {
  loading: boolean;
  brief: MorningBrief | null;
  userName: string;
  onOpenBrief: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 flex h-14 items-center justify-between gap-4 border-b border-surface-4/50 pb-4">
      {loading ? (
        <>
          <div className="h-4 w-72 max-w-[60%] animate-pulse rounded-full bg-surface-3" />
          <div className="h-8 w-36 animate-pulse rounded-lg bg-surface-3" />
        </>
      ) : brief ? (
        <>
          <p className="min-w-0 truncate text-sm text-text-secondary">
            {t("today.brief.greeting", { name: userName })}
          </p>
          <button
            type="button"
            onClick={onOpenBrief}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-brand-gold/40 px-3 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10"
          >
            <SparksSolid className="h-3.5 w-3.5" />
            {t("today.brief.openBriefing")}
          </button>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          {t("today.brief.unavailable")}
        </p>
      )}
    </div>
  );
}

export function MorningBriefDrawer({
  open,
  onClose,
  brief,
  canAsk,
  onAsk,
  onOpenProvenance,
}: {
  open: boolean;
  onClose: () => void;
  brief: MorningBrief | null;
  canAsk: boolean;
  onAsk: (question: string) => void;
  onOpenProvenance: () => void;
}) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open || !brief) return null;

  const watchouts = brief.watchouts ?? [];
  const activeSignals = brief.drivers?.active_signals ?? [];
  const learnedPatterns = brief.drivers?.learned_patterns ?? [];

  const submitQuestion = () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQuestion("");
    onClose();
    onAsk(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 z-9995">
      <button
        type="button"
        aria-label={t("today.briefDrawer.close")}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
      />
      <aside className="absolute right-0 top-0 flex h-full w-[440px] max-w-[92vw] flex-col border-l border-surface-4 bg-surface-1 animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-surface-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("today.brief.eyebrow")}
            </p>
            <h2 className="mt-1 truncate font-display text-lg font-semibold text-text-primary">
              {brief.headline}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("today.briefDrawer.close")}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 [scrollbar-width:thin]">
          {/* Full narrative */}
          <p className="text-sm leading-relaxed text-text-secondary">
            {brief.narrative}
          </p>

          {/* Watchouts */}
          {watchouts.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("today.briefDrawer.watchouts")}
              </p>
              <ul className="mt-2 space-y-1.5">
                {watchouts.map((watchout) => (
                  <li
                    key={watchout}
                    className="flex items-start gap-2 text-xs text-text-secondary"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-status-warning" />
                    {watchout}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Active signals feeding today's forecast */}
          {activeSignals.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("today.brief.signalsEyebrow")}
              </p>
              <ul className="mt-2 space-y-2">
                {activeSignals.map((signal) => (
                  <li
                    key={`${signal.signal_type}-${signal.name ?? signal.label}`}
                    className="rounded-lg border border-surface-4 bg-surface-2 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-text-primary">
                        {signal.name && signal.name !== signal.label
                          ? `${signal.label} · ${signal.name}`
                          : signal.label}
                      </p>
                      {signal.learned?.delta_pct != null ? (
                        <span
                          className={`text-xs font-semibold ${
                            signal.learned.delta_pct >= 0
                              ? "text-status-success"
                              : "text-status-critical"
                          }`}
                        >
                          {signal.learned.delta_pct >= 0 ? "+" : ""}
                          {signal.learned.delta_pct.toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                    {signal.learned && signal.learned.sample_count > 0 ? (
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {t("today.brief.learnedTag", {
                          count: signal.learned.sample_count,
                        })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* What PrepIQ has learned about this branch */}
          {learnedPatterns.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {t("today.briefDrawer.pastLearnings")}
              </p>
              <ul className="mt-2 space-y-1.5">
                {learnedPatterns.slice(0, 6).map((pattern) => (
                  <li
                    key={`${pattern.signal_type}-${pattern.label}`}
                    className="flex items-start justify-between gap-3 text-xs text-text-secondary"
                  >
                    <span>{pattern.label}</span>
                    {pattern.delta_pct != null ? (
                      <span
                        className={`shrink-0 font-semibold ${
                          pattern.delta_pct >= 0
                            ? "text-status-success"
                            : "text-status-critical"
                        }`}
                      >
                        {pattern.delta_pct >= 0 ? "+" : ""}
                        {pattern.delta_pct.toFixed(0)}%
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-surface-4/60 pt-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProvenance();
              }}
              className="inline-flex h-8 items-center rounded-lg border border-surface-4 px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-3"
            >
              {t("today.brief.provenanceCta")}
            </button>
            <p className="text-[11px] text-text-muted">
              {brief.generated_by === "llm"
                ? t("today.brief.llmBadge")
                : t("today.brief.templateBadge")}
            </p>
          </div>
        </div>

        {/* Quick chat about this briefing */}
        {canAsk ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion();
            }}
            className="border-t border-surface-4 px-5 py-4"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("today.briefDrawer.askEyebrow")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t("today.briefDrawer.askPlaceholder")}
                className="h-9 flex-1 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
              />
              <button
                type="submit"
                disabled={!question.trim()}
                className="inline-flex h-9 items-center rounded-lg bg-brand-gold px-3.5 text-xs font-semibold text-[#141416] transition-colors hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("today.briefDrawer.askCta")}
              </button>
            </div>
          </form>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
