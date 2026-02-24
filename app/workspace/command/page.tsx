"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "iconoir-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";

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

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function normalizeImpact(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function pickFirst<T>(items: T[], fallback: T): T {
  return items.length ? items[0] : fallback;
}

function getSeverity(impact: number, highSeverityCount: number): SeverityTone {
  if (impact >= 1500 || highSeverityCount >= 3) return "RED";
  if (impact >= 500 || highSeverityCount >= 1) return "AMBER";
  return "GREEN";
}

export default function CommandPage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const isStaffOperator = role === "STAFF_OPERATOR";
  const isBranchManagerRole = role === "BRANCH_MANAGER" || role === "GM";
  const isFinanceRole = role === "AUDITOR" || role === "ACCOUNTANT";
  const isOpsRole = role === "OPS_DIRECTOR";
  const isOwnerRole = role === "ORG_OWNER" || role === "ORG_ADMIN";

  const allowedCommandRoles = [
    "ORG_OWNER",
    "ORG_ADMIN",
    "OPS_DIRECTOR",
    "AUDITOR",
    "ACCOUNTANT",
  ];
  const canUseCommand = allowedCommandRoles.includes(role);

  const controlTowerQuery = useExecutiveControlTower(undefined, canUseCommand);
  const marginReportQuery = useOwnerMarginProtectionReport(undefined, canUseCommand);

  useEffect(() => {
    if (!isLoading && (isStaffOperator || isBranchManagerRole)) {
      router.replace("/");
    }
  }, [isLoading, isStaffOperator, isBranchManagerRole, router]);

  const alerts = controlTowerQuery.data?.alerts ?? [];
  const branchGrid = controlTowerQuery.data?.branch_grid ?? [];
  const marginBranches = marginReportQuery.data?.branches ?? [];

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
        return {
          ...branch,
          miss,
          missPct: prepared > 0 ? (miss / prepared) * 100 : 0,
        };
      })
      .sort((a, b) => b.miss - a.miss);
  }, [branchGrid]);

  const supplierLikeAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const content = `${alert.type ?? ""} ${alert.title ?? ""} ${alert.context ?? ""}`.toLowerCase();
      return (
        content.includes("supplier") ||
        content.includes("purchase") ||
        content.includes("cost")
      );
    });
  }, [alerts]);

  const stockRiskAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const content = `${alert.type ?? ""} ${alert.title ?? ""} ${alert.context ?? ""}`.toLowerCase();
      return content.includes("stock") || content.includes("inventory");
    });
  }, [alerts]);

  const highSeverityCount = alerts.filter((alert) => alert.severity === "HIGH").length;

  const financeSections = useMemo<CommandSection[]>(() => {
    const marginDrop = pickFirst(
      marginBranches
        .filter((branch) => Number(branch.margin_deviation_pct ?? 0) < -1)
        .map((branch) => ({
          id: `finance-margin-${branch.branch_id}`,
          title: `Margin dropped ${Math.abs(Number(branch.margin_deviation_pct ?? 0)).toFixed(1)}%`,
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.total_waste_cost ?? "0") * 0.22),
          actionRecommendation: "Review purchase costs and prep-to-sales mismatch this week.",
          viewHref: `/workspace/margin-protection?branch=${branch.branch_id}`,
        })),
      {
        id: "finance-margin-fallback",
        title: "Margin drift signal",
        impactedBranch: "Organization",
        financialImpact: 1200,
        actionRecommendation: "Audit margin movement before month-end close.",
        viewHref: "/workspace/margin-protection",
      },
    );

    const wasteOutlier = pickFirst(
      branchesByWastePct
        .filter((branch) => Number(branch.waste_pct ?? 0) >= 4)
        .map((branch) => ({
          id: `finance-waste-${branch.branch_id}`,
          title: `Waste outlier ${Number(branch.waste_pct ?? 0).toFixed(1)}%`,
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 260),
          actionRecommendation: "Investigate item-level overproduction and end-of-day carryover.",
          viewHref: `/workspace/waste-cost-report?branch=${branch.branch_id}`,
        })),
      {
        id: "finance-waste-fallback",
        title: "Waste outlier review",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "Waste levels are stable; keep monitoring outlier thresholds.",
        viewHref: "/workspace/waste-cost-report",
      },
    );

    const purchaseVariance = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `finance-purchase-${alert.id}`,
        title: alert.title || "Purchase variance alert",
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact((supplierLikeAlerts.length - index) * 320),
        actionRecommendation: "Validate supplier invoice and contracted unit price.",
        viewHref: "/workspace/purchase-variance",
      })),
      {
        id: "finance-purchase-fallback",
        title: "Supplier cost deviation",
        impactedBranch: "Organization",
        financialImpact: 900,
        actionRecommendation: "Review recurring SKUs for cost movement.",
        viewHref: "/workspace/purchase-variance",
      },
    );

    const taxFlag: CommandCard = {
      id: "finance-tax",
      title: "Tax risk flag",
      impactedBranch: "Organization",
      financialImpact: normalizeImpact(Number(marginReportQuery.data?.summary?.total_waste_cost ?? "0") * 0.18),
      actionRecommendation: "Check waste accounting classification before filing cycle.",
      viewHref: "/workspace/tax-engine",
    };

    return [
      { label: "Margin Drop Alerts", cards: [marginDrop] },
      { label: "Waste Outliers", cards: [wasteOutlier] },
      { label: "Purchase Variance Alerts", cards: [purchaseVariance] },
      { label: "Tax Risk Flags", cards: [taxFlag] },
    ];
  }, [
    marginBranches,
    branchesByWastePct,
    supplierLikeAlerts,
    marginReportQuery.data?.summary?.total_waste_cost,
  ]);

  const operationalSections = useMemo<CommandSection[]>(() => {
    const atRiskBranch = pickFirst(
      branchGrid
        .filter(
          (branch) =>
            branch.compliance_badge === "RED" || Number(branch.waste_pct ?? 0) >= 5,
        )
        .map((branch) => ({
          id: `ops-risk-${branch.branch_id}`,
          title: "Branch at risk",
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 300),
          actionRecommendation: "Deploy branch intervention checklist and monitor next shift.",
          viewHref: `/workspace/branches?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-risk-fallback",
        title: "Branch at risk",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "No branch currently exceeds risk threshold.",
        viewHref: "/workspace/branches",
      },
    );

    const wasteSpike = pickFirst(
      branchesByWastePct.map((branch) => ({
        id: `ops-waste-${branch.branch_id}`,
        title: `Waste spike ${Number(branch.waste_pct ?? 0).toFixed(1)}%`,
        impactedBranch: branch.branch_name,
        financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 280),
        actionRecommendation: "Adjust prep command and review top waste SKUs today.",
        viewHref: `/workspace/waste-cost-report?branch=${branch.branch_id}`,
      })),
      {
        id: "ops-waste-fallback",
        title: "Waste spike",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "No unusual waste spikes detected.",
        viewHref: "/workspace/waste-cost-report",
      },
    );

    const marginErosion = pickFirst(
      marginBranches
        .filter((branch) => Number(branch.margin_deviation_pct ?? 0) < -1)
        .map((branch) => ({
          id: `ops-margin-${branch.branch_id}`,
          title: "Margin erosion",
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.total_waste_cost ?? "0") * 0.2),
          actionRecommendation: "Investigate menu mix and purchasing variance immediately.",
          viewHref: `/workspace/margin-protection?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-margin-fallback",
        title: "Margin erosion",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "Margin signals remain stable today.",
        viewHref: "/workspace/margin-protection",
      },
    );

    const lowStock = pickFirst(
      stockRiskAlerts.map((alert, index) => ({
        id: `ops-stock-${alert.id}`,
        title: "Low stock risk",
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact((stockRiskAlerts.length - index) * 240),
        actionRecommendation: "Trigger replenishment or reallocate stock between branches.",
        viewHref: "/workspace/inventory",
      })),
      {
        id: "ops-stock-fallback",
        title: "Low stock risk",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "No low-stock alerts in the current telemetry window.",
        viewHref: "/workspace/inventory",
      },
    );

    const purchasingAnomaly = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `ops-purchase-${alert.id}`,
        title: "Purchasing anomaly",
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact((supplierLikeAlerts.length - index) * 260),
        actionRecommendation: "Compare supplier invoices to contracted pricing and demand.",
        viewHref: "/workspace/purchase-intelligence",
      })),
      {
        id: "ops-purchase-fallback",
        title: "Purchasing anomaly",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "No active purchase anomalies right now.",
        viewHref: "/workspace/purchase-intelligence",
      },
    );

    const underperformingStaff = pickFirst(
      branchGrid
        .filter((branch) => {
          const status = (branch.staff_activity_status || "").toUpperCase();
          return status.includes("LOW") || status.includes("INACTIVE");
        })
        .map((branch) => ({
          id: `ops-staff-${branch.branch_id}`,
          title: "Underperforming staff pattern",
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 180),
          actionRecommendation: "Run shift coaching and verify checklist completion quality.",
          viewHref: "/workspace/staff-performance",
        })),
      {
        id: "ops-staff-fallback",
        title: "Underperforming staff pattern",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "No staff performance anomalies detected.",
        viewHref: "/workspace/staff-performance",
      },
    );

    const forecastDeviation = pickFirst(
      branchesByForecastMiss.map((branch) => ({
        id: `ops-forecast-${branch.branch_id}`,
        title: `Forecast deviation ${branch.missPct.toFixed(1)}%`,
        impactedBranch: branch.branch_name,
        financialImpact: normalizeImpact(branch.miss * 30),
        actionRecommendation: "Recalibrate command quantities and confirm data freshness.",
        viewHref: "/workspace/production-intelligence",
      })),
      {
        id: "ops-forecast-fallback",
        title: "Forecast deviation",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "Forecast deviations are currently within tolerance.",
        viewHref: "/workspace/production-intelligence",
      },
    );

    const productionMisalignment = pickFirst(
      branchGrid
        .filter((branch) => Number(branch.surplus_pct ?? 0) >= 3)
        .map((branch) => ({
          id: `ops-prod-${branch.branch_id}`,
          title: "Production misalignment",
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.surplus_pct ?? 0) * 220),
          actionRecommendation: "Tighten prep windows and reduce late-shift overproduction.",
          viewHref: `/workspace/production-intelligence?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-prod-fallback",
        title: "Production misalignment",
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: "Production is aligned with current demand profile.",
        viewHref: "/workspace/production-intelligence",
      },
    );

    return [
      { label: "Branch at Risk", cards: [atRiskBranch] },
      { label: "Waste Spike", cards: [wasteSpike] },
      { label: "Margin Erosion", cards: [marginErosion] },
      { label: "Low Stock Risk", cards: [lowStock] },
      { label: "Purchasing Anomalies", cards: [purchasingAnomaly] },
      { label: "Underperforming Staff Patterns", cards: [underperformingStaff] },
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
      wasteByBranch.map((branch) => ({
        id: `exec-profit-${branch.branchId}`,
        title: "Profit leakage alert",
        impactedBranch: branch.branchName,
        financialImpact: normalizeImpact(branch.wasteCost * 4),
        rootCauseHint: "Leakage is tied to recurring waste concentration.",
        actionRecommendation: "View breakdown and assign corrective ownership.",
        viewHref: `/workspace/margin-protection?branch=${branch.branchId}`,
      })),
      {
        id: "exec-profit-fallback",
        title: "Profit leakage alert",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: "No major leakage patterns detected.",
        actionRecommendation: "Keep weekly margin protection cadence.",
        viewHref: "/workspace/margin-protection",
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
        .sort((a, b) => a.score - b.score)
        .map((branch) => ({
          id: `exec-under-${branch.branch_id}`,
          title: "Branch underperformance alert",
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 420),
          rootCauseHint: "Low branch score from waste/surplus pressure.",
          actionRecommendation: "View breakdown and start branch recovery sprint.",
          viewHref: `/workspace/branches?branch=${branch.branch_id}`,
        })),
      {
        id: "exec-under-fallback",
        title: "Branch underperformance alert",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: "No significant underperformance variance.",
        actionRecommendation: "Maintain weekly branch ranking review.",
        viewHref: "/workspace/branches",
      },
    );

    const costSpike = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `exec-cost-${alert.id}`,
        title: "Cost spike warning",
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact((supplierLikeAlerts.length - index) * 650),
        rootCauseHint: "Supplier-side price movement detected.",
        actionRecommendation: "View breakdown and renegotiate procurement terms.",
        viewHref: "/workspace/purchase-intelligence",
      })),
      {
        id: "exec-cost-fallback",
        title: "Cost spike warning",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: "No active supplier spikes above threshold.",
        actionRecommendation: "Continue contract compliance monitoring.",
        viewHref: "/workspace/purchase-intelligence",
      },
    );

    const systemicRisk: CommandCard = {
      id: "exec-systemic",
      title: "Systemic risk flag",
      impactedBranch: "Organization",
      financialImpact: normalizeImpact(highSeverityCount * 1200),
      rootCauseHint: `${highSeverityCount} high-severity system signal(s) across branches.`,
      actionRecommendation: "View breakdown and prioritize multi-branch mitigation.",
      viewHref: "/workspace/risk-compliance",
    };

    const forecastMiss = pickFirst(
      branchesByForecastMiss.map((branch) => ({
        id: `exec-forecast-${branch.branch_id}`,
        title: "Forecast miss risk",
        impactedBranch: branch.branch_name,
        financialImpact: normalizeImpact(branch.miss * 45),
        rootCauseHint: `Forecast miss currently ${branch.missPct.toFixed(1)}% at branch level.`,
        actionRecommendation: "View breakdown and tighten forecast governance.",
        viewHref: `/workspace/production-intelligence?branch=${branch.branch_id}`,
      })),
      {
        id: "exec-forecast-fallback",
        title: "Forecast miss risk",
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: "Forecast stability is currently healthy.",
        actionRecommendation: "Keep existing forecast controls active.",
        viewHref: "/workspace/production-intelligence",
      },
    );

    return [
      { label: "Profit Leakage Alerts", cards: [profitLeakage] },
      { label: "Branch Underperformance Alerts", cards: [underperformance] },
      { label: "Cost Spike Warnings", cards: [costSpike] },
      { label: "Systemic Risk Flags", cards: [systemicRisk] },
      { label: "Forecast Miss Risks", cards: [forecastMiss] },
    ];
  }, [
    wasteByBranch,
    branchGrid,
    supplierLikeAlerts,
    highSeverityCount,
    branchesByForecastMiss,
  ]);

  const activeSections = isFinanceRole
    ? financeSections
    : isOpsRole
      ? operationalSections
      : executiveSections;

  const totalImpact = activeSections
    .flatMap((section) => section.cards)
    .reduce((sum, card) => sum + card.financialImpact, 0);
  const priorityQueue = activeSections
    .flatMap((section) =>
      section.cards.map((card) => ({
        ...card,
        sectionLabel: section.label,
        severity: getSeverity(card.financialImpact, highSeverityCount),
      })),
    )
    .sort((a, b) => b.financialImpact - a.financialImpact);
  const priorityRows: PriorityRow[] = priorityQueue.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
  const redCount = priorityQueue.filter((item) => item.severity === "RED").length;
  const amberCount = priorityQueue.filter((item) => item.severity === "AMBER").length;
  const columnHelper = createColumnHelper<PriorityRow>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("rank", {
        header: "Priority",
        cell: (info) => (
          <span className="text-[12px] font-medium text-[#F5F5F7]">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "signal",
        header: "Signal",
        cell: (info) => {
          const row = info.row.original;
          const severityTone =
            row.severity === "RED"
              ? "text-[#C44949]"
              : row.severity === "AMBER"
                ? "text-[#C48B2A]"
                : "text-[#3F8F68]";
          return (
            <div className="space-y-0.5">
              <p className="text-[13px] text-[#F5F5F7]">{row.title}</p>
              <p className="text-[11px] text-[#8E8E93]">
                {row.sectionLabel} · {row.impactedBranch}
              </p>
              <p className={`text-[11px] ${severityTone}`}>{row.severity}</p>
            </div>
          );
        },
      }),
      columnHelper.accessor("financialImpact", {
        header: isOwnerRole ? "Monthly Impact" : "Impact",
        cell: (info) => (
          <span className="text-[12px] text-[#F5F5F7]">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "action",
        header: "Action Recommendation",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="space-y-1">
              <p className="text-[12px] text-[#C7C7CC]">{row.actionRecommendation}</p>
              {row.rootCauseHint ? (
                <p className="text-[11px] text-[#8E8E93]">{row.rootCauseHint}</p>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "cta",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          return (
            <Link
              href={row.viewHref}
              className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#2E2E33] px-2.5 text-[11px] font-medium text-[#F5F5F7] transition-colors hover:border-[#A8821F] hover:text-[#A8821F]"
            >
              View breakdown
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          );
        },
      }),
    ],
    [columnHelper, isOwnerRole],
  );
  const table = useReactTable({
    data: priorityRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <WorkspaceShell
      eyebrow="Command"
      title={
        isFinanceRole
          ? "Financial Command"
          : isOpsRole
            ? "Operational Intervention"
            : "Executive Leverage"
      }
      description={
        isFinanceRole
          ? "Anomaly detection and financial exposure queue prioritized by impact."
          : isOpsRole
            ? "Triage dashboard for operational risk across branches."
            : "Executive command queue focused on money leakage and systemic exposure."
      }
      insight={
        isFinanceRole
          ? "High-impact financial anomalies are surfaced first so finance can intervene before month-end leakage compounds."
          : isOpsRole
            ? "Intervene where risk concentration is highest, then verify branch correction loop completion."
            : "Executive command should answer one question quickly: where are we losing money next month?"
      }
    >
      <section className="grid grid-cols-1 gap-5 border-b border-[#2A2A2E] pb-8 md:grid-cols-4">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Open Command Cards
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            {activeSections.reduce((sum, section) => sum + section.cards.length, 0)}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Estimated Impact
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            {toCurrency(totalImpact)}
          </p>
          <p className="mt-1 text-[12px] text-[#8E8E93]">
            {isOwnerRole ? "Estimated monthly impact" : "Current exposure estimate"}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            High Severity Signals
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            {highSeverityCount}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Severity Mix
          </p>
          <p className="mt-2 text-[14px] text-[#F5F5F7]">
            <span className="text-[#C44949]">{redCount} red</span> /{" "}
            <span className="text-[#C48B2A]">{amberCount} amber</span>
          </p>
        </article>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#A8821F]">
          Priority Queue
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-[#2A2A2E]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const rowSeverity = row.original.severity;
                const rowToneClass =
                  rowSeverity === "RED"
                    ? "border-l-[#C44949]"
                    : rowSeverity === "AMBER"
                      ? "border-l-[#C48B2A]"
                      : "border-l-[#3F8F68]";
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-[#2A2A2E] align-top ${rowToneClass} border-l-2`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-2 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspaceShell>
  );
}
