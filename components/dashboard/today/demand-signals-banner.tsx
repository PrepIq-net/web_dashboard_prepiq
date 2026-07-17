"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { toPercent } from "@/lib/format";
import { ModalShell } from "@/components/ui/modal-shell";
import type {
  BranchDayToday,
  MorningBrief,
} from "@/services/production-intelligence/types";
import type { Translator } from "./today-helpers";

/**
 * Persistent Demand Signals banner — the same strip across Morning, Service
 * and Review. PrepIQ reads these operational variables before the kitchen
 * opens; this makes that visible. A signal that is actively shaping today's
 * numbers is tinted and clickable: the micro-modal shows the exact
 * parameters feeding the baseline.
 */

type SignalTone = "up" | "down" | "attention" | "neutral";

type BannerSignal = {
  key: string;
  label: string;
  valueLabel: string | null;
  tone: SignalTone;
  active: boolean;
  detail: {
    description: string;
    params: Array<{ label: string; value: string }>;
  };
};

const TONE_CLASSES: Record<SignalTone, string> = {
  up: "border-status-success/35 bg-status-success/8 text-status-success",
  down: "border-status-critical/35 bg-status-critical/8 text-status-critical",
  attention: "border-status-warning/35 bg-status-warning/8 text-status-warning",
  neutral: "border-surface-4 bg-surface-3/30 text-text-muted",
};

function payloadSignal(
  branchDay: BranchDayToday,
  keys: string[],
): NonNullable<BranchDayToday["demand_signal"]["signals"]>[number] | null {
  for (const signal of branchDay.demand_signal.signals ?? []) {
    if (keys.includes(signal.key)) return signal;
  }
  return null;
}

function fromPayloadSignal(
  t: Translator,
  key: string,
  label: string,
  signal: NonNullable<BranchDayToday["demand_signal"]["signals"]>[number] | null,
): BannerSignal {
  if (!signal || signal.direction === "neutral") {
    return {
      key,
      label,
      valueLabel: null,
      tone: "neutral",
      active: false,
      detail: {
        description:
          signal?.explanation || t("today.signalsBanner.noEffectDetail"),
        params: [],
      },
    };
  }
  const params: Array<{ label: string; value: string }> = [
    {
      label: t("today.signalsBanner.param.effect"),
      value: toPercent(signal.value_pct),
    },
  ];
  if (signal.learned && signal.learned.sample_count > 0) {
    params.push({
      label: t("today.signalsBanner.param.learnedFrom"),
      value: t("today.signalsBanner.param.days", {
        count: signal.learned.sample_count,
      }),
    });
    if (signal.learned.delta_pct != null) {
      params.push({
        label: t("today.signalsBanner.param.learnedResponse"),
        value: toPercent(signal.learned.delta_pct),
      });
    }
  }
  return {
    key,
    label,
    valueLabel: toPercent(signal.value_pct),
    tone: signal.direction === "up" ? "up" : "down",
    active: true,
    detail: { description: signal.explanation, params },
  };
}

