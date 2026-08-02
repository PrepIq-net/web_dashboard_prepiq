"use client";

import { useTranslation } from "@/lib/i18n";
import type { IntelligenceJourney } from "@/services/production-intelligence/types";

/**
 * Every point of the progress number, attributed.
 *
 * The headline percentage is a weighted sum of nine milestones rather than
 * `stage / 3`, which is why it moves on an ordinary Tuesday. Showing the ledger
 * is the difference between a progress bar the kitchen trusts and one it
 * assumes is decorative.
 */
export function ProgressLedger({
  progress,
}: {
  progress: IntelligenceJourney["progress"];
}) {
  const { t } = useTranslation();

  const rows = [...progress.milestones].sort((a, b) => {
    // Incomplete first, heaviest first — the ones worth acting on lead.
    const aDone = a.pct >= 100 ? 1 : 0;
    const bDone = b.pct >= 100 ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.weight - a.weight;
  });

  return (
    <div>
      <div className="flex items-end gap-4">
        <p className="font-display text-5xl font-semibold tabular-nums leading-none text-brand-gold">
          {Math.round(progress.pct)}
          <span className="text-2xl">%</span>
        </p>
        <p className="pb-1 text-sm text-text-secondary">
          {t("intelligence.progressCaption")}
        </p>
      </div>

      <ul className="mt-6 divide-y divide-border-default">
        {rows.map((milestone) => {
          const complete = milestone.pct >= 100;
          const contribution = milestone.weight * 100;
          return (
            <li key={milestone.key} className="py-3">
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className={`text-sm ${complete ? "text-text-muted" : "text-text-primary"}`}
                >
                  {milestone.label}
                </span>
                <span className="shrink-0 font-display text-xs tabular-nums text-text-muted">
                  {Math.round(milestone.actual)} / {Math.round(milestone.target)}
                  <span className="ml-2 text-text-disabled">
                    {contribution.toFixed(1)}
                    {t("intelligence.pointsSuffix")}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full ${complete ? "bg-status-success" : "bg-text-muted"}`}
                  style={{ width: `${Math.min(100, milestone.pct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
