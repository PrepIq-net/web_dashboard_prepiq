"use client";

import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: {
    percentage: number;
    isPositive: boolean;
  };
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({
  label,
  value,
  change,
  icon,
  trend,
}: MetricCardProps) {
  return (
    <div className="rounded-card bg-surface-2 border border-border-default p-6 shadow-[var(--shadow-level-1)] transition-all duration-150 hover:bg-surface-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {label}
          </p>
          <p className="mt-3 font-display text-3xl font-semibold text-text-primary">
            {value}
          </p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3">
            <span className="text-brand-gold">{icon}</span>
          </div>
        )}
      </div>

      {change && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              change.isPositive
                ? "bg-status-success/10 text-status-success"
                : "bg-status-critical/10 text-status-critical"
            }`}
          >
            <span
              className={`inline-block ${
                change.isPositive
                  ? "text-status-success"
                  : "text-status-critical"
              }`}
            >
              {change.isPositive ? "▲" : "▼"}
            </span>
            {Math.abs(change.percentage)}%
          </span>
          <span className="text-xs text-text-muted">vs last period</span>
        </div>
      )}
    </div>
  );
}
