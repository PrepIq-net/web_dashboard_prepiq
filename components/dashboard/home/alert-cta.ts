import type { ExecutiveControlTowerSnapshot } from "@/services/production-intelligence/types";

export type BranchEntry = ExecutiveControlTowerSnapshot["branch_grid"][number];
export type AlertEntry = ExecutiveControlTowerSnapshot["alerts"][number];

/**
 * Alert action labels. Generic "View" tells the user nothing — these say
 * exactly what they'll do, and deep-link to the right page. Note the URL param
 * conventions differ: the today page reads ?branch_id=, all others ?branch=.
 */
const ALERT_CTA: Record<string, { label: string; href: (branchId: string) => string }> = {
  WASTE_RISK: {
    label: "See at-risk items",
    href: (id) => `/workspace/sales-waste?branch=${id}`,
  },
  POS_SYNC_LAG: {
    label: "Fix POS sync",
    href: (id) => `/workspace/settings?tab=integrations&branch=${id}`,
  },
  POS_NOT_CONNECTED: {
    label: "Connect POS",
    href: (id) => `/workspace/settings?tab=integrations&branch=${id}`,
  },
  SALES_VELOCITY_DROP: {
    label: "Review live sales",
    href: (id) => `/workspace/today?branch_id=${id}`,
  },
  SALES_VELOCITY_SURGE: {
    label: "Check stock levels",
    href: (id) => `/workspace/inventory?branch=${id}`,
  },
  BRANCH_UNDERPERFORMING: {
    label: "See branch breakdown",
    href: (id) => `/workspace/branches?branch=${id}`,
  },
  UNMAPPED_SALES: {
    label: "Map missing items",
    href: (id) => `/workspace/sales-waste?branch=${id}`,
  },
};

export function alertCTA(alert: AlertEntry): { label: string; href: string } {
  const def = ALERT_CTA[alert.type ?? ""];
  if (def) return { label: def.label, href: def.href(alert.branch_id) };
  return {
    label: "Review alert",
    href: `/workspace/today?branch_id=${alert.branch_id}`,
  };
}
