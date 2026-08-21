"use client";

import Link from "next/link";
import { ArrowRight } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { AnalystSnapshot } from "@/services/insights/types";
import { Metric, deltaTone, percent, signedPercent } from "./insight-primitives";

const RISK_TONE: Record<"Low" | "Medium" | "High", "positive" | "default" | "negative"> = {
  Low: "positive",
  Medium: "default",
  High: "negative",
};

/**
 * Core's taste of the Analyst: four read-only numbers and a nudge toward
 * Intelligence. No chat, no drill-down — see `insights.views.SnapshotView`
 * for why staffing coverage is the one live-computed figure here.
 */
export function AnalystSnapshotCard({ data }: { data: AnalystSnapshot }) {
  const { t } = useTranslation();
  const hasAnyData =
    data.revenue_change_pct !== null ||
    data.top_deviation !== null ||
    data.waste_risk !== null ||
    data.staffing_coverage_pct !== null;

  return (
    <div className="rounded-card border border-border-default bg-surface-2 p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
        {t("workspace.insights.snapshot.title")}
      </p>

      {hasAnyData ? (
        <div className="mt-6 grid grid-cols-2 gap-8 lg:grid-cols-4">
          <Metric
            label={t("workspace.insights.snapshot.revenue")}
            value={signedPercent(data.revenue_change_pct)}
            tone={deltaTone(data.revenue_change_pct, true)}
          />
          <Metric
            label={t("workspace.insights.snapshot.topDeviation")}
            value={data.top_deviation ? data.top_deviation.item : "—"}
            detail={
              data.top_deviation?.change_pct != null
                ? signedPercent(data.top_deviation.change_pct)
                : undefined
            }
          />
          <Metric
            label={t("workspace.insights.snapshot.wasteRisk")}
            value={
              data.waste_risk
                ? t(`workspace.insights.snapshot.risk${data.waste_risk}` as const)
                : "—"
            }
            tone={data.waste_risk ? RISK_TONE[data.waste_risk] : "default"}
          />
          <Metric
            label={t("workspace.insights.snapshot.staffingCoverage")}
            value={percent(data.staffing_coverage_pct)}
          />
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-[15px] text-text-secondary">
            {t("workspace.insights.snapshot.noData")}
          </p>
          <p className="mt-2 max-w-md text-[13px] leading-[22px] text-text-muted">
            {t("workspace.insights.snapshot.noDataReason")}
          </p>
        </div>
      )}

      <Link
        href="/workspace/billing/upgrade"
        className="mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-brand-gold hover:opacity-80"
      >
        {t("workspace.insights.snapshot.upgradeCta")}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
