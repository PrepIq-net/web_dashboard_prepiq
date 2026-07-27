"use client";

import type { ReactNode } from "react";

/**
 * Standard workspace section heading: gold eyebrow, display title, optional
 * supporting line, optional right-aligned actions. Spacing-led per
 * docs/DESIGN.md — no card chrome.
 */
export function SectionHeader({
  eyebrow,
  title,
  supporting,
  actions,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  supporting?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="font-display text-xl font-semibold text-text-primary sm:text-2xl">
          {title}
        </h3>
        {supporting ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
            {supporting}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
