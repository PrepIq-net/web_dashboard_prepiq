"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import {
  useDemandPriors,
  useSaveDemandPriors,
} from "@/services/production-intelligence/hooks";
import type { DemandPriorRow } from "@/services/production-intelligence/types";

/**
 * Teach PrepIQ what the kitchen sells.
 *
 * This is the fastest path out of the cold start: a manager's estimate outranks
 * every statistical prior in `cold_start.py`, because they know their kitchen
 * and the cascade does not. The table deliberately shows the three numbers side
 * by side — measured, declared, and what PrepIQ would otherwise borrow — so
 * nobody mistakes a suggestion for an observation.
 *
 * Items with real sales history are not editable here at all. A declaration
 * cannot improve on a measurement, and offering the field would imply it could.
 */

type Draft = Record<string, string>;

function ItemRow({
  row,
  value,
  onChange,
}: {
  row: DemandPriorRow;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const measured = row.observed_daily_average !== null;

  return (
    <tr className="border-b border-border-default last:border-0">
      <td className="py-3 pr-4">
        <p className="text-sm text-text-primary">{row.title}</p>
        <p className="text-xs text-text-muted">{row.unit}</p>
      </td>

      <td className="py-3 pr-4 text-right">
        {measured ? (
          <>
            <span className="font-display text-sm tabular-nums text-text-primary">
              {row.observed_daily_average}
            </span>
            <p className="text-[11px] text-text-muted">
              {t("intelligence.teach.overDays", { days: row.observed_days })}
            </p>
          </>
        ) : (
          <span className="text-xs text-text-muted">
            {t("intelligence.teach.noHistory")}
          </span>
        )}
      </td>

      <td className="py-3 pr-4 text-right">
        {row.suggestion ? (
          <>
            <span className="font-display text-sm tabular-nums text-text-secondary">
              {row.suggestion.quantity}
            </span>
            <p className="text-[11px] text-text-muted">
              {row.suggestion.origin_label}
            </p>
          </>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </td>

      <td className="py-3 text-right">
        {measured ? (
          // Nothing to declare: we already know. Showing an input here would
          // imply an estimate could override measured demand, which it cannot.
          <span className="text-xs text-text-muted">
            {t("intelligence.teach.alreadyLearned")}
          </span>
        ) : (
          <input
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              row.suggestion ? String(Math.round(row.suggestion.quantity)) : "—"
            }
            aria-label={t("intelligence.teach.inputLabel", { item: row.title })}
            className="h-9 w-24 rounded-lg border border-surface-4 bg-surface-3 px-2 text-right text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
          />
        )}
      </td>
    </tr>
  );
}

export function TeachPanel({ branchId }: { branchId: string }) {
  const { t } = useTranslation();
  const priorsQuery = useDemandPriors({ branch_id: branchId });
  const saveMutation = useSaveDemandPriors();

  const [draft, setDraft] = useState<Draft>({});
  const [covers, setCovers] = useState<string>("");

  const rows = useMemo(() => priorsQuery.data?.items ?? [], [priorsQuery.data]);

  // Seed the form from the server once it arrives, and re-seed whenever the
  // branch changes — a stale draft from another kitchen would be written back
  // as though it were this one's.
  useEffect(() => {
    if (!priorsQuery.data) return;
    const next: Draft = {};
    for (const row of priorsQuery.data.items) {
      next[row.item_id] =
        row.declared_daily_quantity === null
          ? ""
          : String(row.declared_daily_quantity);
    }
    setDraft(next);
    setCovers(
      priorsQuery.data.expected_daily_covers === null ||
        priorsQuery.data.expected_daily_covers === undefined
        ? ""
        : String(priorsQuery.data.expected_daily_covers),
    );
  }, [priorsQuery.data]);

  const dirty = useMemo(() => {
    if (!priorsQuery.data) return false;
    const coversChanged =
      covers !==
      (priorsQuery.data.expected_daily_covers === null ||
      priorsQuery.data.expected_daily_covers === undefined
        ? ""
        : String(priorsQuery.data.expected_daily_covers));
    if (coversChanged) return true;
    return priorsQuery.data.items.some((row) => {
      const original =
        row.declared_daily_quantity === null
          ? ""
          : String(row.declared_daily_quantity);
      return (draft[row.item_id] ?? "") !== original;
    });
  }, [draft, covers, priorsQuery.data]);

  const handleSave = () => {
    const priors = rows
      .filter((row) => row.observed_daily_average === null)
      .map((row) => {
        const raw = (draft[row.item_id] ?? "").trim();
        return {
          item_id: row.item_id,
          // An empty field clears the declaration rather than declaring zero —
          // "we never said" and "this never sells" are different instructions.
          expected_daily_quantity: raw === "" ? null : Number(raw),
        };
      })
      .filter(
        (entry) =>
          entry.expected_daily_quantity === null ||
          Number.isFinite(entry.expected_daily_quantity),
      );

    saveMutation.mutate({
      branch_id: branchId,
      expected_daily_covers: covers.trim() === "" ? null : Number(covers),
      priors,
    });
  };

  const applySuggestions = () => {
    setDraft((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (row.observed_daily_average !== null) continue;
        if ((next[row.item_id] ?? "").trim() !== "") continue;
        if (!row.suggestion) continue;
        next[row.item_id] = String(Math.round(row.suggestion.quantity));
      }
      return next;
    });
  };

  if (priorsQuery.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-lg bg-surface-3"
          />
        ))}
      </div>
    );
  }

  if (priorsQuery.isError) {
    return (
      <p className="text-sm text-text-secondary">
        {t("intelligence.teach.loadError")}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {t("intelligence.teach.noMenu")}
      </p>
    );
  }

  const suggestionCount = rows.filter(
    (row) => row.observed_daily_average === null && row.suggestion,
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <label
            htmlFor="expected-daily-covers"
            className="block text-sm font-medium text-text-secondary"
          >
            {t("intelligence.teach.coversLabel")}
          </label>
          <input
            id="expected-daily-covers"
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            value={covers}
            onChange={(event) => setCovers(event.target.value)}
            className="mt-2 h-10 w-36 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus-visible:border-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold/30"
          />
          <p className="mt-1 max-w-xs text-xs text-text-muted">
            {t("intelligence.teach.coversHelp")}
          </p>
        </div>

        {suggestionCount > 0 ? (
          <button
            type="button"
            onClick={applySuggestions}
            className="h-10 rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors duration-150 hover:border-brand-gold/50 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
          >
            {t("intelligence.teach.useSuggestions", { count: suggestionCount })}
          </button>
        ) : null}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[540px] border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {t("intelligence.teach.colItem")}
              </th>
              <th className="pb-2 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {t("intelligence.teach.colMeasured")}
              </th>
              <th className="pb-2 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {t("intelligence.teach.colBorrowed")}
              </th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {t("intelligence.teach.colYours")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ItemRow
                key={row.item_id}
                row={row}
                value={draft[row.item_id] ?? ""}
                onChange={(next) =>
                  setDraft((current) => ({ ...current, [row.item_id]: next }))
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saveMutation.isPending}
          onClick={handleSave}
          className="h-10 rounded-lg bg-brand-gold px-4 text-sm font-semibold text-surface-1 transition-colors duration-150 hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
        >
          {saveMutation.isPending
            ? t("intelligence.teach.saving")
            : t("intelligence.teach.save")}
        </button>

        {saveMutation.isSuccess && !dirty ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <Check
              className="h-3.5 w-3.5 text-status-success"
              strokeWidth={1.5}
              aria-hidden
            />
            {t("intelligence.teach.saved")}
          </span>
        ) : null}

        {saveMutation.isError ? (
          <span className="text-xs text-text-primary">
            {t("intelligence.teach.saveError")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
