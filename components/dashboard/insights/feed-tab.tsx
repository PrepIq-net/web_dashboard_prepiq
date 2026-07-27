"use client";

import { useTranslation } from "@/lib/i18n";
import type { InsightFeed, InsightStatus } from "@/services/insights/types";
import { InsightCard } from "./insight-card";
import { EmptyState } from "./insight-primitives";

/** The status filters a manager actually wants: what's live, and what they waved away. */
export const FEED_FILTERS = ["ACTIVE", "IMPLEMENTED", "DISMISSED"] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export function FeedTab({
  data,
  filter,
  onFilterChange,
  canManage,
  pendingId,
  onStatusChange,
}: {
  data: InsightFeed;
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  canManage: boolean;
  pendingId: string | null;
  onStatusChange: (insightId: string, status: InsightStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {FEED_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onFilterChange(option)}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-[12px] font-medium transition-colors ${
              filter === option
                ? "border-brand-gold/40 bg-brand-gold/10 text-brand-gold"
                : "border-surface-4 text-text-muted hover:bg-surface-3 hover:text-text-secondary"
            }`}
          >
            {t(`workspace.insights.filters.${option.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {data.results.length === 0 ? (
        <EmptyState
          title={t(`workspace.insights.feed.empty.${filter.toLowerCase()}`)}
          reason={
            data.never_run
              ? t("workspace.insights.freshness.neverRun")
              : t(`workspace.insights.feed.emptyReason.${filter.toLowerCase()}`)
          }
        />
      ) : (
        <div className="space-y-10">
          {data.results.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              canManage={canManage}
              pending={pendingId === insight.id}
              onStatusChange={(status) => onStatusChange(insight.id, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
