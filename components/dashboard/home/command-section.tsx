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
} from "@/services/production-intelligence/hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CommandCard = {
  id: string;
  title: string;
  impactedBranch: string;
  financialImpact: number;
  actionRecommendation: string;
  rootCauseHint?: string;
  viewHref: string;
};

type SeverityTone = "RED" | "AMBER" | "GREEN";
type PriorityRow = CommandCard & {
  sectionLabel: string;
  severity: SeverityTone;
  rank: number;
};

type CommandSection = {
  label: string;
  cards: CommandCard[];
};

const EMPTY_LIST: never[] = [];
const priorityColumnHelper = createColumnHelper<PriorityRow>();
const CORE_ROW_MODEL = getCoreRowModel();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function normalizeImpact(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function pickFirst(items: CommandCard[], fallback: CommandCard): CommandCard {
  return items.length ? items[0] : fallback;
}

function getSeverity(impact: number, highSeverityCount: number): SeverityTone {
  if (impact >= 1500 || highSeverityCount >= 3) return "RED";
  if (impact >= 500 || highSeverityCount >= 1) return "AMBER";
  return "GREEN";
}

// Returns a specific, scannable action label for each issue type.
// Avoids generic "View" — the label tells the user what they'll do, not where they'll go.
function ctaLabel(sectionLabel: string): string {
  const l = sectionLabel.toLowerCase();
  if (l.includes("waste")) return "Review waste items";
  if (l.includes("stock")) return "Check inventory";
  if (l.includes("forecast")) return "Adjust prep plan";
  if (l.includes("purchase") || l.includes("cost spike")) return "Review purchases";
  if (l.includes("production")) return "Adjust quantities";
  if (l.includes("margin") || l.includes("profit")) return "View margin report";
  if (l.includes("underperformance")) return "Review branch";
  if (l.includes("branch at risk")) return "Review branch";
  if (l.includes("systemic") || l.includes("risk")) return "View risk signals";
  return "Take action";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CommandSection() {
  const { data: user } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const isOwnerRole = permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);

  const controlTowerQuery = useExecutiveControlTower(
    undefined,
    Boolean(user?.organization_id),
  );
  const marginReportQuery = useOwnerMarginProtectionReport(
    undefined,
    Boolean(user?.organization_id),
  );

  const alerts = controlTowerQuery.data?.alerts ?? EMPTY_LIST;
  const branchGrid = controlTowerQuery.data?.branch_grid ?? EMPTY_LIST;
  const marginBranches = marginReportQuery.data?.branches ?? EMPTY_LIST;

  const wasteByBranch = useMemo(() => {
    return marginBranches
      .map((branch) => ({
        branchId: branch.branch_id,
        branchName: branch.branch_name,
        wasteCost: Number(branch.total_waste_cost ?? "0"),
        marginDeviationPct: Number(branch.margin_deviation_pct ?? 0),
      }))
      .sort((a, b) => b.wasteCost - a.wasteCost);
  }, [marginBranches]);

  const branchesByWastePct = useMemo(() => {
    return [...branchGrid].sort(
      (a, b) => Number(b.waste_pct ?? 0) - Number(a.waste_pct ?? 0),
    );
  }, [branchGrid]);

  const branchesByForecastMiss = useMemo(() => {
    return [...branchGrid]
      .map((branch) => {
        const prepared = Number(branch.prepared ?? 0);
        const sold = Number(branch.sold ?? 0);
        const miss = Math.abs(prepared - sold);
        return { ...branch, miss, missPct: prepared > 0 ? (miss / prepared) * 100 : 0 };
      })
      .sort((a, b) => b.miss - a.miss);
  }, [branchGrid]);

  const supplierLikeAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const content = `${alert.type ?? ""} ${alert.title ?? ""} ${alert.context ?? ""}`.toLowerCase();
      return content.includes("supplier") || content.includes("purchase") || content.includes("cost");
    });
  }, [alerts]);

  const stockRiskAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const content = `${alert.type ?? ""} ${alert.title ?? ""} ${alert.context ?? ""}`.toLowerCase();
      return content.includes("stock") || content.includes("inventory");
    });
  }, [alerts]);

  const highSeverityCount = alerts.filter((alert) => alert.severity === "HIGH").length;

  const operationalSections = useMemo<CommandSection[]>(() => {
    const wasteSpike = pickFirst(
      branchesByWastePct
        .filter((b) => Number(b.waste_pct ?? 0) >= 4)
        .map((branch): CommandCard => ({
          id: `ops-waste-${branch.branch_id}`,
          title: `Waste trending at ${Number(branch.waste_pct ?? 0).toFixed(1)}%`,
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 280),
          actionRecommendation: "Adjust prep quantities and redirect surplus before service closes.",
          viewHref: `/workspace/sales-waste?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-waste-fallback",
        title: "Waste levels",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "No unusual waste detected.",
        viewHref: "/workspace/sales-waste",
      },
    );

    const marginErosion = pickFirst(
      marginBranches
        .filter((branch) => Number(branch.margin_deviation_pct ?? 0) < -1)
        .map((branch) => ({
          id: `ops-margin-${branch.branch_id}`,
          title: `Margin down ${Math.abs(Number(branch.margin_deviation_pct ?? 0)).toFixed(1)}% vs target`,
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.total_waste_cost ?? "0") * 0.2),
          rootCauseHint: "Likely tied to waste concentration or menu mix variance.",
          actionRecommendation: "Investigate menu mix and purchasing variance.",
          viewHref: `/workspace/financial?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-margin-fallback",
        title: "Margin signals",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "Margins are stable today.",
        viewHref: "/workspace/financial",
      },
    );

    const lowStock = pickFirst(
      stockRiskAlerts.map((alert, index) => ({
        id: `ops-stock-${alert.id}`,
        title: alert.title || "Low stock risk detected",
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact((stockRiskAlerts.length - index) * 240),
        rootCauseHint: alert.context || undefined,
        actionRecommendation: "Trigger replenishment or reallocate between branches.",
        viewHref: `/workspace/inventory?branch=${alert.branch_id}`,
      })),
      {
        id: "ops-stock-fallback",
        title: "Stock levels",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "No low-stock alerts right now.",
        viewHref: "/workspace/inventory",
      },
    );

    const purchasingAnomaly = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `ops-purchase-${alert.id}`,
        title: alert.title || "Purchasing anomaly flagged",
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact((supplierLikeAlerts.length - index) * 260),
        rootCauseHint: alert.context || undefined,
        actionRecommendation: "Compare supplier invoices to contracted pricing.",
        viewHref: "/workspace/purchasing",
      })),
      {
        id: "ops-purchase-fallback",
        title: "Purchasing signals",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "No purchase anomalies right now.",
        viewHref: "/workspace/purchasing",
      },
    );

    const forecastDeviation = pickFirst(
      branchesByForecastMiss
        .filter((b) => b.missPct >= 10)
        .map((branch) => ({
          id: `ops-forecast-${branch.branch_id}`,
          title: `Prep vs sales gap at ${branch.missPct.toFixed(1)}%`,
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(branch.miss * 30),
          rootCauseHint: "Prepared significantly more than sold — adjust tomorrow's quantities.",
          actionRecommendation: "Recalibrate prep quantities for the next shift.",
          viewHref: `/workspace/today?branch_id=${branch.branch_id}`,
        })),
      {
        id: "ops-forecast-fallback",
        title: "Forecast alignment",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "Forecast deviations are within tolerance.",
        viewHref: "/workspace/today",
      },
    );

    const productionMisalignment = pickFirst(
      branchGrid
        .filter((branch) => Number(branch.surplus_pct ?? 0) >= 5)
        .map((branch) => ({
          id: `ops-prod-${branch.branch_id}`,
          title: `${Number(branch.surplus_pct ?? 0).toFixed(1)}% surplus in production`,
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.surplus_pct ?? 0) * 220),
          rootCauseHint: "Late-shift overproduction reducing sell-through.",
          actionRecommendation: "Tighten prep windows and reduce late-shift output.",
          viewHref: `/workspace/today?branch_id=${branch.branch_id}`,
        })),
      {
        id: "ops-prod-fallback",
        title: "Production alignment",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "Production is aligned with demand.",
        viewHref: "/workspace/today",
      },
    );

    return [
      { label: "Waste Spike", cards: [wasteSpike] },
      { label: "Margin Erosion", cards: [marginErosion] },
      { label: "Low Stock Risk", cards: [lowStock] },
      { label: "Purchasing Anomalies", cards: [purchasingAnomaly] },
      { label: "Forecast Deviation", cards: [forecastDeviation] },
      { label: "Production Misalignment", cards: [productionMisalignment] },
    ];
  }, [
    branchGrid,
    branchesByWastePct,
    branchesByForecastMiss,
    marginBranches,
    stockRiskAlerts,
    supplierLikeAlerts,
  ]);

  const executiveSections = useMemo<CommandSection[]>(() => {
    const profitLeakage = pickFirst(
      wasteByBranch
        .filter((b) => b.wasteCost > 0)
        .map((branch) => ({
          id: `exec-profit-${branch.branchId}`,
          title: `${toCurrency(branch.wasteCost)} in waste cost this period`,
          impactedBranch: branch.branchName,
          financialImpact: normalizeImpact(branch.wasteCost * 4),
          rootCauseHint: "Recurring waste concentration — likely a prep quantity or menu mix issue.",
          actionRecommendation: "Assign corrective ownership and review waste breakdown.",
          viewHref: `/workspace/financial?branch=${branch.branchId}`,
        })),
      {
        id: "exec-profit-fallback",
        title: "Profit leakage",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "No major leakage patterns detected.",
        viewHref: "/workspace/financial",
      },
    );

    const underperformance = pickFirst(
      branchGrid
        .map((branch) => ({
          ...branch,
          score:
            Number(branch.revenue ?? 0) -
            Number(branch.waste_pct ?? 0) * 900 -
            Number(branch.surplus_pct ?? 0) * 400,
        }))
        .filter((b) => b.score < 0)
        .sort((a, b) => a.score - b.score)
        .map((branch) => ({
          id: `exec-under-${branch.branch_id}`,
          title: "Branch underperforming vs org average",
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 420),
          rootCauseHint: "Waste and surplus pressure dragging this branch below the org baseline.",
          actionRecommendation: "Start branch recovery sprint — review waste + prep alignment.",
          viewHref: `/workspace/branches?branch=${branch.branch_id}`,
        })),
      {
        id: "exec-under-fallback",
        title: "Branch performance",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "No significant underperformance variance.",
        viewHref: "/workspace/branches",
      },
    );

    const costSpike = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `exec-cost-${alert.id}`,
        title: alert.title || "Supplier cost spike detected",
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact((supplierLikeAlerts.length - index) * 650),
        rootCauseHint: alert.context || "Supplier-side price movement detected.",
        actionRecommendation: "Renegotiate procurement terms or find alternative suppliers.",
        viewHref: "/workspace/purchasing",
      })),
      {
        id: "exec-cost-fallback",
        title: "Supplier costs",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "No active supplier spikes above threshold.",
        viewHref: "/workspace/purchasing",
      },
    );

    const forecastMiss = pickFirst(
      branchesByForecastMiss
        .filter((b) => b.missPct >= 10)
        .map((branch) => ({
          id: `exec-forecast-${branch.branch_id}`,
          title: `${branch.missPct.toFixed(1)}% forecast gap — prep vs actual sales`,
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(branch.miss * 45),
          rootCauseHint: "Indicates a forecasting model drift — may need recalibration.",
          actionRecommendation: "Tighten forecast governance and review input data freshness.",
          viewHref: `/workspace/today?branch_id=${branch.branch_id}`,
        })),
      {
        id: "exec-forecast-fallback",
        title: "Forecast accuracy",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: undefined,
        actionRecommendation: "Forecast stability is healthy.",
        viewHref: "/workspace/today",
      },
    );

    return [
      { label: "Profit Leakage", cards: [profitLeakage] },
      { label: "Branch Underperformance", cards: [underperformance] },
      { label: "Cost Spike", cards: [costSpike] },
      { label: "Forecast Deviation", cards: [forecastMiss] },
    ];
  }, [wasteByBranch, branchGrid, supplierLikeAlerts, branchesByForecastMiss]);

  const activeSections = isOwnerRole ? executiveSections : operationalSections;

  const allRows: PriorityRow[] = activeSections
    .flatMap((section) =>
      section.cards.map((card) => ({
        ...card,
        sectionLabel: section.label,
        severity: getSeverity(card.financialImpact, highSeverityCount),
      })),
    )
    .sort((a, b) => b.financialImpact - a.financialImpact)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  // Only surface rows where a real problem was detected — $0 means "nothing found".
  const priorityRows = allRows.filter((row) => row.financialImpact > 0);

  const columns = useMemo(
    () => [
      priorityColumnHelper.accessor("rank", {
        header: "#",
        cell: (info) => (
          <span className="text-xs font-bold tabular-nums text-text-muted">
            P{info.getValue()}
          </span>
        ),
      }),
      priorityColumnHelper.display({
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
              <p className="text-xs text-text-muted pl-3.5">{row.impactedBranch}</p>
              {row.rootCauseHint && (
                <p className="text-[11px] text-text-muted/70 italic pl-3.5 leading-relaxed">
                  {row.rootCauseHint}
                </p>
              )}
            </div>
          );
        },
      }),
      priorityColumnHelper.accessor("financialImpact", {
        header: "Cost at risk",
        cell: (info) => {
          const val = info.getValue();
          const colorClass =
            val >= 1000
              ? "text-status-critical"
              : val >= 400
                ? "text-status-warning"
                : "text-text-primary";
          return (
            <div>
              <p className={`text-base font-bold tabular-nums ${colorClass}`}>
                {toCurrency(val)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wider">
                {isOwnerRole ? "monthly exposure" : "at risk today"}
              </p>
            </div>
          );
        },
      }),
      priorityColumnHelper.display({
        id: "cta",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          const label = ctaLabel(row.sectionLabel);
          return (
            <Link
              href={row.viewHref}
              className="group inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/40 bg-surface-3 px-4 text-sm font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 active:scale-[0.98]"
            >
              {label}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          );
        },
      }),
    ],
    [isOwnerRole],
  );

  const table = useReactTable({
    data: priorityRows,
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <section>
      {/* Header — clearly distinct from the "Operations" branch cards above */}
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
            {priorityRows.length} open {priorityRows.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {/* Empty state — shown when nothing real was detected */}
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
                        ? "w-[200px]"
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
