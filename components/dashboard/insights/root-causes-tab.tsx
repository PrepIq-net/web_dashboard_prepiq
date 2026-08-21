"use client";

import { ArrowDown, ArrowUp } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { RootCause, RootCauses } from "@/services/insights/types";
import { EmptyState } from "./insight-primitives";

export function RootCausesTab({ data }: { data: RootCauses }) {
  const { t } = useTranslation();
  const groups = Object.entries(data.outcomes);

  if (!data.available || groups.length === 0) {
    return (
      <EmptyState
        title={t("workspace.insights.rootCauses.empty")}
        reason={
          data.never_run
            ? t("workspace.insights.freshness.neverRun")
            : // The server's own words. It knows why it has nothing — whether
              // no driver reached significance or the detectors have not run —
              // and inventing a plausible cause here is the one failure this
              // tab cannot survive.
              data.reason || t("workspace.insights.rootCauses.emptyReason")
        }
      />
    );
  }

  return (
    <div className="space-y-12">
      <p className="text-[13px] text-text-muted">
        {t("workspace.insights.rootCauses.window", { days: data.window_days })}
      </p>

      {groups.map(([outcome, links]) => (
        <section key={outcome}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t(`workspace.insights.outcome.${outcome.toLowerCase()}`)}
          </p>
          <div className="mt-5 space-y-6">
            {links.map((link) => (
              <DriverRow key={link.id} link={link} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * A single-value ring, not a part-to-whole donut: every card carries exactly
 * one number, so there is no second slice to compare angles against and the
 * usual donut objection (angle judgments are worse than length judgments
 * across several slices) doesn't apply here. The number stays the primary
 * carrier of the story — large and centered — the ring is reinforcement, not
 * something the reader has to decode on its own.
 */
function RadialMeter({ value, size = 64, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      role="presentation"
    >
      {/* Track — a lighter, recessive step so the fill reads against it without a border. */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-surface-4"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="stroke-brand-gold transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

function DriverRow({ link }: { link: RootCause }) {
  const { t } = useTranslation();
  const weightPct = link.weight !== null ? Math.round(link.weight * 100) : null;

  // A correlation's sign is the whole story — "rain drives waste up" and "rain
  // drives waste down" are opposite operational instructions. Neutral ink, not
  // a good/bad color: whether "up" is good depends on the outcome (up is good
  // for revenue, bad for waste), which this card doesn't resolve — status
  // colors are reserved for a claim this data doesn't make.
  const isIncrease = link.correlation !== null && link.correlation > 0;
  const direction =
    link.correlation === null
      ? null
      : isIncrease
        ? t("workspace.insights.rootCauses.increases")
        : t("workspace.insights.rootCauses.decreases");
  const DirectionIcon = isIncrease ? ArrowUp : ArrowDown;

  return (
    <div className="flex gap-4 border-b border-surface-4/60 pb-6 last:border-0 last:pb-0">
      {weightPct !== null ? (
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <RadialMeter value={weightPct} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-[15px] font-semibold text-text-primary">
              {weightPct}%
            </span>
          </div>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[15px] font-semibold text-text-primary">{link.driver_label}</p>
          {direction ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-text-secondary">
              <DirectionIcon className="h-3 w-3" />
              {direction}
              {link.correlation !== null ? ` · r ${link.correlation.toFixed(2)}` : ""}
            </span>
          ) : null}
        </div>
        {weightPct !== null ? (
          <p className="mt-0.5 text-[11px] text-text-muted">
            {t("workspace.insights.rootCauses.share", { percent: weightPct })}
          </p>
        ) : null}

        {link.plain_language ? (
          <p className="mt-2 max-w-3xl text-[14px] leading-[24px] text-text-secondary">
            {link.plain_language}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
          {/* Sample count and p-value ship with every driver so a correlation
              from eleven days is not read with the weight of one from ninety. */}
          <span>
            {t("workspace.insights.rootCauses.samples", { count: link.sample_count })}
          </span>
          {link.p_value !== null ? <span>p {link.p_value.toFixed(3)}</span> : null}
        </div>
      </div>
    </div>
  );
}
