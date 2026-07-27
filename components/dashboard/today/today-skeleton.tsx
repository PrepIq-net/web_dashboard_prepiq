"use client";

import { useTranslation } from "@/lib/i18n";

/**
 * Phase-shaped loading placeholders.
 *
 * The page used to show a bare status word while a new branch or date
 * loaded, so switching context during service looked like the day had gone
 * blank. These mirror the real layout of each phase, so the content settles
 * into the space the skeleton already reserved instead of jumping.
 */

function Block({ className = "" }: { className?: string }) {
  return <div className={`rounded-lg bg-surface-3/70 ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-4 bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Block className="h-9 w-9 shrink-0" />
          <Block className="h-3.5 w-2/3" />
        </div>
        <Block className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Block className="h-2.5 w-16" />
          <Block className="h-7 w-24" />
          <Block className="h-2.5 w-32" />
        </div>
        <Block className="h-9 w-24 shrink-0" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-surface-4/50 pt-3">
        <Block className="h-8 w-20 rounded-full" />
        <Block className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-surface-4/50 px-4 py-4 last:border-b-0">
      <Block className="h-9 w-9 shrink-0" />
      <Block className="h-3.5 flex-1" />
      <Block className="h-3.5 w-16 shrink-0" />
      <Block className="h-8 w-24 shrink-0 rounded-lg" />
      <Block className="h-7 w-28 shrink-0 rounded-full" />
    </div>
  );
}

export function TodaySkeleton({
  phase,
}: {
  phase: "MORNING" | "LIVE" | "CLOSED" | "UNKNOWN";
}) {
  const { t } = useTranslation();
  const label =
    phase === "LIVE"
      ? t("today.loading.service")
      : phase === "CLOSED"
        ? t("today.loading.closed")
        : t("today.loading.plan");

  return (
    <section className="mt-8 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-text-muted/50" />
        <div className="space-y-2">
          <Block className="h-2.5 w-24" />
          <Block className="h-6 w-52" />
        </div>
      </div>

      <span className="sr-only">{label}</span>

      {phase === "LIVE" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : phase === "CLOSED" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-surface-4 bg-surface-2 px-4 py-4"
              >
                <Block className="h-2.5 w-20" />
                <Block className="mt-2.5 h-6 w-16" />
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <RowSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <RowSkeleton key={index} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Slim top-edge bar for background refetches, when stale data is on screen. */
export function RefreshingBar({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={`sticky top-0 z-30 -mt-2 mb-2 transition-opacity duration-200 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!active}
    >
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full w-1/3 animate-[today-indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-brand-gold/70" />
      </div>
      <span className="sr-only">{active ? t("common.loading") : ""}</span>
    </div>
  );
}
