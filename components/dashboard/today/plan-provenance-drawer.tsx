"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Xmark } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type {
  BranchDayToday,
  PipelineStats,
} from "@/services/production-intelligence/types";

/**
 * "How this plan was made" — branch-level provenance of today's prep plan.
 *
 * Populated from the initialize response's pipeline_stats when available in
 * this session, otherwise re-derived by aggregating the per-item provenance
 * that already ships with each prep plan item
 * (suggestion_reason_json.forecast_engine.input = recommendation
 * feature_flags). Every number shown is computed by the pipeline; nothing
 * is estimated client-side.
 */

const MODEL_LABEL_KEYS: Record<string, string> = {
  prophet: "today.provenance.model.prophet",
  xgb: "today.provenance.model.xgb",
  seasonal_naive: "today.provenance.model.seasonalNaive",
  moving_average: "today.provenance.model.movingAverage",
};

type FeatureFlagBag = Record<string, unknown>;

function asRecord(value: unknown): FeatureFlagBag | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as FeatureFlagBag)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Aggregates per-item forecast provenance into the pipeline-stats shape. */
export function derivePipelineProvenance(
  items: BranchDayToday["prep_plan_items"] | undefined,
): PipelineStats | null {
  if (!items?.length) return null;

  let historyDaysLoaded = 0;
  let excludedDaysMax = 0;
  let itemsWithExclusions = 0;
  const modelsUsed = new Set<string>();
  const serviceLevels: number[] = [];
  let isRain = false;
  let specialEvent = false;
  let publicHoliday = false;
  let sawFlags = false;

  for (const item of items) {
    const engine = asRecord(item.suggestion_reason_json?.["forecast_engine"]);
    const flags = asRecord(engine?.["input"]);
    if (!flags) continue;
    sawFlags = true;

    const historyDays = asRecord(flags["history_days"]);
    historyDaysLoaded = Math.max(
      historyDaysLoaded,
      asNumber(historyDays?.["sales_days"]) ?? 0,
    );

    const filterMeta = asRecord(flags["training_filter_meta"]);
    const excluded =
      (asNumber(filterMeta?.["excluded_by_observation_status"]) ?? 0) +
      (asNumber(filterMeta?.["excluded_seasonal_outliers"]) ?? 0);
    if (excluded > 0) {
      itemsWithExclusions += 1;
      excludedDaysMax = Math.max(excludedDaysMax, excluded);
    }

    const baseForecasts = asRecord(flags["ensemble_base_forecasts"]);
    if (baseForecasts) {
      for (const key of Object.keys(baseForecasts)) modelsUsed.add(key);
    }

    const serviceLevel = asNumber(flags["newsvendor_service_level"]);
    if (serviceLevel != null) serviceLevels.push(serviceLevel);

    isRain = isRain || Boolean(flags["is_rain"]);
    specialEvent = specialEvent || Boolean(flags["special_event_flag"]);
    publicHoliday = publicHoliday || Boolean(flags["public_holiday_flag"]);
  }

  if (!sawFlags) return null;

  return {
    history_days_loaded: historyDaysLoaded || null,
    excluded_days_max: excludedDaysMax,
    items_with_exclusions: itemsWithExclusions,
    models_used: [...modelsUsed].sort(),
    service_level_avg: serviceLevels.length
      ? serviceLevels.reduce((sum, value) => sum + value, 0) /
        serviceLevels.length
      : null,
    weather_event_signals: {
      is_rain: isRain,
      special_event: specialEvent,
      public_holiday: publicHoliday,
    },
    item_count: items.length,
    generated_at: null,
  };
}

type PlanProvenanceDrawerProps = {
  open: boolean;
  onClose: () => void;
  stats: PipelineStats | null;
  canAskAssistant: boolean;
  onAskAssistant?: () => void;
};

export function PlanProvenanceDrawer({
  open,
  onClose,
  stats,
  canAskAssistant,
  onAskAssistant,
}: PlanProvenanceDrawerProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const steps = useMemo(() => {
    const signals = stats?.weather_event_signals ?? null;
    const signalParts: string[] = [];
    if (signals?.is_rain) signalParts.push(t("today.init.recap.rain"));
    if (signals?.special_event) signalParts.push(t("today.init.recap.event"));
    if (signals?.public_holiday)
      signalParts.push(t("today.init.recap.holiday"));

    const modelNames = (stats?.models_used ?? []).map((key) =>
      MODEL_LABEL_KEYS[key] ? t(MODEL_LABEL_KEYS[key]) : key,
    );

    return [
      {
        key: "read",
        title: t("today.provenance.step.read.title"),
        body: t("today.provenance.step.read.body"),
        fact: stats?.history_days_loaded
          ? t("today.init.recap.historyDays", {
              days: stats.history_days_loaded,
            })
          : null,
      },
      {
        key: "clean",
        title: t("today.provenance.step.clean.title"),
        body: t("today.provenance.step.clean.body"),
        fact:
          (stats?.excluded_days_max ?? 0) > 0
            ? t("today.provenance.step.clean.fact", {
                count: stats?.excluded_days_max ?? 0,
                items: stats?.items_with_exclusions ?? 0,
              })
            : t("today.init.recap.noExclusions"),
      },
      {
        key: "signals",
        title: t("today.provenance.step.signals.title"),
        body: t("today.provenance.step.signals.body"),
        fact: signalParts.length
          ? signalParts.join(" · ")
          : t("today.init.recap.noSignals"),
      },
      {
        key: "blend",
        title: t("today.provenance.step.blend.title"),
        body: t("today.provenance.step.blend.body"),
        fact: modelNames.length ? modelNames.join(" · ") : null,
      },
      {
        key: "targets",
        title: t("today.provenance.step.targets.title"),
        body: t("today.provenance.step.targets.body"),
        fact:
          stats?.service_level_avg != null
            ? t("today.provenance.step.targets.fact", {
                pct: Math.round((stats.service_level_avg ?? 0) * 100),
              })
            : null,
      },
    ];
  }, [stats, t]);

  if (!open || !mounted) return null;

  const drawer = (
    <div className="fixed inset-0 z-9999 flex">
      <div
        className="flex-1 bg-black/50"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="flex h-full w-[420px] max-w-[88vw] flex-col border-l border-surface-4 bg-surface-1 animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={t("today.provenance.title")}
      >
        <header className="flex items-start justify-between border-b border-surface-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t("today.provenance.eyebrow")}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-text-primary">
              {t("today.provenance.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("today.provenance.close")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {stats ? (
            <ol>
              {steps.map((step, index) => {
                const isLast = index === steps.length - 1;
                return (
                  <li key={step.key} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border border-brand-gold/60 text-[9px] font-semibold text-brand-gold">
                        {index + 1}
                      </span>
                      {!isLast ? (
                        <span className="w-px flex-1 bg-surface-4" />
                      ) : null}
                    </div>
                    <div className={isLast ? "pb-1" : "pb-6"}>
                      <p className="text-sm font-semibold text-text-primary">
                        {step.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                        {step.body}
                      </p>
                      {step.fact ? (
                        <p className="mt-1.5 text-xs font-medium text-brand-gold">
                          {step.fact}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-text-secondary">
              {t("today.provenance.unavailable")}
            </p>
          )}
        </div>

        {canAskAssistant && onAskAssistant ? (
          <footer className="border-t border-surface-4 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                onClose();
                onAskAssistant();
              }}
              className="inline-flex h-8 items-center rounded-lg border border-[#2E2E33] px-3 text-xs font-semibold text-text-primary transition-colors duration-200 hover:bg-surface-3"
            >
              {t("today.provenance.askWhy")}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
