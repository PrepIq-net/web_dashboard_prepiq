"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "iconoir-react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { useCurrentUserProfile } from "@/services";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useProductionIntelligenceAccessScope,
} from "@/services/production-intelligence/hooks";
import { useSubscriptions } from "@/services/payment/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SeverityTone = "RED" | "AMBER" | "GREEN";

type PriorityRow = {
  id: string;
  rank: number;
  title: string;
  impactedBranch: string;
  financialImpact: number;
  rootCauseHint?: string;
  viewHref: string;
  sectionLabel: string;
  severity: SeverityTone;
  ctaLabel: string;
  isBillingRow?: boolean; // sentinel values — never show as raw dollar
};

const EMPTY_LIST: never[] = [];
const col = createColumnHelper<PriorityRow>();
const CORE_ROW_MODEL = getCoreRowModel();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function nz(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toSeverity(impact: number, highCount: number): SeverityTone {
  if (impact >= 5000 || highCount >= 3) return "RED";
  if (impact >= 500 || highCount >= 1) return "AMBER";
  return "GREEN";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CommandSection() {
  const { data: user } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);

  // Granular permission flags — each issue type is gated independently
  const canSeeFinancials = permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);
  const canSeeInventory = permissions.has(PERMISSIONS.VIEW_INVENTORY);
  const canSeeForecasts = permissions.has(PERMISSIONS.VIEW_FORECASTS);
  const canSeeProduction = permissions.has(PERMISSIONS.VIEW_PRODUCTION_REPORTS);
  const canSeeAnalytics = permissions.has(PERMISSIONS.VIEW_ANALYTICS);
  const canManageBilling = permissions.has(PERMISSIONS.MANAGE_BILLING);
  const canSeeIntegrations =
    permissions.has(PERMISSIONS.MANAGE_INTEGRATIONS) ||
    permissions.has(PERMISSIONS.VIEW_POS_DATA);
  const canSeeAllBranches =
    permissions.has(PERMISSIONS.VIEW_ALL_BRANCHES) ||
    permissions.has(PERMISSIONS.MANAGE_BRANCHES);

  // Data hooks
  const ctQuery = useExecutiveControlTower(undefined, Boolean(user?.organization_id));
  const marginQuery = useOwnerMarginProtectionReport(
    undefined,
    canSeeFinancials && Boolean(user?.organization_id),
  );
  const subscriptionsQuery = useSubscriptions();
  const accessScopeQuery = useProductionIntelligenceAccessScope();

  const alerts = ctQuery.data?.alerts ?? EMPTY_LIST;
  const branchGrid = ctQuery.data?.branch_grid ?? EMPTY_LIST;
  const marginBranches = marginQuery.data?.branches ?? EMPTY_LIST;

  // ── Branch scope ─────────────────────────────────────────────────────────────
  // Users without VIEW_ALL_BRANCHES only see issues for branches they're assigned to.
  const scopedBranchGrid = useMemo(() => {
    if (canSeeAllBranches) return branchGrid;
    const accessible = new Set(
      (accessScopeQuery.data?.accessible_branches ?? []).map((b) => b.id),
    );
    // Fall back to all branches if scope hasn't loaded yet to avoid flashing empty queue
    return accessible.size > 0
      ? branchGrid.filter((b) => accessible.has(b.branch_id))
      : branchGrid;
  }, [branchGrid, canSeeAllBranches, accessScopeQuery.data]);

  // ── Alert categorization by type ─────────────────────────────────────────────
  // Use alert.type directly rather than fuzzy text matching to avoid misses.
  const posLagAlerts = useMemo(
    () => alerts.filter((a) => a.type === "POS_SYNC_LAG"),
    [alerts],
  );
  const unmappedAlerts = useMemo(
    () => alerts.filter((a) => a.type === "UNMAPPED_SALES"),
    [alerts],
  );
  const velocityDropAlerts = useMemo(
    () => alerts.filter((a) => a.type === "SALES_VELOCITY_DROP"),
    [alerts],
  );
  const stockAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        const t = (a.type ?? "").toUpperCase();
        return (
          t.includes("STOCK") || t.includes("INVENTORY") || t === "SALES_VELOCITY_SURGE"
        );
      }),
    [alerts],
  );
  const supplierAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        const t = (a.type ?? "").toUpperCase();
        return (
          t.includes("SUPPLIER") ||
          t.includes("PURCHASE") ||
          t.includes("COST") ||
          t.includes("PRICE")
        );
      }),
    [alerts],
  );

  const highSeverityCount = alerts.filter((a) => a.severity === "HIGH").length;

  // Normalise subscription data regardless of API response shape
  const subscriptions = useMemo(() => {
    const raw = subscriptionsQuery.data;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : ((raw as any).results ?? []);
  }, [subscriptionsQuery.data]);

  // ── Row generators ───────────────────────────────────────────────────────────
  // Each issue type is computed independently, gated on the relevant permission.
  // $0 impact = "nothing detected" (filtered out at the end).

  // 1. Subscription / billing alerts — MANAGE_BILLING only
  const subscriptionRows = useMemo<PriorityRow[]>(() => {
    if (!canManageBilling) return [];

    return (subscriptions as any[]).flatMap((sub): PriorityRow[] => {
      const entity = sub.branch_name || sub.organization_name || "Organization";
      const daysUntil: number | null = sub.days_until_renewal ?? null;
      const isActive: boolean = sub.is_currently_active ?? true;
      const status: string = (sub.status ?? "").toLowerCase();

      if (!isActive || status === "expired" || status === "cancelled") {
        return [
          {
            id: `sub-lapsed-${sub.id}`,
            rank: 0,
            title: `Subscription lapsed — ${entity}`,
            impactedBranch: entity,
            financialImpact: 9999,
            rootCauseHint: `Status: ${sub.status}. Some features may already be restricted.`,
            viewHref: "/workspace/settings?tab=organization",
            sectionLabel: "Subscription",
            severity: "RED",
            ctaLabel: "Renew subscription",
            isBillingRow: true,
          },
        ];
      }

      if (status === "past_due") {
        return [
          {
            id: `sub-pastdue-${sub.id}`,
            rank: 0,
            title: `Payment overdue — ${entity}`,
            impactedBranch: entity,
            financialImpact: 8000,
            rootCauseHint: "Service continuity is at risk. Update payment details immediately.",
            viewHref: "/workspace/settings?tab=organization",
            sectionLabel: "Subscription",
            severity: "RED",
            ctaLabel: "Update payment",
            isBillingRow: true,
          },
        ];
      }

      if (daysUntil !== null && daysUntil <= 7 && isActive) {
        return [
          {
            id: `sub-renew7-${sub.id}`,
            rank: 0,
            title: `Subscription renews in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${entity}`,
            impactedBranch: entity,
            financialImpact: 2000,
            rootCauseHint: sub.auto_renew
              ? "Auto-renew is ON — confirm your payment method is still valid."
              : "Auto-renew is OFF — manual renewal required before this date.",
            viewHref: "/workspace/settings?tab=organization",
            sectionLabel: "Subscription",
            severity: "AMBER",
            ctaLabel: "Review subscription",
            isBillingRow: true,
          },
        ];
      }

      if (daysUntil !== null && daysUntil <= 14 && isActive) {
        return [
          {
            id: `sub-renew14-${sub.id}`,
            rank: 0,
            title: `Subscription renews in ${daysUntil} days — ${entity}`,
            impactedBranch: entity,
            financialImpact: 500,
            rootCauseHint: sub.auto_renew
              ? "Auto-renew is ON."
              : "Auto-renew is OFF — action needed.",
            viewHref: "/workspace/settings?tab=organization",
            sectionLabel: "Subscription",
            severity: "AMBER",
            ctaLabel: "Review subscription",
            isBillingRow: true,
          },
        ];
      }

      return [];
    });
  }, [subscriptions, canManageBilling]);

  // 2. Waste spike — VIEW_PRODUCTION_REPORTS
  const wasteSpikeRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeProduction) return null;
    const top = [...scopedBranchGrid]
      .filter((b) => Number(b.waste_pct ?? 0) >= 4)
      .sort((a, b) => Number(b.waste_pct ?? 0) - Number(a.waste_pct ?? 0))[0];
    if (!top) return null;
    const pct = Number(top.waste_pct ?? 0);
    return {
      id: `waste-${top.branch_id}`,
      rank: 0,
      title: `Waste trending at ${pct.toFixed(1)}% — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(pct * 280),
      rootCauseHint:
        pct >= 7
          ? "Above 7% threshold — active financial loss right now."
          : "Approaching the 7% threshold — act before service closes.",
      viewHref: `/workspace/sales-waste?branch=${top.branch_id}`,
      sectionLabel: "Waste Spike",
      severity: pct >= 7 ? "RED" : "AMBER",
      ctaLabel: "Review waste items",
    };
  }, [scopedBranchGrid, canSeeProduction]);

  // 3. Profit leakage — VIEW_FINANCIAL_DATA
  const profitLeakageRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeFinancials) return null;
    const top = [...marginBranches]
      .filter((b) => Number(b.total_waste_cost ?? "0") > 0)
      .sort(
        (a, b) =>
          Number(b.total_waste_cost ?? "0") - Number(a.total_waste_cost ?? "0"),
      )[0];
    if (!top) return null;
    const cost = Number(top.total_waste_cost ?? "0");
    return {
      id: `profit-${top.branch_id}`,
      rank: 0,
      title: `${fmt(cost)} in waste cost this period — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(cost * 4),
      rootCauseHint:
        "Recurring waste concentration — likely a prep quantity or menu mix issue.",
      viewHref: `/workspace/financial?branch=${top.branch_id}`,
      sectionLabel: "Profit Leakage",
      severity: toSeverity(nz(cost * 4), highSeverityCount),
      ctaLabel: "View margin report",
    };
  }, [marginBranches, canSeeFinancials, highSeverityCount]);

  // 4. Margin erosion — VIEW_FINANCIAL_DATA
  const marginErosionRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeFinancials) return null;
    const top = [...marginBranches]
      .filter((b) => Number(b.margin_deviation_pct ?? 0) < -1)
      .sort(
        (a, b) =>
          Number(a.margin_deviation_pct ?? 0) - Number(b.margin_deviation_pct ?? 0),
      )[0];
    if (!top) return null;
    const pct = Math.abs(Number(top.margin_deviation_pct ?? 0));
    const cost = Number(top.total_waste_cost ?? "0");
    return {
      id: `margin-${top.branch_id}`,
      rank: 0,
      title: `Margin down ${pct.toFixed(1)}% vs target — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(cost * 0.2),
      rootCauseHint: "Likely tied to waste concentration or menu mix variance.",
      viewHref: `/workspace/financial?branch=${top.branch_id}`,
      sectionLabel: "Margin Erosion",
      severity: toSeverity(nz(cost * 0.2), 0),
      ctaLabel: "View margin report",
    };
  }, [marginBranches, canSeeFinancials]);

  // 5. Cost / purchasing spike — VIEW_FINANCIAL_DATA
  const costSpikeRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeFinancials || supplierAlerts.length === 0) return null;
    const top = supplierAlerts[0];
    return {
      id: `cost-${top.id}`,
      rank: 0,
      title: top.title || "Supplier cost spike detected",
      impactedBranch: top.branch_name,
      financialImpact: nz(supplierAlerts.length * 650),
      rootCauseHint: top.context || "Supplier-side price movement detected.",
      viewHref: "/workspace/purchasing",
      sectionLabel: "Cost Spike",
      severity: toSeverity(nz(supplierAlerts.length * 650), 0),
      ctaLabel: "Review purchases",
    };
  }, [supplierAlerts, canSeeFinancials]);

  // 6. POS sync lag — MANAGE_INTEGRATIONS | VIEW_POS_DATA
  const posLagRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeIntegrations || posLagAlerts.length === 0) return null;
    const top = posLagAlerts[0];
    return {
      id: `pos-lag-${top.id}`,
      rank: 0,
      title: `POS sync delayed — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(posLagAlerts.length * 800),
      rootCauseHint:
        top.context || "Data used for today's decisions may be incomplete.",
      viewHref: `/workspace/settings?tab=integrations&branch=${top.branch_id}`,
      sectionLabel: "POS Sync Lag",
      severity: "AMBER",
      ctaLabel: "Fix POS sync",
    };
  }, [posLagAlerts, canSeeIntegrations]);

  // 7. Unmapped sales items — VIEW_ANALYTICS
  const unmappedRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeAnalytics || unmappedAlerts.length === 0) return null;
    const top = unmappedAlerts[0];
    return {
      id: `unmapped-${top.id}`,
      rank: 0,
      title: `${unmappedAlerts.length} item${unmappedAlerts.length > 1 ? "s" : ""} selling without a recipe match`,
      impactedBranch: top.branch_name,
      financialImpact: nz(unmappedAlerts.length * 150),
      rootCauseHint:
        "Unmapped items don't feed the forecast — prep accuracy degrades silently over time.",
      viewHref: `/workspace/sales-waste?branch=${top.branch_id}`,
      sectionLabel: "Unmapped Sales",
      severity: "AMBER",
      ctaLabel: "Map missing items",
    };
  }, [unmappedAlerts, canSeeAnalytics]);

  // 8. Low forecast confidence — VIEW_FORECASTS
  const lowConfidenceRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeForecasts) return null;
    const top = [...scopedBranchGrid]
      .filter(
        (b) =>
          b.forecast_confidence !== null &&
          b.forecast_confidence !== undefined &&
          Number(b.forecast_confidence) < 0.65,
      )
      .sort(
        (a, b) =>
          Number(a.forecast_confidence ?? 1) - Number(b.forecast_confidence ?? 1),
      )[0];
    if (!top) return null;
    const conf = Number(top.forecast_confidence ?? 0);
    return {
      id: `confidence-${top.branch_id}`,
      rank: 0,
      title: `Forecast confidence at ${(conf * 100).toFixed(0)}% — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz((1 - conf) * 1200),
      rootCauseHint:
        conf < 0.5
          ? "Below 50% — prep recommendations are unreliable. Data quality check needed."
          : "Below 65% — watch for overprep or underprep this shift.",
      viewHref: `/workspace/today?branch_id=${top.branch_id}`,
      sectionLabel: "Low Forecast Confidence",
      severity: conf < 0.5 ? "RED" : "AMBER",
      ctaLabel: "Review prep plan",
    };
  }, [scopedBranchGrid, canSeeForecasts]);

  // 9. Branch underperformance — VIEW_ANALYTICS
  const underperformanceRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeAnalytics) return null;
    const top = [...scopedBranchGrid]
      .map((b) => ({
        ...b,
        score:
          Number(b.revenue ?? 0) -
          Number(b.waste_pct ?? 0) * 900 -
          Number(b.surplus_pct ?? 0) * 400,
      }))
      .filter((b) => b.score < 0)
      .sort((a, b) => a.score - b.score)[0];
    if (!top) return null;
    return {
      id: `under-${top.branch_id}`,
      rank: 0,
      title: `Underperforming vs org average — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(Number(top.waste_pct ?? 0) * 420),
      rootCauseHint: "Waste and surplus pressure dragging this branch below the org baseline.",
      viewHref: `/workspace/branches?branch=${top.branch_id}`,
      sectionLabel: "Branch Underperformance",
      severity: toSeverity(nz(Number(top.waste_pct ?? 0) * 420), 0),
      ctaLabel: "Review branch",
    };
  }, [scopedBranchGrid, canSeeAnalytics]);

  // 10. Forecast deviation — VIEW_FORECASTS
  const forecastDeviationRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeForecasts) return null;
    const top = [...scopedBranchGrid]
      .map((b) => {
        const prepared = Number(b.prepared ?? 0);
        const sold = Number(b.sold ?? 0);
        const miss = Math.abs(prepared - sold);
        return { ...b, miss, missPct: prepared > 0 ? (miss / prepared) * 100 : 0 };
      })
      .filter((b) => b.missPct >= 10)
      .sort((a, b) => b.missPct - a.missPct)[0];
    if (!top) return null;
    return {
      id: `forecast-${top.branch_id}`,
      rank: 0,
      title: `${top.missPct.toFixed(1)}% prep vs sales gap — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(top.miss * 35),
      rootCauseHint:
        "Prepared significantly more than sold — adjust tomorrow's quantities.",
      viewHref: `/workspace/today?branch_id=${top.branch_id}`,
      sectionLabel: "Forecast Deviation",
      severity: toSeverity(nz(top.miss * 35), 0),
      ctaLabel: "Adjust prep plan",
    };
  }, [scopedBranchGrid, canSeeForecasts]);

  // 11. Production misalignment (surplus) — VIEW_PRODUCTION_REPORTS
  const productionMisRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeProduction) return null;
    const top = [...scopedBranchGrid]
      .filter((b) => Number(b.surplus_pct ?? 0) >= 5)
      .sort((a, b) => Number(b.surplus_pct ?? 0) - Number(a.surplus_pct ?? 0))[0];
    if (!top) return null;
    const pct = Number(top.surplus_pct ?? 0);
    return {
      id: `prod-${top.branch_id}`,
      rank: 0,
      title: `${pct.toFixed(1)}% surplus in production — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(pct * 220),
      rootCauseHint: "Late-shift overproduction is reducing sell-through.",
      viewHref: `/workspace/today?branch_id=${top.branch_id}`,
      sectionLabel: "Production Misalignment",
      severity: toSeverity(nz(pct * 220), 0),
      ctaLabel: "Adjust quantities",
    };
  }, [scopedBranchGrid, canSeeProduction]);

  // 12. Low stock / velocity surge — VIEW_INVENTORY
  const lowStockRow = useMemo<PriorityRow | null>(() => {
    if (!canSeeInventory || stockAlerts.length === 0) return null;
    const top = stockAlerts[0];
    return {
      id: `stock-${top.id}`,
      rank: 0,
      title: top.title || `Low stock risk — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(stockAlerts.length * 240),
      rootCauseHint:
        top.context ||
        `${stockAlerts.length} stock alert${stockAlerts.length > 1 ? "s" : ""} detected.`,
      viewHref: `/workspace/inventory?branch=${top.branch_id}`,
      sectionLabel: "Low Stock Risk",
      severity: toSeverity(nz(stockAlerts.length * 240), 0),
      ctaLabel: "Check inventory",
    };
  }, [stockAlerts, canSeeInventory]);

  // 13. Sales velocity drop — VIEW_PRODUCTION_REPORTS | VIEW_ANALYTICS
  const velocityDropRow = useMemo<PriorityRow | null>(() => {
    if ((!canSeeProduction && !canSeeAnalytics) || velocityDropAlerts.length === 0)
      return null;
    const top = velocityDropAlerts[0];
    return {
      id: `velocity-${top.id}`,
      rank: 0,
      title: top.title || `Sales velocity dropping — ${top.branch_name}`,
      impactedBranch: top.branch_name,
      financialImpact: nz(velocityDropAlerts.length * 350),
      rootCauseHint:
        top.context || "Lower than expected sales rate during live service.",
      viewHref: `/workspace/today?branch_id=${top.branch_id}`,
      sectionLabel: "Sales Velocity Drop",
      severity: "AMBER",
      ctaLabel: "Review live sales",
    };
  }, [velocityDropAlerts, canSeeProduction, canSeeAnalytics]);

  // ── Assemble, filter, sort, rank ─────────────────────────────────────────────

  const priorityRows = useMemo<PriorityRow[]>(() => {
    const candidates: (PriorityRow | null)[] = [
      ...subscriptionRows,
      wasteSpikeRow,
      profitLeakageRow,
      costSpikeRow,
      marginErosionRow,
      posLagRow,
      unmappedRow,
      lowConfidenceRow,
      underperformanceRow,
      forecastDeviationRow,
      productionMisRow,
      lowStockRow,
      velocityDropRow,
    ];

    return candidates
      .filter((r): r is PriorityRow => r !== null && r.financialImpact > 0)
      .sort((a, b) => b.financialImpact - a.financialImpact)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }, [
    subscriptionRows,
    wasteSpikeRow,
    profitLeakageRow,
    costSpikeRow,
    marginErosionRow,
    posLagRow,
    unmappedRow,
    lowConfidenceRow,
    underperformanceRow,
    forecastDeviationRow,
    productionMisRow,
    lowStockRow,
    velocityDropRow,
  ]);

  // ── Table columns ────────────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      col.accessor("rank", {
        header: "#",
        cell: (info) => (
          <span className="text-xs font-bold tabular-nums text-text-muted">
            P{info.getValue()}
          </span>
        ),
      }),
      col.display({
        id: "issue",
        header: "Issue",
        cell: (info) => {
          const row = info.row.original;
          const dotColor =
            row.severity === "RED"
              ? "bg-status-critical"
              : row.severity === "AMBER"
                ? "bg-status-warning"
                : "bg-status-success";
          return (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                <p className="text-sm font-semibold text-text-primary leading-tight">
                  {row.title}
                </p>
              </div>
              <p className="text-xs text-text-muted pl-3.5">{row.sectionLabel}</p>
              {row.rootCauseHint && (
                <p className="text-[11px] text-text-muted/70 italic pl-3.5 leading-relaxed">
                  {row.rootCauseHint}
                </p>
              )}
            </div>
          );
        },
      }),
      col.accessor("financialImpact", {
        header: "Cost at risk",
        cell: (info) => {
          const row = info.row.original;
          const val = info.getValue();

          // Billing rows always show severity label, not a dollar estimate
          if (row.isBillingRow) {
            const isRed = row.severity === "RED";
            return (
              <div>
                <p
                  className={`text-sm font-bold ${isRed ? "text-status-critical" : "text-status-warning"}`}
                >
                  {isRed ? "Urgent" : "Action needed"}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wider">
                  subscription
                </p>
              </div>
            );
          }

          // Non-financial users see a severity badge instead of a dollar amount —
          // they don't have permission to see financial figures.
          if (!canSeeFinancials) {
            const cls =
              row.severity === "RED"
                ? "text-status-critical bg-status-critical/10 border-status-critical/20"
                : row.severity === "AMBER"
                  ? "text-status-warning bg-status-warning/10 border-status-warning/20"
                  : "text-status-success bg-status-success/10 border-status-success/20";
            const label =
              row.severity === "RED"
                ? "Critical"
                : row.severity === "AMBER"
                  ? "Warning"
                  : "Low";
            return (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}
              >
                {label}
              </span>
            );
          }

          const colorClass =
            val >= 1000
              ? "text-status-critical"
              : val >= 400
                ? "text-status-warning"
                : "text-text-primary";
          return (
            <div>
              <p className={`text-base font-bold tabular-nums ${colorClass}`}>
                {fmt(val)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wider">
                at risk today
              </p>
            </div>
          );
        },
      }),
      col.display({
        id: "cta",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          return (
            <Link
              href={row.viewHref}
              className="group inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/40 bg-surface-3 px-4 text-sm font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 active:scale-[0.98] whitespace-nowrap"
            >
              {row.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          );
        },
      }),
    ],
    [canSeeFinancials],
  );

  const table = useReactTable({
    data: priorityRows,
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            Priority Work Queue
          </p>
          <h2 className="mt-1 text-xl font-semibold text-text-primary">
            Decisions that affect margins today
          </h2>
          <p className="mt-1 text-sm text-text-muted max-w-xl">
            Not system errors — performance issues that need a manager&apos;s call.
            Ranked by financial impact.
          </p>
        </div>
        {priorityRows.length > 0 && (
          <span className="shrink-0 mt-1 text-xs font-medium text-text-muted bg-surface-3 border border-surface-4 rounded-full px-3 py-1">
            {priorityRows.length} open{" "}
            {priorityRows.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {priorityRows.length === 0 ? (
        <div className="rounded-xl border border-surface-4 bg-surface-2 px-8 py-12 text-center">
          <p className="text-sm font-medium text-text-primary">
            Nothing in the queue right now
          </p>
          <p className="text-xs text-text-muted mt-1">
            All performance metrics are within acceptable ranges.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-4 bg-surface-2 overflow-hidden">
          <div className="overflow-x-auto">
            <NativeTable
              table={table}
              tableClassName="w-full min-w-[820px]"
              headerClassName="bg-surface-3 border-b border-surface-4"
              bodyClassName="divide-y divide-surface-4"
              headerCellClassName={(header) =>
                `px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted ${
                  header.id === "rank"
                    ? "w-[60px]"
                    : header.id === "financialImpact"
                      ? "w-[160px]"
                      : header.id === "cta"
                        ? "w-[210px]"
                        : ""
                }`
              }
              bodyRowClassName={(row) => {
                const leftBorder =
                  row.original.severity === "RED"
                    ? "border-l-status-critical"
                    : row.original.severity === "AMBER"
                      ? "border-l-status-warning"
                      : "border-l-transparent";
                return `align-top transition-colors hover:bg-surface-3/40 border-l-[3px] ${leftBorder}`;
              }}
              cellClassName="px-6 py-5"
            />
          </div>
        </div>
      )}
    </section>
  );
}