function buildSignals(
  t: Translator,
  branchDay: BranchDayToday,
  brief: MorningBrief | null,
): BannerSignal[] {
  const signals: BannerSignal[] = [];
  const demand = branchDay.demand_signal;
  const briefSignals = brief?.drivers?.signals ?? null;

  // 1. Historical sales trends — the baseline the whole forecast stands on.
  const demandDeltaPct =
    demand.expected_demand_delta_pct ?? (demand.expected_demand_index - 1) * 100;
  signals.push({
    key: "history",
    label: t("today.signalsBanner.history"),
    valueLabel: Math.abs(demandDeltaPct) >= 2 ? toPercent(demandDeltaPct) : null,
    tone:
      demandDeltaPct >= 2 ? "up" : demandDeltaPct <= -2 ? "down" : "neutral",
    active: Math.abs(demandDeltaPct) >= 2,
    detail: {
      description: t("today.signalsBanner.historyDetail", {
        typicalDay:
          demand.typical_day_label ?? t("today.signalsBanner.typicalDay"),
      }),
      params: [
        {
          label: t("today.signalsBanner.param.expectedVsTypical"),
          value: toPercent(demandDeltaPct),
        },
        {
          label: t("today.signalsBanner.param.forecastConfidence"),
          value: `${Math.round(demand.forecast_confidence * 100)}%`,
        },
      ],
    },
  });

  // 2. Operating hours (capacity-side signals from the aggregator).
  signals.push(
    fromPayloadSignal(
      t,
      "operating_hours",
      t("today.signalsBanner.operatingHours"),
      payloadSignal(branchDay, ["kitchen_capacity", "staffing"]),
    ),
  );

  // 3. Weather.
  const weather = fromPayloadSignal(
    t,
    "weather",
    t("today.signalsBanner.weather"),
    payloadSignal(branchDay, ["weather"]),
  );
  if (briefSignals?.weather_condition) {
    weather.detail.params.push({
      label: t("today.signalsBanner.param.condition"),
      value: briefSignals.weather_condition,
    });
    if (briefSignals.is_rain) {
      weather.detail.params.push({
        label: t("today.signalsBanner.param.rain"),
        value: t("today.signalsBanner.param.yes"),
      });
    }
  }
  signals.push(weather);

  // 4. Stockout history — items whose track record flags a shortage risk.
  const highRiskItems =
    branchDay.morning_overview?.high_risk_items ?? demand.high_risk_items ?? 0;
  signals.push({
    key: "stockout_history",
    label: t("today.signalsBanner.stockoutHistory"),
    valueLabel: highRiskItems > 0 ? String(highRiskItems) : null,
    tone: highRiskItems > 0 ? "attention" : "neutral",
    active: highRiskItems > 0,
    detail: {
      description:
        highRiskItems > 0
          ? t("today.signalsBanner.stockoutDetailActive", {
              count: highRiskItems,
            })
          : t("today.signalsBanner.stockoutDetailQuiet"),
      params: [
        {
          label: t("today.signalsBanner.param.itemsAtRisk"),
          value: String(highRiskItems),
        },
        {
          label: t("today.signalsBanner.param.trackedItems"),
          value: String(
            demand.tracked_items ?? branchDay.prep_plan_items.length,
          ),
        },
      ],
    },
  });

  // 5. Day-of-week context.
  const similarDay = payloadSignal(branchDay, ["similar_day"]);
  signals.push({
    key: "day_of_week",
    label: t("today.signalsBanner.dayOfWeek"),
    valueLabel: similarDay && similarDay.direction !== "neutral"
      ? toPercent(similarDay.value_pct)
      : null,
    tone:
      similarDay && similarDay.direction !== "neutral"
        ? similarDay.direction === "up"
          ? "up"
          : "down"
        : "neutral",
    active: Boolean(similarDay && similarDay.direction !== "neutral"),
    detail: {
      description:
        similarDay?.explanation ??
        t("today.signalsBanner.dayOfWeekDetail", {
          typicalDay:
            demand.typical_day_label ?? t("today.signalsBanner.typicalDay"),
        }),
      params: similarDay
        ? [
            {
              label: t("today.signalsBanner.param.effect"),
              value: toPercent(similarDay.value_pct),
            },
          ]
        : [],
    },
  });

  // 6. Local events & public holidays.
  const eventSignal = fromPayloadSignal(
    t,
    "events",
    t("today.signalsBanner.events"),
    payloadSignal(branchDay, ["event", "local_event", "reservation"]),
  );
  if (briefSignals?.public_holiday) {
    eventSignal.active = true;
    if (eventSignal.tone === "neutral") eventSignal.tone = "attention";
    eventSignal.detail.params.push({
      label: t("today.signalsBanner.param.publicHoliday"),
      value: t("today.signalsBanner.param.yes"),
    });
  }
  if (briefSignals?.sports_event && briefSignals.sports_event_name) {
    eventSignal.active = true;
    if (eventSignal.tone === "neutral") eventSignal.tone = "attention";
    eventSignal.detail.params.push({
      label: t("today.signalsBanner.param.sportsEvent"),
      value: briefSignals.sports_event_name,
    });
  }
  signals.push(eventSignal);

  // 7. Active chef adjustments — overrides shaping today's plan.
  const overrides = branchDay.prep_plan_items.filter(
    (item) => item.decision === "CHEF_OVERRIDE",
  ).length;
  signals.push({
    key: "chef_adjustments",
    label: t("today.signalsBanner.chefAdjustments"),
    valueLabel: overrides > 0 ? String(overrides) : null,
    tone: overrides > 0 ? "attention" : "neutral",
    active: overrides > 0,
    detail: {
      description:
        overrides > 0
          ? t("today.signalsBanner.chefDetailActive", { count: overrides })
          : t("today.signalsBanner.chefDetailQuiet"),
      params: [
        {
          label: t("today.signalsBanner.param.overriddenItems"),
          value: String(overrides),
        },
      ],
    },
  });

  // 8. Live macro-trend detections (validated network patterns).
  const network = branchDay.kitchen_intelligence_network ?? null;
  const validatedPatterns = (
    network?.network_aggregation?.detected_patterns ?? []
  ).filter((pattern) => pattern.is_validated);
  const topPattern = [...validatedPatterns].sort(
    (a, b) => Math.abs(b.effect_pct) - Math.abs(a.effect_pct),
  )[0];
  signals.push({
    key: "macro_trends",
    label: t("today.signalsBanner.macroTrends"),
    valueLabel: topPattern ? toPercent(topPattern.effect_pct) : null,
    tone: topPattern
      ? topPattern.effect_pct >= 0
        ? "up"
        : "down"
      : "neutral",
    active: Boolean(topPattern),
    detail: {
      description: topPattern
        ? t("today.signalsBanner.macroDetailActive", {
            item: topPattern.item_name,
            pct: toPercent(topPattern.effect_pct),
          })
        : t("today.signalsBanner.macroDetailQuiet"),
      params: topPattern
        ? [
            {
              label: t("today.signalsBanner.param.pattern"),
              value: `${topPattern.item_name} · ${topPattern.trigger_factor}`,
            },
            {
              label: t("today.signalsBanner.param.confidence"),
              value: `${Math.round(topPattern.confidence * 100)}%`,
            },
          ]
        : [],
    },
  });

  // 9. Live network signals (cross-location transfer).
  const transfers = network?.knowledge_transfer ?? [];
  const crossPatterns = network?.network_aggregation?.cross_location_patterns ?? [];
  const activeLocations = network?.network_aggregation?.active_locations ?? 0;
  const networkActive = transfers.length > 0 || crossPatterns.length > 0;
  signals.push({
    key: "network",
    label: t("today.signalsBanner.network"),
    valueLabel: networkActive ? String(activeLocations || transfers.length) : null,
    tone: networkActive ? "attention" : "neutral",
    active: networkActive,
    detail: {
      description: networkActive
        ? transfers[0]?.suggested_action ??
          t("today.signalsBanner.networkDetailActive", {
            count: activeLocations,
          })
        : t("today.signalsBanner.networkDetailQuiet"),
      params: [
        {
          label: t("today.signalsBanner.param.locations"),
          value: String(activeLocations),
        },
        ...(crossPatterns[0]
          ? [
              {
                label: t("today.signalsBanner.param.pattern"),
                value: `${crossPatterns[0].item_name} (${crossPatterns[0].spread_pct.toFixed(1)}%)`,
              },
            ]
          : []),
      ],
    },
  });

  return signals;
}

