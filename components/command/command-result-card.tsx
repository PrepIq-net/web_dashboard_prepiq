"use client";

import Link from "next/link";
import { ArrowRight } from "iconoir-react";
import type { CommandCard, CommandCardTone } from "@/services/assistant/types";
import { useTranslation } from "@/lib/i18n";

// Same tone → text-color mapping as the Hub's reference cards
// (components/hub/hub-utils.ts) so the two card families read identically.
const TONE_CLASSES: Record<CommandCardTone, string> = {
  neutral: "text-text-secondary",
  ok: "text-status-success",
  warning: "text-status-warning",
  danger: "text-status-critical",
};

export function CommandResultCard({
  card,
  onNavigate,
}: {
  card: CommandCard;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border-default bg-surface-3 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{card.title}</p>
          {card.subtitle ? (
            <p className="mt-0.5 text-xs text-text-muted">{card.subtitle}</p>
          ) : null}
        </div>
        {card.deep_link ? (
          <Link
            href={card.deep_link}
            onClick={onNavigate}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface-4 px-2.5 py-1.5 text-[11px] font-medium text-brand-gold transition-colors hover:bg-surface-2"
          >
            {t("command.open")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>

      {card.stats.length ? (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          {card.stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="truncate text-[10px] uppercase tracking-wide text-text-disabled">
                {stat.label}
              </p>
              <p className={`truncate text-[13px] font-medium ${TONE_CLASSES[stat.tone] ?? "text-text-secondary"}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {card.rows.length ? (
        <div className="mt-3 space-y-1 border-t border-border-default pt-2.5">
          {card.rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs text-text-primary">{row.label}</span>
              <span className={`shrink-0 text-xs ${TONE_CLASSES[row.tone] ?? "text-text-secondary"}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {card.footnote ? (
        <p className="mt-2.5 text-[10px] text-text-disabled">{card.footnote}</p>
      ) : null}
    </div>
  );
}
