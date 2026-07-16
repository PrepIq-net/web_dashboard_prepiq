"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatQuantity, isDiscreteUnit } from "@/lib/format";
import { useAttributeOutcomes } from "@/services/production-intelligence/hooks";
import type {
  BranchDayToday,
  DiscardReason,
  OutcomeAttributionRow,
  OutcomeState,
} from "@/services/production-intelligence/types";

const OUTCOME_STATES: OutcomeState[] = [
  "REFRIGERATED",
  "FROZEN",
  "CONVERTED",
  "STAFF_MEAL",
  "DISCOUNTED",
  "DISCARDED",
  "UNKNOWN",
];

const DISCARD_REASONS = [
  "SPOILED",
  "QUALITY_ISSUE",
  "DEMAND_DROPPED",
  "LATE_PREP",
  "OTHER",
] as const;

/**
 * The end-of-day conversation: every unsold unit ends the day in a state the
 * chef names — stored, frozen, converted, staff meal, discounted, discarded,
 * or "not sure". Nothing here is waste until the chef says so; stored answers
 * become tomorrow's carry-over stock. Rows arrive sorted by cost impact and
 * minor remainders stay collapsed, so a busy kitchen answers the expensive
 * questions in a few taps.
 */
export function RemainingAttributionPrompt({
  branchDay,
}: {
  branchDay: BranchDayToday;
}) {
  const { t } = useTranslation();
  const attribution = branchDay.review_phase?.outcome_attribution;
  const stockoutQuestions = branchDay.review_phase?.stockout_questions ?? [];
  const expiredRows = branchDay.review_phase?.expired_carry_over ?? [];
  const attributeMutation = useAttributeOutcomes();
  const [showMinor, setShowMinor] = useState(false);
  const [answeredStockouts, setAnsweredStockouts] = useState<Set<string>>(
    new Set(),
  );
  const [resolvedExpired, setResolvedExpired] = useState<Set<string>>(new Set());

  const { majorRows, minorRows } = useMemo(() => {
    const rows = attribution?.rows ?? [];
    return {
      majorRows: rows.filter((row) => !row.minor),
      minorRows: rows.filter((row) => row.minor),
    };
  }, [attribution]);

  if (
    !branchDay.id ||
    (!attribution?.rows?.length && !stockoutQuestions.length && !expiredRows.length)
  ) {
    return null;
  }

  const saveEntries = (
    row: OutcomeAttributionRow,
    entries: {
      state: OutcomeState;
      quantity: number;
      discard_reason?: DiscardReason;
    }[],
  ) => {
    attributeMutation.mutate({
      branchDayId: branchDay.id,
      payload: { item_id: row.item_id, entries },
    });
  };

  const bulkAttribute = (state: OutcomeState) => {
    for (const row of attribution?.rows ?? []) {
      if (row.complete) continue;
      const unattributed = Math.max(row.remaining - row.attributed_total, 0);
      if (unattributed <= 0) continue;
      saveEntries(row, [
        ...entriesFromAttributed(row),
        { state, quantity: roundQty(unattributed, row.unit) },
      ]);
    }
  };

  const summary = attribution?.summary;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {t("today.outcomes.title")}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {t("today.outcomes.subtitle")}
          </p>
        </div>
        {summary ? (
          <p
            className={`text-xs font-semibold ${
              summary.complete ? "text-status-success" : "text-text-muted"
            }`}
          >
            {summary.complete
              ? t("today.outcomes.allAttributed")
              : t("today.outcomes.progress", {
                  attributed: formatQuantity(summary.attributed_remaining, ""),
                  total: formatQuantity(summary.total_remaining, ""),
                })}
          </p>
        ) : null}
      </div>

      {majorRows.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            {t("today.outcomes.bulk")}
          </span>
          <button
            type="button"
            onClick={() => bulkAttribute("REFRIGERATED")}
            className="inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] font-medium text-text-secondary hover:bg-surface-3"
          >
            {t("today.outcomes.bulkStore")}
          </button>
          <button
            type="button"
            onClick={() => bulkAttribute("UNKNOWN")}
            className="inline-flex h-7 items-center rounded-full border border-surface-4 px-2.5 text-[11px] font-medium text-text-secondary hover:bg-surface-3"
          >
            {t("today.outcomes.bulkUnknown")}
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {majorRows.map((row) => (
          <ItemAttributionCard
            key={row.item_id}
            row={row}
            onSave={(entries) => saveEntries(row, entries)}
            isSaving={attributeMutation.isPending}
          />
        ))}
      </div>

      {minorRows.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowMinor((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-xl border border-surface-4/60 bg-surface-2 px-4 py-2.5 text-left hover:border-surface-4"
          >
            <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              {t("today.outcomes.minorLeftovers", { count: minorRows.length })}
            </span>
            <span className="text-xs text-text-muted">
              {showMinor ? t("today.live.hide") : t("today.live.showAll")}
            </span>
          </button>
          {showMinor ? (
            <div className="mt-2 space-y-3">
              {minorRows.map((row) => (
                <ItemAttributionCard
                  key={row.item_id}
                  row={row}
                  onSave={(entries) => saveEntries(row, entries)}
                  isSaving={attributeMutation.isPending}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {stockoutQuestions.length > 0 ? (
        <div className="space-y-2">
          {stockoutQuestions
            .filter((question) => !answeredStockouts.has(question.item_id))
            .map((question) => (
              <div
                key={question.item_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3"
              >
                <p className="text-sm text-text-primary">
                  {t("today.outcomes.stockoutQuestion", {
                    item: question.item_title,
                    sold: formatQuantity(question.sold, question.unit),
                    prepared: formatQuantity(question.prepared, question.unit),
                  })}
                </p>
                <div className="flex items-center gap-2">
                  {[true, false].map((confirmed) => (
                    <button
                      key={String(confirmed)}
                      type="button"
                      onClick={() => {
                        attributeMutation.mutate({
                          branchDayId: branchDay.id,
                          payload: {
                            item_id: question.item_id,
                            stockout_confirmed: confirmed,
                          },
                        });
                        setAnsweredStockouts((prev) =>
                          new Set(prev).add(question.item_id),
                        );
                      }}
                      className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary hover:bg-surface-3"
                    >
                      {confirmed
                        ? t("today.outcomes.stockoutYes")
                        : t("today.outcomes.stockoutNo")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : null}

      {expiredRows.length > 0 ? (
        <div className="space-y-2">
          {expiredRows
            .filter((row) => !resolvedExpired.has(row.outcome_id))
            .map((row) => (
              <div
                key={row.outcome_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3"
              >
                <p className="text-sm text-text-primary">
                  {t("today.outcomes.expiredQuestion", {
                    quantity: formatQuantity(row.quantity, row.unit),
                    item: row.item_title,
                    state: t(`today.outcomes.state.${row.state}`),
                    date: row.stored_on,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  {(["DISCARD", "USED", "STILL_GOOD"] as const).map(
                    (resolution) => (
                      <button
                        key={resolution}
                        type="button"
                        onClick={() => {
                          attributeMutation.mutate({
                            branchDayId: branchDay.id,
                            payload: {
                              expired_resolution: {
                                outcome_id: row.outcome_id,
                                resolution,
                              },
                            },
                          });
                          setResolvedExpired((prev) =>
                            new Set(prev).add(row.outcome_id),
                          );
                        }}
                        className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium hover:bg-surface-3 ${
                          resolution === "DISCARD"
                            ? "border-status-critical/40 text-status-critical hover:bg-status-critical/10"
                            : "border-surface-4 text-text-secondary"
                        }`}
                      >
                        {t(`today.outcomes.expired.${resolution}`)}
                      </button>
                    ),
                  )}
                </div>
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}

function roundQty(value: number, unit: string) {
  return isDiscreteUnit(unit) ? Math.round(value) : Math.round(value * 100) / 100;
}

function entriesFromAttributed(row: OutcomeAttributionRow) {
  return Object.entries(row.attributed)
    .filter(([, quantity]) => quantity > 0)
    .map(([state, quantity]) => ({
      state: state as OutcomeState,
      quantity,
    }));
}

function ItemAttributionCard({
  row,
  onSave,
  isSaving,
}: {
  row: OutcomeAttributionRow;
  onSave: (
    entries: {
      state: OutcomeState;
      quantity: number;
      discard_reason?: DiscardReason;
    }[],
  ) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Record<string, number>>(() => ({
    ...row.attributed,
  }));
  const [discardReason, setDiscardReason] = useState<DiscardReason | "">("");

  const attributedTotal = Object.values(draft).reduce(
    (sum, quantity) => sum + (quantity || 0),
    0,
  );
  const unattributed = Math.max(row.remaining - attributedTotal, 0);
  const complete = unattributed <= 0.01;

  const commit = (nextDraft: Record<string, number>, nextReason = discardReason) => {
    const entries = OUTCOME_STATES.map((state) => ({
      state,
      quantity: roundQty(nextDraft[state] ?? 0, row.unit),
      ...(state === "DISCARDED" && nextReason
        ? { discard_reason: nextReason }
        : {}),
    }));
    onSave(entries);
  };

  const toggleState = (state: OutcomeState) => {
    const next = { ...draft };
    if (next[state] && next[state] > 0) {
      delete next[state];
    } else {
      next[state] = roundQty(Math.max(unattributed, 0), row.unit) || row.remaining;
    }
    setDraft(next);
    commit(next);
  };

  const setQuantity = (state: OutcomeState, value: string) => {
    const next = { ...draft, [state]: Number(value) || 0 };
    setDraft(next);
  };

  return (
    <article
      className={`rounded-xl border bg-surface-2 p-4 ${
        complete ? "border-status-success/30" : "border-surface-4"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">
          {t("today.outcomes.itemQuestion", {
            quantity: formatQuantity(row.remaining, row.unit),
            item: row.item_title,
          })}
        </p>
        <p
          className={`text-xs font-medium ${
            complete ? "text-status-success" : "text-text-muted"
          }`}
        >
          {complete
            ? t("today.outcomes.itemComplete")
            : t("today.outcomes.itemRemaining", {
                quantity: formatQuantity(unattributed, row.unit),
              })}
        </p>
      </div>
      <p className="mt-0.5 text-[11px] text-text-muted">
        {t("today.outcomes.itemContext", {
          prepared: formatQuantity(row.prepared, row.unit),
          sold: formatQuantity(row.sold, row.unit),
        })}
        {row.prepared_basis === "PLANNED"
          ? ` · ${t("today.outcomes.presumedFromPlan")}`
          : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {OUTCOME_STATES.map((state) => {
          const isActive = (draft[state] ?? 0) > 0;
          return (
            <button
              key={state}
              type="button"
              disabled={isSaving}
              onClick={() => toggleState(state)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60 ${
                isActive
                  ? state === "DISCARDED"
                    ? "border-status-critical bg-status-critical/10 text-status-critical"
                    : "border-brand-gold bg-brand-gold/10 text-brand-gold"
                  : "border-surface-4 bg-surface-3 text-text-muted hover:border-brand-gold/30 hover:bg-brand-gold/5"
              }`}
            >
              {t(`today.outcomes.state.${state}`)}
            </button>
          );
        })}
      </div>

      {OUTCOME_STATES.filter((state) => (draft[state] ?? 0) > 0).map((state) => (
        <div key={state} className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <span className="w-28 text-xs text-text-secondary">
            {t(`today.outcomes.state.${state}`)}
          </span>
          <input
            type="number"
            min="0"
            step={isDiscreteUnit(row.unit) ? 1 : 0.01}
            value={draft[state] ?? 0}
            onChange={(event) => setQuantity(state, event.target.value)}
            onBlur={() => commit(draft)}
            className="h-8 w-20 rounded-lg border border-surface-4 bg-surface-3 px-2 text-sm font-semibold text-text-primary focus:border-brand-gold focus:outline-none"
          />
          <span className="text-xs text-text-muted">{row.unit}</span>
          {state === "DISCARDED" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {DISCARD_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    const nextReason = discardReason === reason ? "" : reason;
                    setDiscardReason(nextReason);
                    commit(draft, nextReason);
                  }}
                  className={`inline-flex h-6 items-center rounded-full border px-2 text-[10px] font-semibold ${
                    discardReason === reason
                      ? "border-status-critical/60 bg-status-critical/10 text-status-critical"
                      : "border-surface-4 text-text-muted hover:bg-surface-3"
                  }`}
                >
                  {t(`today.outcomes.discardReason.${reason}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </article>
  );
}
