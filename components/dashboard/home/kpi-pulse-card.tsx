"use client";

import type { ReactNode } from "react";

function ExpandIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

/**
 * One dashboard pulse KPI: label, headline value, divider, footer context.
 * Clicking anywhere opens the matching detail modal.
 */
export function KpiPulseCard({
  label,
  value,
  valueClass = "text-text-primary",
  footer,
  onOpen,
  openAriaLabel,
  hoverBorderClass = "hover:border-brand-gold/30",
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
  footer: ReactNode;
  onOpen: () => void;
  openAriaLabel: string;
  hoverBorderClass?: string;
}) {
  return (
    <article
      className={`bg-surface-2 rounded-xl p-4 border border-surface-4 cursor-pointer transition-colors hover:bg-surface-3/40 group ${hoverBorderClass}`}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {label}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={openAriaLabel}
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary"
        >
          <ExpandIcon />
        </button>
      </div>
      <p
        className={`font-display text-2xl font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </p>
      <div className="mt-2.5 pt-2.5 border-t border-surface-4">{footer}</div>
    </article>
  );
}
