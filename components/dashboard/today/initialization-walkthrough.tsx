"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Spinner } from "@/components/ui/spinner";
import type { PipelineStats } from "@/services/production-intelligence/types";

/**
 * Narrated "thought process" shown while day initialization runs the
 * forecasting pipeline. Stages are choreographed client-side against the
 * real request; the recap numbers come verbatim from the backend's
 * pipeline_stats — nothing is invented, missing stats fall back to a
 * neutral "done".
 */

const STAGE_KEYS = ["read", "clean", "signals", "blend", "targets"] as const;
type StageKey = (typeof STAGE_KEYS)[number];

// Minimum dwell per stage while the request is in flight; stages never
// advance past the 4th until the response lands.
const STAGE_DWELL_MS = 850;
const FAST_FORWARD_MS = 300;
const RECAP_HOLD_MS = 2600;
const SKIP_AFTER_MS = 8000;
const MAX_STAGE_WHILE_PENDING = STAGE_KEYS.length - 2;

type InitializationWalkthroughProps = {
  isPending: boolean;
  isError: boolean;
  errorMessage?: string | null;
  stats?: PipelineStats | null;
  onRetry?: () => void;
  onDone: () => void;
};

export function InitializationWalkthrough({
  isPending,
  isError,
  errorMessage,
  stats,
  onRetry,
  onDone,
}: InitializationWalkthroughProps) {
  const { t } = useTranslation();
  const [stageIndex, setStageIndex] = useState(0);
  const [recapVisible, setRecapVisible] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Advance stages: slow dwell while pending (capped before the last stage),
  // fast-forward once the response has landed.
  useEffect(() => {
    if (isError) return;
    const limit = isPending ? MAX_STAGE_WHILE_PENDING : STAGE_KEYS.length;
    if (stageIndex >= limit) {
      if (!isPending && stageIndex >= STAGE_KEYS.length && !recapVisible) {
        setRecapVisible(true);
      }
      return;
    }
    const timer = setTimeout(
      () => setStageIndex((current) => current + 1),
      isPending ? STAGE_DWELL_MS : FAST_FORWARD_MS,
    );
    return () => clearTimeout(timer);
  }, [stageIndex, isPending, isError, recapVisible]);

  // Recap holds briefly, then hands off to the plan.
  useEffect(() => {
    if (!recapVisible) return;
    const timer = setTimeout(() => onDoneRef.current(), RECAP_HOLD_MS);
    return () => clearTimeout(timer);
  }, [recapVisible]);

  useEffect(() => {
    const timer = setTimeout(() => setSkipVisible(true), SKIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  const recapByStage = useMemo<Record<StageKey, string>>(() => {
    const fallback = t("today.init.recap.done");
    if (!stats) {
      return {
        read: fallback,
        clean: fallback,
        signals: fallback,
        blend: fallback,
        targets: fallback,
      };
    }
    const signals = stats.weather_event_signals ?? null;
    const signalParts: string[] = [];
    if (signals?.is_rain) signalParts.push(t("today.init.recap.rain"));
    if (signals?.special_event) signalParts.push(t("today.init.recap.event"));
    if (signals?.public_holiday)
      signalParts.push(t("today.init.recap.holiday"));
    return {
      read: stats.history_days_loaded
        ? t("today.init.recap.historyDays", {
            days: stats.history_days_loaded,
          })
        : fallback,
      clean:
        (stats.excluded_days_max ?? 0) > 0
          ? t("today.init.recap.excludedDays", {
              count: stats.excluded_days_max ?? 0,
            })
          : t("today.init.recap.noExclusions"),
      signals: signalParts.length
        ? signalParts.join(" · ")
        : t("today.init.recap.noSignals"),
      blend:
        (stats.models_used?.length ?? 0) > 1
          ? t("today.init.recap.models", {
              count: stats.models_used?.length ?? 0,
            })
          : fallback,
      targets: stats.item_count
        ? t("today.init.recap.items", { count: stats.item_count })
        : fallback,
    };
  }, [stats, t]);

  return (
    <div className="mx-auto mt-10 w-full max-w-lg animate-in fade-in duration-300">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {t("today.init.eyebrow")}
      </p>
      <h2 className="mt-1 font-display text-xl text-text-primary">
        {t("today.init.title")}
      </h2>

      <ol className="mt-6 space-y-0">
        {STAGE_KEYS.map((key, index) => {
          const isDone = index < stageIndex || recapVisible;
          const isActive = !isDone && index === stageIndex;
          const failedHere = isError && isActive;
          const isLast = index === STAGE_KEYS.length - 1;
          return (
            <li key={key} className="relative flex gap-3 pb-0">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <div className="flex h-5 w-5 items-center justify-center">
                  {failedHere ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-status-critical" />
                  ) : isActive ? (
                    <Spinner size="sm" />
                  ) : isDone ? (
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4 text-brand-gold animate-in fade-in duration-200"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-surface-4" />
                  )}
                </div>
                {!isLast ? (
                  <span
                    className={`w-px flex-1 min-h-6 ${
                      isDone ? "bg-brand-gold/40" : "bg-surface-4"
                    }`}
                  />
                ) : null}
              </div>

              {/* Copy */}
              <div className="pb-5 pt-0.5">
                <p
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-text-primary"
                      : isDone
                        ? "text-text-secondary"
                        : "text-text-disabled"
                  }`}
                >
                  {t(`today.init.stage.${key}`)}
                </p>
                {recapVisible ? (
                  <p className="mt-0.5 text-xs text-text-muted animate-in fade-in slide-in-from-bottom-1 duration-300">
                    {recapByStage[key]}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {isError ? (
        <div className="mt-4 rounded-r-lg border-l-4 border-l-status-critical bg-status-critical/8 px-4 py-3">
          <p className="text-xs font-semibold text-status-critical">
            {t("today.init.failedTitle")}
          </p>
          {errorMessage ? (
            <p className="mt-1 text-xs text-text-secondary">{errorMessage}</p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex h-8 items-center rounded-full border border-status-critical/50 px-3 text-xs font-semibold text-status-critical hover:bg-status-critical/10"
            >
              {t("today.init.retry")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex h-8 items-center gap-3">
        {recapVisible ? (
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-8 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-bg-base hover:bg-brand-gold-hover animate-in fade-in duration-200"
          >
            {t("today.init.showPlan")}
          </button>
        ) : skipVisible && !isPending && !isError ? (
          // Skipping is only offered once the forecast request has settled —
          // while it's still generating the user must wait for it to finish.
          <button
            type="button"
            onClick={onDone}
            className="text-xs font-semibold text-text-muted hover:text-text-secondary"
          >
            {t("today.init.skip")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
