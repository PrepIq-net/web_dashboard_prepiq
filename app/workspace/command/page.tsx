"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "iconoir-react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
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

const EMPTY_LIST: never[] = [];
const priorityColumnHelper = createColumnHelper<PriorityRow>();
const CORE_ROW_MODEL = getCoreRowModel();

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

  const controlTowerQuery = useExecutiveControlTower(
    undefined,
    canUseCommand && Boolean(user?.organization_id),
  );
  const marginReportQuery = useOwnerMarginProtectionReport(
    undefined,
    canUseCommand && Boolean(user?.organization_id),
  );

  useEffect(() => {
    if (!isLoading && (isStaffOperator || isBranchManagerRole)) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isStaffOperator, isBranchManagerRole]);

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
          title: t("workspace.command.marginDroppedMsg", {
            percent: Math.abs(
              Number(branch.margin_deviation_pct ?? 0),
            ).toFixed(1),
          }),
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(
            Number(branch.total_waste_cost ?? "0") * 0.22,
          ),
          actionRecommendation: t("workspace.command.reviewPurchaseCostsMsg"),
          viewHref: `/workspace/margin-protection?branch=${branch.branch_id}`,
        })),
      {
        id: "finance-margin-fallback",
        title: t("workspace.command.marginDriftSignal"),
        impactedBranch: "Organization",
        financialImpact: 1200,
        actionRecommendation: t("workspace.command.auditMarginMsg"),
        viewHref: "/workspace/margin-protection",
      },
    );

    const wasteOutlier = pickFirst(
      branchesByWastePct
        .filter((branch) => Number(branch.waste_pct ?? 0) >= 4)
        .map((branch) => ({
          id: `finance-waste-${branch.branch_id}`,
          title: t("workspace.command.wasteOutlierMsg", {
            percent: Number(branch.waste_pct ?? 0).toFixed(1),
          }),
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 260),
          actionRecommendation: t("workspace.command.investigateOverproductionMsg"),
          viewHref: `/workspace/waste-cost-report?branch=${branch.branch_id}`,
        })),
      {
        id: "finance-waste-fallback",
        title: t("workspace.command.wasteOutlierReview"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.wasteLevelsStableMsg"),
        viewHref: "/workspace/waste-cost-report",
      },
    );

    const purchaseVariance = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `finance-purchase-${alert.id}`,
        title: alert.title || t("workspace.command.purchaseVarianceAlert"),
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact(
          (supplierLikeAlerts.length - index) * 320,
        ),
        actionRecommendation: t("workspace.command.validateSupplierInvoiceMsg"),
        viewHref: "/workspace/purchase-variance",
      })),
      {
        id: "finance-purchase-fallback",
        title: t("workspace.command.supplierCostDeviation"),
        impactedBranch: "Organization",
        financialImpact: 900,
        actionRecommendation: t("workspace.command.reviewRecurringSkusMsg"),
        viewHref: "/workspace/purchase-variance",
      },
    );

    const taxFlag: CommandCard = {
      id: "finance-tax",
      title: t("workspace.command.taxRiskFlag"),
      impactedBranch: "Organization",
      financialImpact: normalizeImpact(
        Number(marginReportQuery.data?.summary?.total_waste_cost ?? "0") * 0.18,
      ),
      actionRecommendation: t("workspace.command.checkWasteAccountingMsg"),
      viewHref: "/workspace/tax-engine",
    };

    return [
      { label: t("workspace.command.marginDropAlerts"), cards: [marginDrop] },
      { label: t("workspace.command.wasteOutliers"), cards: [wasteOutlier] },
      {
        label: t("workspace.command.purchaseVarianceAlerts"),
        cards: [purchaseVariance],
      },
      { label: t("workspace.command.taxRiskFlags"), cards: [taxFlag] },
    ];
  }, [
    marginBranches,
    branchesByWastePct,
    supplierLikeAlerts,
    marginReportQuery.data?.summary?.total_waste_cost,
    t,
  ]);

  const operationalSections = useMemo<CommandSection[]>(() => {
    const atRiskBranch = pickFirst(
      branchGrid
        .filter(
          (branch) =>
            branch.compliance_badge === "RED" ||
            Number(branch.waste_pct ?? 0) >= 5,
        )
        .map((branch) => ({
          id: `ops-risk-${branch.branch_id}`,
          title: t("workspace.command.branchAtRiskTitle"),
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 300),
          actionRecommendation: t("workspace.command.deployInterventionMsg"),
          viewHref: `/workspace/branches?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-risk-fallback",
        title: t("workspace.command.branchAtRiskTitle"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.noBranchExceedsRiskMsg"),
        viewHref: "/workspace/branches",
      },
    );

    const wasteSpike = pickFirst(
      branchesByWastePct.map((branch) => ({
        id: `ops-waste-${branch.branch_id}`,
        title: t("workspace.command.wasteSpikeMsg", {
          percent: Number(branch.waste_pct ?? 0).toFixed(1),
        }),
        impactedBranch: branch.branch_name,
        financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 280),
        actionRecommendation: t("workspace.command.adjustPrepCommandMsg"),
        viewHref: `/workspace/waste-cost-report?branch=${branch.branch_id}`,
      })),
      {
        id: "ops-waste-fallback",
        title: t("workspace.command.wasteSpike"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.noUnusualWasteSpikesMsg"),
        viewHref: "/workspace/waste-cost-report",
      },
    );

    const marginErosion = pickFirst(
      marginBranches
        .filter((branch) => Number(branch.margin_deviation_pct ?? 0) < -1)
        .map((branch) => ({
          id: `ops-margin-${branch.branch_id}`,
          title: t("workspace.command.marginErosionTitle"),
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(
            Number(branch.total_waste_cost ?? "0") * 0.2,
          ),
          actionRecommendation: t("workspace.command.investigateMenuMixMsg"),
          viewHref: `/workspace/margin-protection?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-margin-fallback",
        title: t("workspace.command.marginErosionTitle"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.marginSignalsStableMsg"),
        viewHref: "/workspace/margin-protection",
      },
    );

    const lowStock = pickFirst(
      stockRiskAlerts.map((alert, index) => ({
        id: `ops-stock-${alert.id}`,
        title: t("workspace.command.lowStockRiskTitle"),
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact(
          (stockRiskAlerts.length - index) * 240,
        ),
        actionRecommendation: t("workspace.command.triggerReplenishmentMsg"),
        viewHref: "/workspace/inventory",
      })),
      {
        id: "ops-stock-fallback",
        title: t("workspace.command.lowStockRiskTitle"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.noLowStockAlertsMsg"),
        viewHref: "/workspace/inventory",
      },
    );

    const purchasingAnomaly = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `ops-purchase-${alert.id}`,
        title: t("workspace.command.purchasingAnomalyTitle"),
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact(
          (supplierLikeAlerts.length - index) * 260,
        ),
        actionRecommendation: t("workspace.command.compareSupplierInvoicesMsg"),
        viewHref: "/workspace/purchase-intelligence",
      })),
      {
        id: "ops-purchase-fallback",
        title: t("workspace.command.purchasingAnomalyTitle"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.noActivePurchaseAnomaliesMsg"),
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
          title: t("workspace.command.underperformingStaffPatternTitle"),
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 180),
          actionRecommendation: t("workspace.command.runShiftCoachingMsg"),
          viewHref: "/workspace/staff-performance",
        })),
      {
        id: "ops-staff-fallback",
        title: t("workspace.command.underperformingStaffPatternTitle"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.noStaffAnomaliesMsg"),
        viewHref: "/workspace/staff-performance",
      },
    );

    const forecastDeviation = pickFirst(
      branchesByForecastMiss.map((branch) => ({
        id: `ops-forecast-${branch.branch_id}`,
        title: t("workspace.command.forecastDeviationMsg", {
          percent: branch.missPct.toFixed(1),
        }),
        impactedBranch: branch.branch_name,
        financialImpact: normalizeImpact(branch.miss * 30),
        actionRecommendation: t("workspace.command.recalibrateCommandMsg"),
        viewHref: "/workspace/production-intelligence",
      })),
      {
        id: "ops-forecast-fallback",
        title: t("workspace.command.forecastDeviation"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t(
          "workspace.command.forecastDeviationsToleranceMsg",
        ),
        viewHref: "/workspace/production-intelligence",
      },
    );

    const productionMisalignment = pickFirst(
      branchGrid
        .filter((branch) => Number(branch.surplus_pct ?? 0) >= 3)
        .map((branch) => ({
          id: `ops-prod-${branch.branch_id}`,
          title: t("workspace.command.productionMisalignmentTitle"),
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(
            Number(branch.surplus_pct ?? 0) * 220,
          ),
          actionRecommendation: t("workspace.command.tightenPrepWindowsMsg"),
          viewHref: `/workspace/production-intelligence?branch=${branch.branch_id}`,
        })),
      {
        id: "ops-prod-fallback",
        title: t("workspace.command.productionMisalignmentTitle"),
        impactedBranch: "Organization",
        financialImpact: 0,
        actionRecommendation: t("workspace.command.productionAlignedDemandMsg"),
        viewHref: "/workspace/production-intelligence",
      },
    );

    return [
      { label: t("workspace.command.branchAtRisk"), cards: [atRiskBranch] },
      { label: t("workspace.command.wasteSpike"), cards: [wasteSpike] },
      { label: t("workspace.command.marginErosion"), cards: [marginErosion] },
      { label: t("workspace.command.lowStockRisk"), cards: [lowStock] },
      {
        label: t("workspace.command.purchasingAnomalies"),
        cards: [purchasingAnomaly],
      },
      {
        label: t("workspace.command.underperformingStaffPatterns"),
        cards: [underperformingStaff],
      },
      {
        label: t("workspace.command.forecastDeviation"),
        cards: [forecastDeviation],
      },
      {
        label: t("workspace.command.productionMisalignment"),
        cards: [productionMisalignment],
      },
    ];
  }, [
    branchGrid,
    branchesByWastePct,
    branchesByForecastMiss,
    marginBranches,
    stockRiskAlerts,
    supplierLikeAlerts,
    t,
  ]);

  const executiveSections = useMemo<CommandSection[]>(() => {
    const profitLeakage = pickFirst(
      wasteByBranch.map((branch) => ({
        id: `exec-profit-${branch.branchId}`,
        title: t("workspace.command.profitLeakageAlert"),
        impactedBranch: branch.branchName,
        financialImpact: normalizeImpact(branch.wasteCost * 4),
        rootCauseHint: t("workspace.command.leakageRecurringWasteMsg"),
        actionRecommendation: t("workspace.command.viewBreakdownAssignCorrectiveMsg"),
        viewHref: `/workspace/margin-protection?branch=${branch.branchId}`,
      })),
      {
        id: "exec-profit-fallback",
        title: t("workspace.command.profitLeakageAlert"),
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: t("workspace.command.noMajorLeakageMsg"),
        actionRecommendation: t("workspace.command.keepWeeklyMarginMsg"),
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
          title: t("workspace.command.branchUnderperformanceAlert"),
          impactedBranch: branch.branch_name,
          financialImpact: normalizeImpact(Number(branch.waste_pct ?? 0) * 420),
          rootCauseHint: t("workspace.command.lowBranchScoreMsg"),
          actionRecommendation: t("workspace.command.viewBreakdownRecoveryMsg"),
          viewHref: `/workspace/branches?branch=${branch.branch_id}`,
        })),
      {
        id: "exec-under-fallback",
        title: t("workspace.command.branchUnderperformanceAlert"),
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: t("workspace.command.noSignificantUnderperformanceMsg"),
        actionRecommendation: t("workspace.command.maintainWeeklyRankingMsg"),
        viewHref: "/workspace/branches",
      },
    );

    const costSpike = pickFirst(
      supplierLikeAlerts.map((alert, index) => ({
        id: `exec-cost-${alert.id}`,
        title: t("workspace.command.costSpikeWarning"),
        impactedBranch: alert.branch_name,
        financialImpact: normalizeImpact(
          (supplierLikeAlerts.length - index) * 650,
        ),
        rootCauseHint: t("workspace.command.supplierSidePriceMsg"),
        actionRecommendation: t("workspace.command.viewBreakdownRenegotiateMsg"),
        viewHref: "/workspace/purchase-intelligence",
      })),
      {
        id: "exec-cost-fallback",
        title: t("workspace.command.costSpikeWarning"),
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: t("workspace.command.noActiveSupplierSpikesMsg"),
        actionRecommendation: t("workspace.command.continueContractComplianceMsg"),
        viewHref: "/workspace/purchase-intelligence",
      },
    );

    const systemicRisk: CommandCard = {
      id: "exec-systemic",
      title: t("workspace.command.systemicRiskFlag"),
      impactedBranch: "Organization",
      financialImpact: normalizeImpact(highSeverityCount * 1200),
      rootCauseHint: t("workspace.command.highSeveritySystemSignals", {
        count: highSeverityCount,
      }),
      actionRecommendation: t("workspace.command.viewBreakdownMitigationMsg"),
      viewHref: "/workspace/risk",
    };

    const forecastMiss = pickFirst(
      branchesByForecastMiss.map((branch) => ({
        id: `exec-forecast-${branch.branch_id}`,
        title: t("workspace.command.forecastMissRisk"),
        impactedBranch: branch.branch_name,
        financialImpact: normalizeImpact(branch.miss * 45),
        rootCauseHint: t("workspace.command.forecastMissBranchMsg", {
          percent: branch.missPct.toFixed(1),
        }),
        actionRecommendation: t("workspace.command.viewBreakdownTightenGovernanceMsg"),
        viewHref: `/workspace/production-intelligence?branch=${branch.branch_id}`,
      })),
      {
        id: "exec-forecast-fallback",
        title: t("workspace.command.forecastMissRisk"),
        impactedBranch: "Organization",
        financialImpact: 0,
        rootCauseHint: t("workspace.command.forecastStabilityHealthyMsg"),
        actionRecommendation: t("workspace.command.keepExistingForecastControlsMsg"),
        viewHref: "/workspace/production-intelligence",
      },
    );

    return [
      { label: t("workspace.command.profitLeakageAlerts"), cards: [profitLeakage] },
      {
        label: t("workspace.command.branchUnderperformanceAlerts"),
        cards: [underperformance],
      },
      { label: t("workspace.command.costSpikeWarnings"), cards: [costSpike] },
      { label: t("workspace.command.systemicRiskFlags"), cards: [systemicRisk] },
      { label: t("workspace.command.forecastMissRisks"), cards: [forecastMiss] },
    ];
  }, [
    wasteByBranch,
    branchGrid,
    supplierLikeAlerts,
    highSeverityCount,
    branchesByForecastMiss,
    t,
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
  const columns = useMemo(
    () => [
      priorityColumnHelper.accessor("rank", {
        header: t("workspace.command.table.priority"),
        cell: (info) => (
          <span className="inline-flex min-w-[44px] items-center justify-center rounded-lg border border-surface-4 bg-gradient-to-br from-surface-3 to-surface-2 px-3 py-1.5 text-xs font-bold tracking-[0.08em] text-text-primary shadow-sm">
            P{info.getValue()}
          </span>
        ),
      }),
      priorityColumnHelper.display({
        id: "signal",
        header: t("workspace.command.table.signal"),
        cell: (info) => {
          const row = info.row.original;
          const severityTone =
            row.severity === "RED"
              ? "text-status-critical"
              : row.severity === "AMBER"
                ? "text-status-warning"
                : "text-status-success";
          const severityDot =
            row.severity === "RED"
              ? "bg-status-critical"
              : row.severity === "AMBER"
                ? "bg-status-warning"
                : "bg-status-success";
          const severityBg =
            row.severity === "RED"
              ? "bg-status-critical/10"
              : row.severity === "AMBER"
                ? "bg-status-warning/10"
                : "bg-status-success/10";
          return (
            <div className="space-y-2.5">
              <p className="text-sm font-semibold leading-tight text-text-primary">
                {row.title}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {row.sectionLabel}
              </p>
              <div
                className={`inline-flex items-center gap-2.5 ${severityBg} rounded-lg px-3 py-1.5 border border-surface-4`}
              >
                <span className="text-xs font-medium text-text-secondary">
                  {row.impactedBranch}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${severityDot} shadow-sm`}
                />
                <span
                  className={`text-xs font-bold tracking-wide ${severityTone}`}
                >
                  {row.severity}
                </span>
              </div>
            </div>
          );
        },
      }),
      priorityColumnHelper.accessor("financialImpact", {
        header: isOwnerRole
          ? t("workspace.command.table.monthlyImpact")
          : t("workspace.command.table.impact"),
        cell: (info) => (
          <div className="inline-flex items-baseline gap-1">
            <span className="text-lg font-bold text-brand-gold tracking-tight">
              {toCurrency(info.getValue())}
            </span>
            <span className="text-xs text-text-muted font-medium">USD</span>
          </div>
        ),
      }),
      priorityColumnHelper.display({
        id: "action",
        header: t("workspace.command.table.actionRecommendation"),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="space-y-2.5">
              <p className="text-sm leading-relaxed text-text-primary font-medium">
                {row.actionRecommendation}
              </p>
              {row.rootCauseHint ? (
                <div className="flex items-start gap-2 text-xs leading-relaxed text-text-muted bg-surface-3/50 rounded-lg px-3 py-2 border border-surface-4">
                  <span className="inline-block mt-0.5 h-1 w-1 rounded-full bg-brand-gold flex-shrink-0" />
                  <span>{row.rootCauseHint}</span>
                </div>
              ) : null}
            </div>
          );
        },
      }),
      priorityColumnHelper.display({
        id: "cta",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          return (
            <Link
              href={row.viewHref}
              className="group inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/40 bg-surface-3 px-4 text-sm font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold-hover active:scale-[0.98]"
            >
              {t("workspace.command.table.view")}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          );
        },
      }),
    ],
    [isOwnerRole, t],
  );
  const table = useReactTable({
    data: priorityRows,
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <WorkspaceShell
      eyebrow={t("workspace.command.eyebrow")}
      title={
        isFinanceRole
          ? t("workspace.command.titleFinance")
          : isOpsRole
            ? t("workspace.command.titleOps")
            : t("workspace.command.titleExec")
      }
      description={
        isFinanceRole
          ? t("workspace.command.descriptionFinance")
          : isOpsRole
            ? t("workspace.command.descriptionOps")
            : t("workspace.command.descriptionExec")
      }
      insight={
        isFinanceRole
          ? t("workspace.command.insightFinance")
          : isOpsRole
            ? t("workspace.command.insightOps")
            : t("workspace.command.insightExec")
      }
    >
      <section className="grid grid-cols-1 gap-8 border-b border-surface-4 pb-12 mb-12 md:grid-cols-4">
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("workspace.command.openCommandCards")}
          </p>
          <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
            {activeSections.reduce(
              (sum, section) => sum + section.cards.length,
              0,
            )}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {t("workspace.command.activeInterventions")}
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("workspace.command.estimatedImpact")}
          </p>
          <p className="font-display text-4xl font-semibold text-brand-gold tracking-tight">
            {toCurrency(totalImpact)}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {isOwnerRole
                ? t("workspace.command.monthlyExposure")
                : t("workspace.command.currentPeriod")}
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("workspace.command.highSeverity")}
          </p>
          <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
            {highSeverityCount}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">
              {t("workspace.command.criticalSignals")}
            </p>
          </div>
        </article>

        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            {t("workspace.command.severityMix")}
          </p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-display text-2xl font-semibold text-status-critical">{redCount}</span>
            <span className="text-sm text-text-muted">/</span>
            <span className="font-display text-2xl font-semibold text-status-warning">{amberCount}</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-2 bg-status-critical/20 rounded-full overflow-hidden">
              <div 
                className="h-2 bg-status-critical rounded-full"
                style={{ width: `${priorityQueue.length > 0 ? (redCount / priorityQueue.length) * 100 : 0}%` }}
              />
            </div>
            <div className="flex-1 h-2 bg-status-warning/20 rounded-full overflow-hidden">
              <div 
                className="h-2 bg-status-warning rounded-full"
                style={{ width: `${priorityQueue.length > 0 ? (amberCount / priorityQueue.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </article>
      </section>

      <section className="mt-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            {t("workspace.command.priorityQueue")}
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            {t("workspace.command.interventionPriorities")}
          </h3>
        </div>
        
        <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <NativeTable
              table={table}
              tableClassName="w-full min-w-[980px]"
              headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
              bodyClassName="divide-y divide-surface-4"
              headerCellClassName={(header) =>
                `px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted ${
                  header.id.includes("rank")
                    ? "w-[100px]"
                    : header.id.includes("financialImpact")
                      ? "w-[180px]"
                      : header.id.includes("cta")
                        ? "w-[200px]"
                        : ""
                }`
              }
              bodyRowClassName={(row) => {
                const rowToneClass =
                  row.original.severity === "RED"
                    ? "border-l-status-critical"
                    : row.original.severity === "AMBER"
                      ? "border-l-status-warning"
                      : "border-l-status-success";
                return `align-top transition-all duration-200 hover:bg-surface-3/50 ${rowToneClass} border-l-[3px]`;
              }}
              cellClassName="px-6 py-6"
            />
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}
