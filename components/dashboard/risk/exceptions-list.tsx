"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useMoney } from "@/lib/branch-currency";
import { SeverityBadge } from "@/components/dashboard/insights/insight-primitives";
import type { ExceptionItem } from "@/services/production-intelligence/types";

const RANK: Record<ExceptionItem["severity"], number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * The unified cross-domain Exceptions list — reorder/stockout/waste/supply
 * alerts, live dish+ingredient risk, nightly findings, tomorrow's staffing
 * gap and the manager's own standing watches, all in one ranked list.
 *
 * Deliberately reuses `SeverityBadge` (built for the Insights feed) rather
 * than inventing a second severity→color mapping — the previous ad hoc
 * mapping on this page only handled HIGH/MEDIUM and silently rendered LOW
 * (and would have rendered CRITICAL) the same green as "no issue," which is
 * exactly the kind of drift a single shared component prevents.
 */
export function ExceptionsList({
  items,
  limit,
}: {
  items: ExceptionItem[];
  limit?: number;
}) {
  const { t } = useTranslation();
  const { money } = useMoney();

  const sorted = useMemo(() => {
    const ranked = [...items].sort((a, b) => {
      const bySeverity = (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0);
      if (bySeverity !== 0) return bySeverity;
      const aCost = a.cost_amount != null ? Number(a.cost_amount) : 0;
      const bCost = b.cost_amount != null ? Number(b.cost_amount) : 0;
      return bCost - aCost;
    });
    return typeof limit === "number" ? ranked.slice(0, limit) : ranked;
  }, [items, limit]);

  if (!sorted.length) {
    return (
      <p className="text-sm text-text-muted">{t("workspace.risk.exceptionsEmpty")}</p>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-surface-4 bg-surface-2 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {item.category}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">{item.title}</p>
            {item.detail ? (
              <p className="mt-0.5 text-xs text-text-muted">{item.detail}</p>
            ) : null}
            {item.suggested_action ? (
              <p className="mt-1 text-xs font-medium text-text-secondary">
                {item.suggested_action}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <SeverityBadge severity={item.severity} />
            {item.cost_amount != null ? (
              <span className="text-xs font-medium text-text-muted">
                {money(Number(item.cost_amount))}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
