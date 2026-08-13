"use client";

import { SparksSolid } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { MorningBrief } from "@/services/production-intelligence/types";

/**
 * The morning brief's fixed-height header row: renders instantly — a skeleton
 * while the brief loads, then a one-line greeting + button. The page never
 * jumps when the brief arrives.
 *
 * The full breakdown (narrative, watchouts, learnings, signals) lives in the
 * Today's Brief drawer (`todays-brief-drawer.tsx`), which also hosts the
 * spoken version of the same brief.
 */
export function MorningBriefStrip({
  loading,
  brief,
  userName,
  onOpenBrief,
}: {
  loading: boolean;
  brief: MorningBrief | null;
  userName: string;
  onOpenBrief: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 flex h-14 items-center justify-between gap-4 border-b border-surface-4/50 pb-4">
      {loading ? (
        <>
          <div className="h-4 w-72 max-w-[60%] animate-pulse rounded-full bg-surface-3" />
          <div className="h-8 w-36 animate-pulse rounded-lg bg-surface-3" />
        </>
      ) : brief ? (
        <>
          <p className="min-w-0 truncate text-sm text-text-secondary">
            {t("today.brief.greeting", { name: userName })}
          </p>
          {/*
            Neutral, not gold. The page's gold is now spent on the Today's Brief
            player, which is the more direct action and the only one present in
            every phase. Two gold elements in one row would make neither read as
            the primary one (DESIGN.md §2).
          */}
          <button
            type="button"
            onClick={onOpenBrief}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <SparksSolid className="h-3.5 w-3.5" />
            {t("today.brief.openBriefing")}
          </button>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          {t("today.brief.unavailable")}
        </p>
      )}
    </div>
  );
}