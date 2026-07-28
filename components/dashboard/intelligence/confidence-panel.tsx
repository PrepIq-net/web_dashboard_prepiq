"use client";

import { useTranslation } from "@/lib/i18n";
import type { IntelligenceJourney } from "@/services/production-intelligence/types";

/**
 * Confidence with its reasons attached, and the mix of evidence behind today's
 * numbers.
 *
 * `score` is nullable and unclamped. It used to be floored at 0.4, so a kitchen
 * with no data at all was told PrepIQ was 40% confident; and null is a real
 * answer meaning nothing measurable exists yet, not a loading state.
 */

function MixBar({
  branchPct,
  similarPct,
  industryPct,
}: {
  branchPct: number;
  similarPct: number;
  industryPct: number;
}) {
  const segments = [
    { pct: branchPct, className: "bg-text-primary" },
    { pct: similarPct, className: "bg-text-muted" },
    { pct: industryPct, className: "bg-surface-4" },
  ];
  return (
    <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
      {segments.map((segment, index) =>
        segment.pct > 0 ? (
          <div
            key={index}
            className={segment.className}
            style={{ width: `${Math.max(0, Math.min(100, segment.pct))}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function ConfidencePanel({
  confidence,
  blendMix,
}: {
  confidence: IntelligenceJourney["confidence"];
  blendMix: IntelligenceJourney["blend_mix"];
}) {
  const { t } = useTranslation();

  const legend = [
    {
      key: "branch",
      pct: blendMix.branch_pct,
      dot: "bg-text-primary",
      label: t("intelligence.mix.branch"),
    },
    {
      key: "similar",
      pct: blendMix.similar_kitchens_pct,
      dot: "bg-text-muted",
      label: t("intelligence.mix.similar"),
    },
    {
      key: "industry",
      pct: blendMix.industry_pct,
      dot: "bg-surface-4",
      label: t("intelligence.mix.industry"),
    },
  ];

  return (
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("intelligence.confidenceTitle")}
        </h4>
        <div className="mt-2 flex items-baseline gap-3">
          {confidence.pct === null ? (
            <p className="font-display text-2xl font-semibold text-text-secondary">
              {t("intelligence.confidenceUnknown")}
            </p>
          ) : (
            <p className="font-display text-4xl font-semibold tabular-nums leading-none text-text-primary">
              {Math.round(confidence.pct)}
              <span className="text-xl">%</span>
            </p>
          )}
          <span className="text-xs uppercase tracking-[0.1em] text-text-muted">
            {t(`intelligence.basis.${confidence.basis}`)}
          </span>
        </div>

        {confidence.explanation ? (
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {confidence.explanation}
          </p>
        ) : null}

        {confidence.factors.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {confidence.factors.map((factor, index) => (
              <li key={index} className="text-xs leading-relaxed text-text-muted">
                {factor}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t("intelligence.mixTitle")}
        </h4>
        <MixBar
          branchPct={blendMix.branch_pct}
          similarPct={blendMix.similar_kitchens_pct}
          industryPct={blendMix.industry_pct}
        />
        <ul className="mt-3 space-y-1.5">
          {legend.map((row) => (
            <li key={row.key} className="flex items-center gap-2 text-xs">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${row.dot}`}
                aria-hidden
              />
              <span className="text-text-secondary">{row.label}</span>
              <span className="ml-auto font-display tabular-nums text-text-primary">
                {Math.round(row.pct)}%
              </span>
            </li>
          ))}
        </ul>
        {typeof blendMix.history_days === "number" ? (
          <p className="mt-3 text-xs text-text-muted">
            {t("intelligence.mixCaption", { days: blendMix.history_days })}
          </p>
        ) : null}
      </section>
    </div>
  );
}