export function DemandSignalsBanner({
  branchDay,
  brief,
}: {
  branchDay: BranchDayToday;
  brief: MorningBrief | null;
}) {
  const { t } = useTranslation();
  const [openSignal, setOpenSignal] = useState<BannerSignal | null>(null);

  const signals = useMemo(
    () => buildSignals(t, branchDay, brief),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branchDay, brief],
  );

  return (
    <div className="mb-6 rounded-[10px] border border-surface-4 bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("today.signalsBanner.title")}
        </p>
        {signals.map((signal) => {
          const chip = (
            <>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  signal.active ? "bg-current" : "bg-surface-4"
                }`}
                aria-hidden
              />
              {signal.label}
              {signal.valueLabel ? (
                <span className="font-semibold">{signal.valueLabel}</span>
              ) : null}
            </>
          );
          const chipClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE_CLASSES[signal.tone]}`;
          return signal.active ? (
            <button
              key={signal.key}
              type="button"
              onClick={() => setOpenSignal(signal)}
              className={`${chipClass} transition-colors hover:brightness-125`}
            >
              {chip}
            </button>
          ) : (
            <span key={signal.key} className={chipClass}>
              {chip}
            </span>
          );
        })}
      </div>

      <ModalShell
        open={Boolean(openSignal)}
        title={openSignal?.label ?? ""}
        description={t("today.signalsBanner.modalDescription")}
        onClose={() => setOpenSignal(null)}
        maxWidthClassName="max-w-sm"
      >
        {openSignal ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-text-secondary">
              {openSignal.detail.description}
            </p>
            {openSignal.detail.params.length > 0 ? (
              <dl className="divide-y divide-surface-4/60 rounded-lg border border-surface-4 bg-surface-3/30">
                {openSignal.detail.params.map((param) => (
                  <div
                    key={param.label}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <dt className="text-xs text-text-muted">{param.label}</dt>
                    <dd className="text-xs font-semibold text-text-primary">
                      {param.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
      </ModalShell>
    </div>
  );
}
