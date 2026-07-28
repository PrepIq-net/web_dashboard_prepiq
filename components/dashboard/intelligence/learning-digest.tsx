"use client";

import { ArrowUp, Sparks } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { IntelligenceJourney } from "@/services/production-intelligence/types";

/**
 * What PrepIQ learned this week.
 *
 * A week-over-week diff of two persisted profiles, which is what makes the
 * journey read as learning rather than as a status page. The important design
 * constraint is the empty case: a digest that always finds something to
 * celebrate is one the reader learns to skim, and then the weeks where a
 * capability genuinely turned on get skimmed with them. So a quiet week says
 * it was quiet and names what would change that.
 */

type Digest = NonNullable<IntelligenceJourney["learning_digest"]>;

export function LearningDigest({ digest }: { digest: Digest | null | undefined }) {
  const { t } = useTranslation();

  if (!digest) return null;

  const delta = digest.progress_delta;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm text-text-secondary">
          {digest.compared_to
            ? t("intelligence.digest.since", { date: digest.compared_to })
            : t("intelligence.digest.firstWeek")}
        </p>
        {delta !== null && delta !== 0 ? (
          <span className="inline-flex items-center gap-1 text-sm">
            <ArrowUp
              className={`h-3.5 w-3.5 ${delta > 0 ? "text-status-success" : "text-text-muted rotate-180"}`}
              strokeWidth={1.5}
              aria-hidden
            />
            <span className="font-display tabular-nums text-text-primary">
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}
            </span>
            <span className="text-text-muted">
              {t("intelligence.digest.points")}
            </span>
          </span>
        ) : null}
      </div>

      {digest.highlights.length > 0 ? (
        <ul className="mt-4 divide-y divide-border-default">
          {digest.highlights.map((highlight, index) => (
            <li key={index} className="flex gap-3 py-3">
              <Sparks
                className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
                strokeWidth={1.5}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm text-text-primary">{highlight.label}</p>
                {highlight.detail ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {highlight.detail}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          {digest.quiet_reason}
        </p>
      )}
    </div>
  );
}
