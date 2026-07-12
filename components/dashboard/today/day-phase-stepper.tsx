"use client";

import { Check } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";

type DayStatus = "MORNING" | "LIVE" | "CLOSED" | null | undefined;

/**
 * Compact lifecycle indicator for the operational day:
 * Plan → Service → Review. Communicates where the branch is in its day and
 * what comes next, replacing the single ambiguous status dot.
 */
export function DayPhaseStepper({ status }: { status: DayStatus }) {
  const { t } = useTranslation();
  if (!status) return null;

  const phases = [
    { key: "MORNING", label: t("today.phase.plan") },
    { key: "LIVE", label: t("today.phase.service") },
    { key: "CLOSED", label: t("today.phase.review") },
  ] as const;
  const activeIndex = phases.findIndex((p) => p.key === status);
  if (activeIndex === -1) return null;

  return (
    <ol className="flex items-center gap-0" aria-label={t("today.phase.aria")}>
      {phases.map((phase, index) => {
        const isDone = index < activeIndex;
        const isActive = index === activeIndex;
        return (
          <li key={phase.key} className="flex items-center">
            {index > 0 ? (
              <span
                aria-hidden
                className={`mx-2 h-px w-5 ${isDone || isActive ? "bg-brand-gold/50" : "bg-surface-4"}`}
              />
            ) : null}
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                isActive
                  ? "text-brand-gold"
                  : isDone
                    ? "text-text-secondary"
                    : "text-text-muted/50"
              }`}
            >
              {isDone ? (
                <Check className="h-3 w-3 text-status-success" aria-hidden />
              ) : (
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive
                      ? status === "LIVE"
                        ? "bg-status-success animate-pulse"
                        : "bg-brand-gold"
                      : "bg-surface-4"
                  }`}
                />
              )}
              {phase.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
