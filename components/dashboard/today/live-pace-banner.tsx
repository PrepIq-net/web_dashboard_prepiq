"use client";

import { useTranslation } from "@/lib/i18n";
import type { BranchPaceSummary } from "@/services/production-intelligence/types";

/**
 * Branch-level "pace vs plan" band for live service.
 *
 * Compares cumulative actuals against the expected intraday position from
 * the branch's own hour-of-day history: "By 1:30 PM you're at 78% of
 * today's plan — a typical Friday is at 62%." A single pace bar with a
 * hollow "typical" tick; deliberately not a curve — glanceable in a
 * kitchen.
 */

type LivePaceBannerProps = {
  pace: BranchPaceSummary | null | undefined;
};

function formatHour(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LivePaceBanner({ pace }: LivePaceBannerProps) {
  const { t } = useTranslation();
  const branch = pace?.branch ?? null;

  if (!pace) return null;

  if (!branch) {
    return (
      <p className="mb-6 text-xs text-text-muted">
        {t("today.pace.tooEarly")}
      </p>
    );
  }

  const actualPct = Math.round(
    (branch.sold_so_far / Math.max(branch.forecast_total, 0.001)) * 100,
  );
  const expectedPct = Math.round(branch.expected_fraction * 100);
  const gap = branch.projected_gap_units;
  const statusToken =
    branch.status === "ON_PACE"
      ? "text-brand-gold"
      : branch.status === "SURGE"
        ? branch.alert_level === "CRITICAL"
          ? "text-status-critical"
          : "text-status-warning"
        : "text-status-info";
  const fillToken =
    branch.status === "ON_PACE"
      ? "bg-brand-gold"
      : branch.status === "SURGE"
        ? branch.alert_level === "CRITICAL"
          ? "bg-status-critical"
          : "bg-status-warning"
        : "bg-status-info";

  return (
    <div className="mb-6 border-b border-surface-4/50 pb-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
        <p className="text-sm text-text-secondary">
          {t("today.pace.headline", {
            time: formatHour(pace.as_of),
            actualPct: `${actualPct}%`,
            expectedPct: `${expectedPct}%`,
          })}
        </p>
        <p className="text-xs text-text-muted">
          {t("today.pace.projectedClose", {
            projected: Math.round(branch.projected_total_at_close),
            planned: Math.round(branch.forecast_total),
            gap: `${gap >= 0 ? "+" : ""}${Math.round(gap)}`,
          })}{" "}
          <span className={`font-semibold ${statusToken}`}>
            {branch.status === "ON_PACE"
              ? t("today.pace.onPace")
              : branch.status === "SURGE"
                ? t("today.pace.surge")
                : t("today.pace.slowdown")}
          </span>
        </p>
      </div>

      <div className="relative mt-3 h-1.5 w-full rounded-full bg-surface-4">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ${fillToken}`}
          style={{ width: `${Math.min(actualPct, 100)}%` }}
        />
        {/* Hollow tick marking the typical position at this hour */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-text-muted bg-bg-base"
          style={{ left: `${Math.min(expectedPct, 100)}%` }}
          title={t("today.pace.typicalTick")}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-text-muted/70">
        <span>0%</span>
        <span>{t("today.pace.typicalTick")}: {expectedPct}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
