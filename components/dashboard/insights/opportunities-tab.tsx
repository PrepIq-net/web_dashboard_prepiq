"use client";

import { useTranslation } from "@/lib/i18n";
import type { InsightStatus, Opportunities } from "@/services/insights/types";
import { InsightCard } from "./insight-card";
import { EmptyState } from "./insight-primitives";

export function OpportunitiesTab({
  data,
  canManage,
  pendingId,
  onStatusChange,
}: {
  data: Opportunities;
  canManage: boolean;
  pendingId: string | null;
  onStatusChange: (insightId: string, status: InsightStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <div>
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
          {t("workspace.insights.opportunities.headerLabel")}
        </p>
        {/* The server's total, printed as the server formatted it. It is the sum
            of the rows below because both come from the same filtered set —
            re-rounding it here is how a header stops matching its breakdown. */}
        <p className="mt-2 font-display text-[44px] font-semibold leading-none tracking-[-0.5px] text-text-primary">
          {data.total_savings_display}
        </p>
        <p className="mt-2 text-[13px] text-text-muted">
          {t("workspace.insights.opportunities.headerDetail", {
            count: data.results.length,
          })}
        </p>
      </section>

      <section className="mt-10 border-t border-surface-4 pt-8">
        {data.results.length === 0 ? (
          <EmptyState
            title={t("workspace.insights.opportunities.empty")}
            reason={
              data.never_run
                ? t("workspace.insights.freshness.neverRun")
                : t("workspace.insights.opportunities.emptyReason")
            }
          />
        ) : (
          <div className="space-y-10">
            {data.results.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                showVectors
                canManage={canManage}
                pending={pendingId === insight.id}
                onStatusChange={(status) => onStatusChange(insight.id, status)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
