"use client";

import { ReactNode } from "react";

type KpiStatus = "gold" | "success" | "warning" | "critical" | "neutral";
type ProgressColor = "gold" | "success" | "warning" | "critical";

const dotClass: Record<KpiStatus, string> = {
  gold: "bg-brand-gold",
  success: "bg-status-success",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  neutral: "bg-text-muted",
};

const progressBarClass: Record<ProgressColor, string> = {
  gold: "bg-brand-gold",
  success: "bg-status-success",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  status?: KpiStatus;
  /** 0–100, renders a progress bar when provided */
  progress?: number;
  progressColor?: ProgressColor;
  /** Smaller value text — useful for long strings like branch names */
  compact?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  subtext,
  status,
  progress,
  progressColor = "gold",
  compact = false,
  className = "",
}: KpiCardProps) {
  return (
    <article
      className={`bg-surface-2 rounded-card p-4 border border-surface-4/50 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {label}
        </p>
        {status && (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${dotClass[status]}`}
            aria-hidden="true"
          />
        )}
      </div>

      <p
        className={`font-display font-semibold text-text-primary tracking-tight leading-none ${
          compact ? "text-xl" : "text-3xl"
        }`}
      >
        {value}
      </p>

      {subtext && (
        <div className="mt-2 text-sm text-text-secondary">{subtext}</div>
      )}

      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-surface-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarClass[progressColor]}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </article>
  );
}
