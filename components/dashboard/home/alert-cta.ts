import type { ExecutiveControlTowerSnapshot } from "@/services/production-intelligence/types";

export type BranchEntry = ExecutiveControlTowerSnapshot["branch_grid"][number];
export type AlertEntry = ExecutiveControlTowerSnapshot["alerts"][number];

/**
 * Alert action labels. Generic "View" tells the user nothing — these say
 * exactly what they'll do, and deep-link to the right page. Note the URL param
 * conventions differ: the today page reads ?branch_id=, all others ?branch=.
 *
 * Labels are i18n keys (dashboard.home.alertCta.*) — render with t(labelKey).
 */
const ALERT_CTA: Record<string, { labelKey: string; href: (branchId: string) => string }> = {
  WASTE_RISK: {
    labelKey: "dashboard.home.alertCta.wasteRisk",
    href: (id) => `/workspace/sales-waste?branch=${id}`,
  },
  POS_SYNC_LAG: {
    labelKey: "dashboard.home.alertCta.posSyncLag",
    href: (id) => `/workspace/settings?tab=integrations&branch=${id}`,
  },
  POS_NOT_CONNECTED: {
    labelKey: "dashboard.home.alertCta.posNotConnected",
    href: (id) => `/workspace/settings?tab=integrations&branch=${id}`,
  },
  SALES_VELOCITY_DROP: {
    labelKey: "dashboard.home.alertCta.velocityDrop",
    href: (id) => `/workspace/today?branch_id=${id}`,
  },
  SALES_VELOCITY_SURGE: {
    labelKey: "dashboard.home.alertCta.velocitySurge",
    href: (id) => `/workspace/inventory?branch=${id}`,
  },
  BRANCH_UNDERPERFORMING: {
    labelKey: "dashboard.home.alertCta.underperforming",
    href: (id) => `/workspace/branches?branch=${id}`,
  },
  UNMAPPED_SALES: {
    labelKey: "dashboard.home.alertCta.unmappedSales",
    href: (id) => `/workspace/sales-waste?branch=${id}`,
  },
};

export function alertCTA(alert: AlertEntry): { labelKey: string; href: string } {
  const def = ALERT_CTA[alert.type ?? ""];
  if (def) return { labelKey: def.labelKey, href: def.href(alert.branch_id) };
  return {
    labelKey: "dashboard.home.alertCta.fallback",
    href: `/workspace/today?branch_id=${alert.branch_id}`,
  };
}
