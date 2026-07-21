"use client";

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

function DriverRow({ link }: { link: RootCause }) {
  const { t } = useTranslation();
  const weightPct = link.weight !== null ? Math.round(link.weight * 100) : null;

  // A correlation's sign is the whole story — "rain drives waste up" and "rain
  // drives waste down" are opposite operational instructions.
  const direction =
    link.correlation === null
      ? null
      : link.correlation > 0
        ? t("workspace.insights.rootCauses.increases")
        : t("workspace.insights.rootCauses.decreases");

  return (
    <div className="border-b border-surface-4/60 pb-6 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[15px] text-text-primary">{link.driver_label}</p>
        {weightPct !== null ? (
          <p className="font-display text-[16px] font-semibold text-text-primary">
            {t("workspace.insights.rootCauses.share", { percent: weightPct })}
          </p>
        ) : null}
      </div>

      {weightPct !== null ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
          <div
            className="h-full rounded-full bg-brand-gold"
            style={{ width: `${Math.max(0, Math.min(100, weightPct))}%` }}
          />
        </div>
      ) : null}

      {link.plain_language ? (
        <p className="mt-3 max-w-3xl text-[14px] leading-[24px] text-text-secondary">
          {link.plain_language}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
        {direction ? (
          <span>
            {direction}
            {link.correlation !== null
              ? ` · r ${link.correlation.toFixed(2)}`
              : ""}
          </span>
        ) : null}
        {/* Sample count and p-value ship with every driver so a correlation
            from eleven days is not read with the weight of one from ninety. */}
        <span>
          {t("workspace.insights.rootCauses.samples", { count: link.sample_count })}
        </span>
        {link.p_value !== null ? <span>p {link.p_value.toFixed(3)}</span> : null}
      </div>
    </div>
  );
}
