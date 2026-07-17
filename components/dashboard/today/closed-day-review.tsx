"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { formatMoney, formatQuantity } from "@/lib/format";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateBranchDayNotes } from "@/services/production-intelligence/hooks";
import { DayVarianceCausePrompt } from "./day-variance-cause-prompt";
import { RemainingAttributionPrompt } from "./remaining-attribution-prompt";
import type {
  BranchDayToday,
  PipelineStats,
} from "@/services/production-intelligence/types";
import type { Translator } from "./today-helpers";

type Reaction = "FIRED_UP" | "GOOD" | "MEH" | "ROUGH";

function getReactionMessages(t: Translator): Record<string, string[]> {
  const pool = (group: string) =>
    [0, 1, 2, 3, 4, 5].map((i) => t(`today.reaction.${group}.${i}`));
  return {
    FIRED_UP: pool("firedUp"),
    GOOD: pool("good"),
    MEH: pool("meh"),
    ROUGH: pool("rough"),
  };
}

/**
 * End-of-day recap: headline grade, KPI bar, item scorecard, chef-vs-AI
 * divergence, learning signals, tomorrow's early signal, and the reaction/
 * note capture. Owns its own note + reaction state.
 */
export function ClosedDayReview({
  branchDay,
  branchId,
  provenanceStats,
}: {
  branchDay: BranchDayToday;
  branchId: string;
  provenanceStats: PipelineStats | null | undefined;
}) {
  const { t } = useTranslation();
  const reactionMessages = useMemo(() => getReactionMessages(t), [t]);
  const updateBranchDayNotesMutation = useUpdateBranchDayNotes();

  const [dayNote, setDayNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [dayReaction, setDayReaction] = useState<Reaction | "">("");
  const [ackMessage, setAckMessage] = useState("");
  const [ackVisible, setAckVisible] = useState(false);
  const [ackPending, setAckPending] = useState(false);

  const rp = branchDay.review_phase;
  if (!rp) {
    return (
      <section className="mt-8">
        <div className="py-16 text-center">
          <div className="mb-3 inline-flex items-center justify-center">
            <Spinner size="lg" />
          </div>
          <p className="text-sm text-text-muted">
            {t("today.closed.preparingSummary")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {t("today.closed.takesAFewSeconds")}
          </p>
        </div>
      </section>
    );
  }

  const accuracy = rp.daily_outcome.metrics.forecast_accuracy.value;
  const wasteCost = rp.daily_outcome.metrics.waste_cost.value;
  const stockouts = rp.daily_outcome.metrics.stockouts.value;
  const revenueProtected = rp.daily_outcome.metrics.revenue_protected.value;
  const wasteDelta = rp.daily_outcome.metrics.waste_cost.comparison;
  const accDelta = rp.daily_outcome.metrics.forecast_accuracy.comparison;
  const unaccountedUnits = rp.daily_outcome.metrics.unaccounted?.value ?? 0;

  const grade =
    accuracy >= 85 && stockouts === 0
      ? "great"
      : accuracy >= 75 && stockouts <= 1
        ? "good"
        : accuracy >= 60
          ? "solid"
          : "tough";
  const gradeLabel =
    grade === "great"
      ? t("today.closed.great")
      : grade === "good"
        ? t("today.closed.good")
        : grade === "solid"
          ? t("today.closed.solid")
          : t("today.closed.tough");
  const gradeClass =
    grade === "great" || grade === "good"
      ? "text-status-success"
      : grade === "solid"
        ? "text-status-warning"
        : "text-status-critical";
  const gradeSub =
    grade === "great"
      ? t("today.closed.greatSub", { accuracy: accuracy.toFixed(0) })
      : grade === "good"
        ? stockouts === 0
          ? t("today.closed.goodSubNoStockouts", { accuracy: accuracy.toFixed(0) })
          : t("today.closed.goodSubStockouts", {
              accuracy: accuracy.toFixed(0),
              stockouts,
            })
        : grade === "solid"
          ? t("today.closed.solidSub", { accuracy: accuracy.toFixed(0) })
          : t("today.closed.toughSub");

  const overrideItems = rp.learning_signals.training_rows.filter(
    (row) => Math.abs(row.chef_adjustment) >= 0.5,
  );

  const kpis = [
    {
      label: t("today.closed.aiAccuracy"),
      value: `${accuracy.toFixed(0)}%`,
      sub: accDelta
        ? t("today.closed.accuracyDelta", {
            arrow:
              accDelta.direction === "up"
                ? "↑"
                : accDelta.direction === "down"
                  ? "↓"
                  : "→",
            pct: Math.abs(accDelta.delta_pct).toFixed(0),
            day: new Date(branchDay.date + "T12:00:00").toLocaleDateString(
              "en-US",
              { weekday: "long" },
            ),
          })
        : t("today.closed.vsLastSameDay"),
      tone:
        accuracy >= 80
          ? "text-status-success"
          : accuracy >= 65
            ? "text-status-warning"
            : "text-status-critical",
    },
    {
      label: t("today.closed.discardedCost"),
      value: formatMoney(wasteCost),
      sub:
        unaccountedUnits > 0
          ? t("today.closed.unaccountedSub", {
              quantity: formatQuantity(unaccountedUnits, ""),
            })
          : wasteDelta
            ? t("today.closed.wasteDelta", { direction: wasteDelta.direction })
            : null,
      tone:
        unaccountedUnits > 0
          ? "text-status-warning"
          : wasteCost === 0
            ? "text-status-success"
            : wasteDelta?.direction === "down"
              ? "text-status-success"
              : "text-status-warning",
    },
    {
      label: t("today.closed.revenueProtected"),
      value: formatMoney(revenueProtected),
      sub: t("today.closed.fromAvoidingStockouts"),
      tone: revenueProtected > 0 ? "text-status-success" : "text-text-muted",
    },
    {
      label: t("today.closed.stockouts"),
      value: stockouts === 0 ? t("today.closed.none") : `${stockouts}`,
      sub:
        stockouts === 0
          ? t("today.closed.cleanService")
          : t("today.closed.itemsRanOut", { count: stockouts }),
      tone: stockouts === 0 ? "text-status-success" : "text-status-critical",
    },
  ];

  const learningStats = [
    {
      value:
        rp.learning_signals.ml_learning_signals?.rows ??
        rp.learning_signals.training_rows.length,
      label: t("today.closed.trainingSignals"),
      sub: t("today.closed.itemsTracked"),
    },
    {
      value:
        rp.learning_signals.ml_learning_signals?.chef_override_rows ??
        overrideItems.length,
      label: t("today.closed.yourOverrides"),
      sub: t("today.closed.planChanges"),
    },
    {
      value: rp.learning_signals.ml_learning_signals?.waste_rows ?? 0,
      label: t("today.closed.wasteEvents"),
      sub: t("today.closed.itemsWithLeftover"),
    },
    {
      value: rp.learning_signals.ml_learning_signals?.stockout_rows ?? stockouts,
      label: t("today.closed.stockouts"),
      sub: t("today.closed.itemsThatRanOut"),
    },
  ];

  const learnedLines = (() => {
    const ml = rp.learning_signals.ml_learning_signals;
    const daySignals = provenanceStats?.weather_event_signals;
    const lines: string[] = [];
    if (daySignals?.is_rain) lines.push(t("today.learned.rainResponse"));
    if (daySignals?.special_event) lines.push(t("today.learned.eventResponse"));
    const overrideCount = ml?.chef_override_rows ?? overrideItems.length;
    const overridesWon = ml?.chef_outperformed_forecast_rows ?? 0;
    if (overrideCount > 0) {
      lines.push(
        t("today.learned.overrides", { count: overrideCount, won: overridesWon }),
      );
    }
    if ((ml?.waste_rows ?? 0) > 0) {
      lines.push(t("today.learned.wasteRows", { count: ml?.waste_rows ?? 0 }));
    }
    const stockoutCount = ml?.stockout_rows ?? stockouts;
    if (stockoutCount > 0) {
      lines.push(t("today.learned.stockoutRows", { count: stockoutCount }));
    }
    return lines;
  })();

  const reactions: { value: Reaction; emoji: string; label: string }[] = [
    { value: "FIRED_UP", emoji: "🔥", label: t("today.closed.firedUp") },
    { value: "GOOD", emoji: "😊", label: t("today.closed.good") },
    { value: "MEH", emoji: "😐", label: t("today.closed.meh") },
    { value: "ROUGH", emoji: "😮‍💨", label: t("today.closed.rough") },
  ];
  const activeReaction = dayReaction || branchDay.day_reaction || "";

  return (
    <section className="mt-8">
      <div className="space-y-10">
        {/* ── 1. HEADLINE ── */}
        <div className="flex flex-col gap-3 border-b border-surface-4/60 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {t("today.closed.dayClosed")} ·{" "}
              {new Date(branchDay.date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h3 className={`mt-1 font-display text-4xl font-semibold ${gradeClass}`}>
              {gradeLabel}
            </h3>
            <p className="mt-1.5 text-sm text-text-secondary">{gradeSub}</p>
            {rp.key_insights?.insights?.length ? (
              <p className="mt-2 text-sm text-text-muted italic">
                "{rp.key_insights.insights[0]}"
              </p>
            ) : null}
          </div>
        </div>

        {/* ── 2. KPI BAR ── */}
        <div className="grid grid-cols-2 gap-px bg-surface-4/40 rounded-xl overflow-hidden sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-surface-2 px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {kpi.label}
              </p>
              <p className={`mt-2 font-display text-2xl font-semibold ${kpi.tone}`}>
                {kpi.value}
              </p>
              {kpi.sub && <p className="mt-1 text-[11px] text-text-muted">{kpi.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── 3. ITEM SCORECARD ── */}
        {rp.item_performance?.rows?.length ? (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("today.closed.howEachItemDid")}
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
              {rp.item_performance.rows.map((row) => {
                const isStockout = row.stockout;
                const discarded = row.discarded ?? row.waste;
                const unaccounted = row.unaccounted ?? 0;
                const stored = row.stored ?? 0;
                // Three-way split: discarded is waste, unaccounted is a
                // question, stored is tomorrow's stock — never lumped.
                const outcome = isStockout
                  ? {
                      icon: "⚡",
                      cls: "text-status-critical",
                      sub:
                        row.lost_revenue_estimate > 0
                          ? t("today.closed.missedRevenue", {
                              amount: formatMoney(row.lost_revenue_estimate),
                            })
                          : null,
                    }
                  : discarded > 0
                    ? {
                        icon: "✕",
                        cls: "text-status-critical",
                        sub: t("today.closed.discardedQty", {
                          quantity: formatQuantity(discarded, row.unit),
                        }),
                      }
                    : unaccounted > 0
                      ? {
                          icon: "?",
                          cls: "text-status-warning",
                          sub: t("today.closed.unaccountedQty", {
                            quantity: formatQuantity(unaccounted, row.unit),
                          }),
                        }
                      : stored > 0
                        ? {
                            icon: "◷",
                            cls: "text-text-muted",
                            sub: t("today.closed.storedQty", {
                              quantity: formatQuantity(stored, row.unit),
                            }),
                          }
                        : { icon: "✓", cls: "text-status-success", sub: null };
                return (
                  <div key={row.item_id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className={`shrink-0 w-5 text-center text-base ${outcome.cls}`}>
                      {outcome.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/workspace/items/${row.item_id}?branch=${branchId}`}
                        className="text-sm font-medium text-text-primary hover:text-brand-gold transition-colors"
                      >
                        {row.item_title}
                      </Link>
                      {outcome.sub && (
                        <p className="mt-0.5 text-xs text-text-muted">{outcome.sub}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-text-muted">
                        {t("today.closed.soldQuantity", {
                          quantity: formatQuantity(row.sold, row.unit),
                        })}
                      </p>
                      {row.prepared > 0 && (
                        <p className="text-xs text-text-muted">
                          {t("today.closed.ofPrepped", {
                            quantity: formatQuantity(row.prepared, row.unit),
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── 4. AI VS YOU ── */}
        {overrideItems.length > 0 ? (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("today.closed.whereYouDiverged")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t("today.closed.changedPlan", { count: overrideItems.length })}{" "}
              {t("today.closed.howItPlayed")}
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 divide-y divide-surface-4/60">
              {overrideItems.map((row) => {
                const won = row.service_outcome === "IMPROVED_BY_CHEF";
                const snapshot = branchDay.review_item_snapshot?.find(
                  (s) => s.item_id === row.item_id,
                );
                const itemWasteCost = snapshot ? parseFloat(snapshot.waste_cost) : 0;
                const missedRevenue = snapshot
                  ? parseFloat(snapshot.lost_revenue_estimate)
                  : 0;
                const costLine =
                  itemWasteCost > 1
                    ? t("today.closed.wasteLine", { amount: formatMoney(itemWasteCost) })
                    : missedRevenue > 1
                      ? t("today.closed.missedLine", {
                          amount: formatMoney(missedRevenue),
                        })
                      : null;
                return (
                  <div
                    key={row.item_id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5"
                  >
                    <p className="min-w-[140px] text-sm font-medium text-text-primary">
                      {row.item_title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>
                        {t("today.closed.ai")}:{" "}
                        <span className="font-medium text-text-secondary">
                          {formatQuantity(row.forecast_qty, row.unit)}
                        </span>
                      </span>
                      <span className="text-text-muted">→</span>
                      <span>
                        {t("today.closed.you")}:{" "}
                        <span className="font-medium text-text-secondary">
                          {formatQuantity(row.chef_planned_qty, row.unit)}
                        </span>
                      </span>
                      <span className="text-text-muted">→</span>
                      <span>
                        {t("today.closed.sold")}:{" "}
                        <span className="font-semibold text-text-primary">
                          {formatQuantity(row.actual_sales, row.unit)}
                        </span>
                      </span>
                      {costLine && (
                        <span
                          className={won ? "text-status-success" : "text-status-warning"}
                        >
                          · {costLine}
                        </span>
                      )}
                    </div>
                    <span
                      className={`ml-auto shrink-0 text-xs font-semibold ${won ? "text-status-success" : "text-status-warning"}`}
                    >
                      {won
                        ? t("today.closed.yourCallPaidOff")
                        : t("today.closed.aiWasCloser")}
                    </span>
                  </div>
                );
              })}
            </div>
            {(rp.learning_signals.ml_learning_signals
              ?.chef_outperformed_forecast_rows ?? 0) > 0 && (
              <p className="mt-3 text-xs text-status-success">
                {t("today.closed.overridesImproved", {
                  count:
                    rp.learning_signals.ml_learning_signals
                      ?.chef_outperformed_forecast_rows ?? 0,
                })}
              </p>
            )}
          </section>
        ) : null}

        {/* ── 5. WHAT THE MODEL LEARNED ── */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("today.closed.whatModelLearned")}
          </p>
          {learnedLines.length ? (
            <ul className="mt-3 space-y-2 border-l-2 border-brand-gold/30 pl-4">
              {learnedLines.map((line) => (
                <li key={line} className="text-sm text-text-secondary">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-0 rounded-xl border border-surface-4 bg-surface-2 overflow-hidden sm:grid-cols-4 divide-x divide-surface-4/60">
            {learningStats.map((s) => (
              <div key={s.label} className="px-5 py-4">
                <p className="font-display text-2xl font-semibold text-text-primary">
                  {s.value}
                </p>
                <p className="mt-0.5 text-xs font-medium text-text-secondary">
                  {s.label}
                </p>
                <p className="mt-0.5 text-[11px] text-text-muted">{s.sub}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {t("today.closed.modelImproves")}
          </p>
        </section>

        {/* ── 6. TOMORROW ── */}
        <section className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("today.closed.beforeTomorrow")}
          </p>
          <p className="mt-2 text-sm font-medium text-text-primary">
            {rp.tomorrow_early_signal.message}
          </p>
          {rp.tomorrow_early_signal.expected_demand_change_pct !== 0 && (
            <p className="mt-1 text-xs text-text-muted">
              {t("today.closed.demandExpectedToBe")}{" "}
              <span
                className={`font-semibold ${rp.tomorrow_early_signal.expected_demand_change_pct > 0 ? "text-status-success" : "text-status-warning"}`}
              >
                {rp.tomorrow_early_signal.expected_demand_change_pct > 0 ? "+" : ""}
                {rp.tomorrow_early_signal.expected_demand_change_pct.toFixed(0)}%
              </span>{" "}
              {rp.tomorrow_early_signal.weekday
                ? t("today.closed.vsTypical", {
                    day: rp.tomorrow_early_signal.weekday,
                  })
                : t("today.closed.vsBaseline")}
              {rp.tomorrow_early_signal.sample_size
                ? t("today.closed.basedOn", {
                    count: rp.tomorrow_early_signal.sample_size,
                  })
                : ""}
            </p>
          )}
          {rp.learning_signals.tomorrow_actions?.length ? (
            <ul className="mt-4 space-y-2 border-t border-brand-gold/20 pt-4">
              {rp.learning_signals.tomorrow_actions.map((action) => (
                <li
                  key={action}
                  className="flex items-start gap-2 text-sm text-text-secondary"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />
                  {action}
                </li>
              ))}
            </ul>
          ) : null}
          <Link
            href={`/workspace/today?branch_id=${branchDay.branch_id}&date=${rp.tomorrow_early_signal.target_date}`}
            className="mt-4 inline-flex h-9 items-center rounded-full border border-brand-gold/40 px-4 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/15"
          >
            {t("today.closed.previewTomorrow")}
          </Link>
        </section>

        {/* ── 6.5 WHAT HAPPENED? (only when variance exceeds threshold) ── */}
        <RemainingAttributionPrompt branchDay={branchDay} />

        <DayVarianceCausePrompt branchDay={branchDay} />

        {/* ── 7. HOW DID TODAY FEEL + NOTE ── */}
        <section className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {t("today.closed.howLeaving")}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {t("today.closed.feelRightNow")}
            </p>
            <div className="mt-3 flex gap-3">
              {reactions.map((r) => {
                const isActive = activeReaction === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    title={r.label}
                    onClick={() => {
                      const next = isActive ? "" : r.value;
                      setDayReaction(next as Reaction | "");
                      setAckVisible(false);
                      setAckMessage("");
                      if (!branchDay.id) return;
                      updateBranchDayNotesMutation.mutate({
                        branchDayId: branchDay.id,
                        reaction: next,
                      });
                      if (next) {
                        const pool = reactionMessages[next] ?? [];
                        const msg =
                          pool[Math.floor(Math.random() * pool.length)] ?? "";
                        setAckPending(true);
                        setTimeout(() => {
                          setAckMessage(msg);
                          setAckPending(false);
                          setAckVisible(true);
                        }, 400 + Math.random() * 900);
                      } else {
                        setAckPending(false);
                      }
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 transition-all ${
                      isActive
                        ? "border-brand-gold bg-brand-gold/10 scale-105"
                        : "border-surface-4 bg-surface-3 hover:border-brand-gold/30 hover:bg-brand-gold/5"
                    }`}
                  >
                    <span className="text-2xl leading-none">{r.emoji}</span>
                    <span
                      className={`text-[11px] font-medium ${isActive ? "text-brand-gold" : "text-text-muted"}`}
                    >
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {ackPending && (
              <div className="mt-3 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
              </div>
            )}
            {ackVisible && ackMessage && (
              <p className="mt-3 text-sm text-text-secondary animate-in fade-in slide-in-from-bottom-1 duration-300">
                {ackMessage}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              {t("today.closed.anythingWorthNoting")}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {t("today.closed.contextMakesSharper")}
            </p>
            {noteSaved ? (
              <p className="mt-4 text-sm text-status-success">
                {t("today.closed.saved")}
              </p>
            ) : (
              <div className="mt-3">
                <textarea
                  rows={3}
                  placeholder={t("today.closed.notePlaceholder")}
                  value={dayNote || branchDay.session_notes || ""}
                  onChange={(e) => setDayNote(e.target.value)}
                  className="w-full resize-none rounded-xl border border-surface-4 bg-surface-3 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] text-text-muted">
                    {t("today.closed.notShared")}
                  </p>
                  <button
                    type="button"
                    disabled={!dayNote.trim() || updateBranchDayNotesMutation.isPending}
                    onClick={() => {
                      if (!branchDay.id || !dayNote.trim()) return;
                      updateBranchDayNotesMutation.mutate(
                        { branchDayId: branchDay.id, notes: dayNote.trim() },
                        { onSuccess: () => setNoteSaved(true) },
                      );
                    }}
                    className="inline-flex h-9 items-center rounded-full border border-brand-gold/40 px-4 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/15 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateBranchDayNotesMutation.isPending
                      ? t("today.closed.saving")
                      : t("today.closed.saveNote")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
