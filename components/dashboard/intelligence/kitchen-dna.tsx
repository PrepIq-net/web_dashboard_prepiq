"use client";

import { useTranslation } from "@/lib/i18n";
import type { IntelligenceJourney } from "@/services/production-intelligence/types";

/**
 * Six measurements of how this kitchen behaves.
 *
 * There is no aggregate "DNA score", and that is a decision rather than an
 * omission: averaging six partly-null numbers produces exactly the
 * plausible-looking figure this whole feature exists to avoid. A score is null
 * unless it was genuinely measured, and a null renders as its requirement —
 * never as a zero, never as a grey bar at some arbitrary width.
 */

type DnaEntry = IntelligenceJourney["kitchen_dna"][number];

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score * 100));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full bg-text-secondary"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function KitchenDNA({ entries }: { entries: DnaEntry[] }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => {
        const measured = entry.status === "MEASURED" && entry.score !== null;
        return (
          <div key={entry.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-text-secondary">{entry.label}</p>
              {measured ? (
                <p className="font-display text-lg font-semibold tabular-nums text-text-primary">
                  {Math.round((entry.score as number) * 100)}
                </p>
              ) : (
                <p className="text-[11px] uppercase tracking-[0.1em] text-text-muted">
                  {entry.status === "NOT_AVAILABLE"
                    ? t("intelligence.dna.notAvailable")
                    : t("intelligence.dna.learning")}
                </p>
              )}
            </div>

            {measured ? <ScoreBar score={entry.score as number} /> : null}

            <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
              {measured ? entry.detail : entry.requirement || entry.detail}
            </p>

            {measured && entry.sample_size > 0 ? (
              <p className="mt-0.5 text-[11px] text-text-muted">
                {t("intelligence.dna.sample", { count: entry.sample_size })}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
