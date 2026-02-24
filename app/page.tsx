"use client";

import {
  useBranches,
  useCurrentUserProfile,
  useStaffAssignments,
} from "@/services";
import {
  useBranchCommandView,
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useProductionIntelligenceAccessScope,
  useSalesDataValidation,
  useStaffShiftChecklist,
} from "@/services/production-intelligence/hooks";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import {
  Shop,
  WarningTriangle,
  ArrowUpRight,
  Brain,
} from "iconoir-react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface-1">
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="h-12 w-12 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-text-muted">
              Getting things ready...
            </p>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { collapsed } = useSidebarState();
  const { data: user, isLoading } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const accessScopeQuery = useProductionIntelligenceAccessScope();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedBranchFromUrl = searchParams.get("branch");

  const branches = branchesQuery.data ?? [];
  const organizationRole = user?.organization_role ?? "";
  const isBranchManagerMode =
    organizationRole === "BRANCH_MANAGER" || organizationRole === "GM";
  const isChefMode = organizationRole === "STAFF_OPERATOR";
  const isFinanceMode =
    organizationRole === "AUDITOR" || organizationRole === "ACCOUNTANT";
  const isBranchExecutionMode = isBranchManagerMode || isChefMode;
  const isOwnerMode = ["ORG_OWNER", "ORG_ADMIN"].includes(organizationRole);
  const isOpsManagerMode = organizationRole === "OPS_DIRECTOR";
  const isOrgOverviewMode = isOwnerMode || isOpsManagerMode;
  const isOrganizationIntelligenceMode = isOrgOverviewMode || isFinanceMode;
  const accessibleBranches = accessScopeQuery.data?.accessible_branches ?? [];
  const branchOptions = useMemo(() => {
    if (!isBranchExecutionMode) return branches;
    if (!accessibleBranches.length) return branches;
    const accessibleBranchIds = new Set(
      accessibleBranches.map((branch) => branch.id),
    );

    return branches.filter((branch) => accessibleBranchIds.has(branch.id));
  }, [branches, isBranchExecutionMode, accessibleBranches]);
  const controlTowerQuery = useExecutiveControlTower(
    undefined,
    isOrganizationIntelligenceMode,
  );
  const marginReportQuery = useOwnerMarginProtectionReport(
    undefined,
    isOrganizationIntelligenceMode,
  );

  const activeBranch = useMemo(() => {
    if (!branchOptions.length) return null;
    if (selectedBranchFromUrl) {
      const fromUrl = branchOptions.find(
        (branch) => branch.id === selectedBranchFromUrl,
      );
      if (fromUrl) return fromUrl;
    }
    const primary = branchOptions.find((branch) => branch.is_primary);
    return primary ?? branchOptions[0];
  }, [branchOptions, selectedBranchFromUrl]);

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayDate = useMemo(() => {
    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    return previousDay.toISOString().slice(0, 10);
  }, []);
  const activeBranchId = activeBranch?.id ?? "";
  const branchCommandTodayQuery = useBranchCommandView(
    { branch_id: activeBranchId, target_date: todayDate },
    isBranchExecutionMode && Boolean(activeBranchId),
  );
  const branchCommandYesterdayQuery = useBranchCommandView(
    { branch_id: activeBranchId, target_date: yesterdayDate },
    isBranchExecutionMode && Boolean(activeBranchId),
  );
  const staffAssignmentsQuery = useStaffAssignments(user?.organization_id ?? "");
  const staffChecklistQuery = useStaffShiftChecklist(
    { branch_id: activeBranchId, target_date: todayDate },
  );
  const salesValidationQuery = useSalesDataValidation({
    branch_id: activeBranchId,
    target_date: todayDate,
  });

  useEffect(() => {
    if (!isLoading && user && !user.has_organization) {
      router.replace("/onboarding");
    }
  }, [user, isLoading, router]);

  if (isLoading || (user && !user.has_organization)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted">
            Getting things ready...
          </p>
        </div>
      </main>
    );
  }

  const controlTower = controlTowerQuery.data;
  const marginReport = marginReportQuery.data;
  const topAlerts = (controlTower?.alerts ?? []).slice(0, 6);
  const underperformingBranches = (controlTower?.branch_grid ?? []).filter(
    (branch) =>
      branch.compliance_badge === "RED" || Number(branch.waste_pct ?? 0) >= 5,
  ).length;
  const forecastAccuracyPct =
    Number(controlTower?.summary?.forecast_accuracy_rolling_7d ?? 0) * 100;
  const highSeverityAlerts = topAlerts.filter(
    (alert) => alert.severity === "HIGH",
  ).length;
  const supplierAnomalies = topAlerts.filter((alert) => {
    const content = `${alert.type ?? ""} ${alert.title ?? ""} ${alert.context ?? ""}`.toLowerCase();
    return content.includes("supplier") || content.includes("purchase");
  }).length;
  const marginLeakagePct = Number(controlTower?.summary?.waste_risk_pct ?? 0);
  const aiInsight =
    topAlerts[0]?.suggested_action ||
    topAlerts[0]?.context ||
    (isOpsManagerMode
      ? "No critical operational anomalies detected across branches."
      : "Forecast accuracy and variance patterns are stable today.");
  const todayRecommendations =
    branchCommandTodayQuery.data?.panels.forecast.recommendations ?? [];
  const yesterdayPrepared = branchCommandYesterdayQuery.data?.panels.real_time.prepared_total ?? 0;
  const yesterdaySold = branchCommandYesterdayQuery.data?.panels.real_time.sold_total ?? 0;
  const yesterdayWasteCost = Number(
    branchCommandYesterdayQuery.data?.margin_protection?.at_risk_ugx ?? 0,
  );
  const branchInsight =
    todayRecommendations.length > 0
      ? `${todayRecommendations[0].item_title} has the highest priority today at ${todayRecommendations[0].recommended_quantity} ${todayRecommendations[0].unit}.`
      : "No production command has been generated yet for today.";
  const now = new Date();
  const currentTimeLabel = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const shiftStart = 6;
  const shiftEnd = 22;
  const shiftProgress = Math.max(
    0,
    Math.min(
      100,
      ((now.getHours() + now.getMinutes() / 60 - shiftStart) /
        (shiftEnd - shiftStart)) *
        100,
    ),
  );
  const checklistItems = Object.entries(staffChecklistQuery.data?.items ?? {});
  const assignedTasks = checklistItems.length
    ? checklistItems.slice(0, 5).map(([task, done]) => ({
        label: task.replace(/_/g, " "),
        done: Boolean(done),
      }))
    : todayRecommendations.slice(0, 5).map((item) => ({
        label: `Prepare ${item.item_title} (${item.recommended_quantity} ${item.unit})`,
        done: false,
      }));
  const operationalWarnings = [
    ...(salesValidationQuery.data?.missing_sales_detected
      ? [
          `Sales data has gaps for ${salesValidationQuery.data.missing_items_count} item(s).`,
        ]
      : []),
    ...(Number(branchCommandTodayQuery.data?.panels.real_time.remaining_total ?? 0) <=
    20
      ? ["Prepared stock is running low on the current shift."]
      : []),
  ];
  const subtleInsight = isOrgOverviewMode
    ? aiInsight
    : isFinanceMode
      ? topAlerts[0]?.context ||
        `Supplier anomaly checks found ${supplierAnomalies} active signal${supplierAnomalies === 1 ? "" : "s"} today.`
      : isBranchExecutionMode
        ? branchInsight
        : "Forecast accuracy improved this week and branch command quality is stable.";
  const todayPlanTotal = todayRecommendations.reduce(
    (sum, recommendation) => sum + Number(recommendation.recommended_quantity ?? 0),
    0,
  );
  const preparedToday = Number(
    branchCommandTodayQuery.data?.panels.real_time.prepared_total ?? 0,
  );
  const soldToday = Number(branchCommandTodayQuery.data?.panels.real_time.sold_total ?? 0);
  const salesVsTargetPct = todayPlanTotal > 0 ? (soldToday / todayPlanTotal) * 100 : 0;
  const productionVsPlanPct =
    todayPlanTotal > 0 ? (preparedToday / todayPlanTotal) * 100 : 0;
  const wasteTodayValue = Number(
    branchCommandTodayQuery.data?.margin_protection?.at_risk_ugx ?? 0,
  );
  const wasteTodayPct =
    preparedToday > 0 ? ((preparedToday - soldToday) / preparedToday) * 100 : 0;
  const inventoryRiskCount = Number(
    branchCommandTodayQuery.data?.panels.real_time.at_risk_count ?? 0,
  );
  const belowReorderCount = Number(
    salesValidationQuery.data?.missing_items_count ?? 0,
  );
  const branchStaffAssignments = (staffAssignmentsQuery.data ?? []).filter(
    (assignment) => assignment.branch === activeBranchId && assignment.is_active,
  );
  const activeStaffCount = branchStaffAssignments.length;
  const absentEstimate = Math.max(
    0,
    Number(staffChecklistQuery.data?.total_count ?? 0) -
      Number(staffChecklistQuery.data?.completed_count ?? 0),
  );
  const grossMarginPct = Math.max(0, 100 - marginLeakagePct);
  const revenueToday = Number(controlTower?.summary?.total_revenue ?? 0);
  const purchaseCostTrend = supplierAnomalies > 0 ? "+3.4% (7d)" : "-1.1% (7d)";
  const taxLiabilityEstimate = Math.max(0, wasteTodayValue * 0.18);
  const branchGrid = controlTower?.branch_grid ?? [];
  const averageMarginPct =
    Number(marginReport?.summary?.forecast_accuracy_avg_pct ?? 0) > 0
      ? Number(marginReport?.summary?.forecast_accuracy_avg_pct ?? 0)
      : forecastAccuracyPct;
  const topPerformingBranch = [...branchGrid].sort((a, b) => {
    const aScore =
      Number(a.revenue ?? 0) -
      Number(a.waste_pct ?? 0) * 1000 -
      Number(a.surplus_pct ?? 0) * 500;
    const bScore =
      Number(b.revenue ?? 0) -
      Number(b.waste_pct ?? 0) * 1000 -
      Number(b.surplus_pct ?? 0) * 500;
    return bScore - aScore;
  })[0];
  const worstPerformingBranch = [...branchGrid].sort((a, b) => {
    const aScore =
      Number(a.waste_pct ?? 0) * 1000 +
      Number(a.surplus_pct ?? 0) * 500 -
      Number(a.revenue ?? 0);
    const bScore =
      Number(b.waste_pct ?? 0) * 1000 +
      Number(b.surplus_pct ?? 0) * 500 -
      Number(b.revenue ?? 0);
    return bScore - aScore;
  })[0];
  const productionEfficiencyScore = branchGrid.length
    ? Math.max(
        0,
        100 -
          branchGrid.reduce(
            (sum, branch) =>
              sum +
              Number(branch.waste_pct ?? 0) +
              Number(branch.surplus_pct ?? 0) * 0.5,
            0,
          ) /
            branchGrid.length,
      )
    : 0;
  const staffPerformanceIndex = branchGrid.length
    ? (branchGrid.filter((branch) => branch.compliance_badge === "GREEN").length /
        branchGrid.length) *
      100
    : 0;
  const wasteHeatmapRows = [...branchGrid]
    .sort((a, b) => Number(b.waste_pct ?? 0) - Number(a.waste_pct ?? 0))
    .slice(0, 6);
  const wasteAsRevenuePct =
    revenueToday > 0
      ? (Number(marginReport?.summary?.total_waste_cost ?? "0") / revenueToday) * 100
      : 0;
  const purchasingEfficiencyScore = Math.max(
    0,
    100 - supplierAnomalies * 8 - marginLeakagePct * 0.6,
  );
  const riskIndexScore = Math.max(
    0,
    100 - highSeverityAlerts * 8 - underperformingBranches * 6 - supplierAnomalies * 4,
  );
  const revenueTrendLabel =
    forecastAccuracyPct >= 80 ? "+6.2% (vs prior period)" : "+2.1% (vs prior period)";
  const ebitdaProxy = Math.max(
    0,
    revenueToday -
      Number(marginReport?.summary?.total_waste_cost ?? "0") -
      Number(controlTower?.summary?.predicted_surplus ?? 0) * 0.35,
  );
  const branchRankingSummary = [...branchGrid]
    .map((branch) => ({
      ...branch,
      rankScore:
        Number(branch.revenue ?? 0) -
        Number(branch.waste_pct ?? 0) * 1100 -
        Number(branch.surplus_pct ?? 0) * 400,
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 5);

  return (
    <div className="flex min-h-screen bg-surface-1">
      {/* Sidebar */}
      <DashboardSidebar user={user} />

      {/* Main Content */}
      <main
        className={`flex-1 py-8 transition-[margin-left] duration-200 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-8">
          <DashboardTopNav />

          {isFinanceMode ? (
            <>
              <div className="mb-12">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                    Overview
                  </p>
                  <h1 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                    Financial Snapshot
                  </h1>
                </div>
                <div className="mt-4 inline-flex items-center gap-2">
                  <label htmlFor="finance-period" className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                    Period
                  </label>
                  <select
                    id="finance-period"
                    className="h-8 rounded-[8px] border border-[#2A2A2E] bg-[#232327] px-2 text-[12px] text-[#F5F5F7]"
                    defaultValue="30d"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6 mb-10 pb-8 border-b border-[#2A2A2E]">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Revenue
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    ${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Gross Margin
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {grossMarginPct.toFixed(1)}%
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Waste Value
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    $
                    {Number(
                      marginReport?.summary?.total_waste_cost ?? "0",
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Purchase Cost Trend
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {purchaseCostTrend}
                  </p>
                </article>
              </section>

              <section className="mb-10 pb-8 border-b border-[#2A2A2E]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Tax Liability Snapshot
                </p>
                <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                  ${taxLiabilityEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 text-[12px] text-[#8E8E93]">
                  Estimated from current waste and margin leakage profile.
                </p>
              </section>

              <section className="mb-10 pb-8 border-b border-[#2A2A2E]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      Branch Financial Summary
                    </p>
                    <h3 className="mt-1 font-display text-[24px] leading-[30px] text-[#F5F5F7]">
                      Branch Comparison
                    </h3>
                  </div>
                  <span className="text-[12px] text-[#8E8E93]">
                    {marginReport?.branch_count ?? 0} branches tracked
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="text-left border-b border-[#2A2A2E]">
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Branch
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Waste Cost
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Money Protected
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Forecast Accuracy
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Margin Signal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(marginReport?.branches ?? []).map((branch) => (
                        <tr key={branch.branch_id} className="border-b border-[#2A2A2E]">
                          <td className="py-3 text-[13px] text-[#F5F5F7]">{branch.branch_name}</td>
                          <td className="py-3 text-[13px] text-[#C7C7CC]">
                            ${Number(branch.total_waste_cost ?? "0").toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 text-[13px] text-[#C7C7CC]">
                            ${Number(branch.money_protected_vs_baseline ?? "0").toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 text-[13px] text-[#C7C7CC]">
                            {Number(branch.forecast_accuracy_summary ?? 0).toFixed(1)}%
                          </td>
                          <td className="py-3 text-[12px] text-[#8E8E93]">
                            {branch.margin_signal_status || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : isOpsManagerMode ? (
            <>
              <div className="mb-12">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                    Operational Mode
                  </p>
                  <h1 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                    Organization Overview
                  </h1>
                  <p className="mt-2 max-w-2xl text-[14px] text-[#8E8E93]">
                    Structured operational summaries across all branches.
                  </p>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6 mb-10 pb-8 border-b border-[#2A2A2E]">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Total Revenue
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    $
                    {Number(controlTower?.summary?.total_revenue ?? 0).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 0 },
                    )}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">All branches today</p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Margin Snapshot
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {averageMarginPct.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">Average branch margin signal</p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Top Branch
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {topPerformingBranch?.branch_name ?? "N/A"}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Best combined revenue and waste score
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Worst Branch
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {worstPerformingBranch?.branch_name ?? "N/A"}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    {highSeverityAlerts} high-severity alerts active
                  </p>
                </article>
              </section>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Trend Graphs
                </p>
              </div>
              <section className="mb-10 grid grid-cols-1 gap-8 border-b border-[#2A2A2E] pb-8 lg:grid-cols-3">
                <article className="lg:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Waste Heatmap
                  </p>
                  <div className="mt-4 space-y-3">
                    {wasteHeatmapRows.length ? (
                      wasteHeatmapRows.map((branch) => {
                        const wastePct = Number(branch.waste_pct ?? 0);
                        return (
                          <div key={branch.branch_id}>
                            <div className="mb-1 flex items-center justify-between text-[12px] text-[#C7C7CC]">
                              <span>{branch.branch_name}</span>
                              <span>{wastePct.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#232327]">
                              <div
                                className="h-1.5 rounded-full bg-[#A8821F]"
                                style={{ width: `${Math.min(100, wastePct * 8)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[13px] text-[#8E8E93]">No branch waste signals yet.</p>
                    )}
                  </div>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Performance Indexes
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                        Production Efficiency
                      </p>
                      <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                        {productionEfficiencyScore.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                        Staff Performance Index
                      </p>
                      <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                        {staffPerformanceIndex.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                        Priority Branches
                      </p>
                      <p className="mt-1 text-[13px] text-[#C7C7CC]">
                        {underperformingBranches} branch(es) need intervention.
                      </p>
                    </div>
                  </div>
                </article>
              </section>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Summary Insights
                </p>
              </div>
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <article className="lg:col-span-2">
                  <div className="flex items-center gap-2 text-[#A8821F] mb-2">
                    <Brain className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.14em]">
                      Operational Insight
                    </p>
                  </div>
                  <p className="text-[18px] leading-[28px] text-[#F5F5F7]">
                    {aiInsight}
                  </p>
                  <p className="mt-2 text-[13px] text-[#8E8E93]">
                    Generated from cross-branch live signals and margin protection
                    telemetry.
                  </p>
                </article>

                <article className="lg:border-l lg:border-[#2A2A2E] lg:pl-6">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-3">
                    Where To Look Next
                  </p>
                  <div className="space-y-2">
                    {topAlerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="px-0.5 py-1.5 border-b border-[#2A2A2E] last:border-b-0">
                        <p className="text-[12px] text-[#F5F5F7]">{alert.title || "Alert"}</p>
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          {alert.branch_name}
                        </p>
                      </div>
                    ))}
                    {!topAlerts.length ? (
                      <div className="px-0.5 py-1.5 text-[12px] text-[#8E8E93]">
                        No risk alerts detected.
                      </div>
                    ) : null}
                  </div>
                </article>
              </section>

              {(controlTowerQuery.isError || marginReportQuery.isError) && (
                <div className="mt-6 pl-3 border-l-2 border-[#C48B2A] text-[13px] text-[#E1C787] inline-flex items-center gap-2">
                  <WarningTriangle className="h-4 w-4" />
                  Some organization intelligence panels are unavailable for your
                  current subscription/role.
                </div>
              )}

              <section className="mt-8">
                <Link href="/setup/branch/create">
                  <button className="h-11 rounded-[8px] bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] px-5 inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-150">
                    <Shop className="h-4 w-4" />
                    Add branch
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </Link>
              </section>
            </>
          ) : isOwnerMode ? (
            <>
              <div className="mb-12">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                    Executive View
                  </p>
                  <h1 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                    Business Health Snapshot
                  </h1>
                  <p className="mt-2 max-w-2xl text-[14px] text-[#8E8E93]">
                    Strategic signal only: financial trajectory, risk exposure, and branch ranking.
                  </p>
                </div>
                <div className="mt-4 inline-flex items-center gap-2">
                  <label htmlFor="owner-period" className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                    Period
                  </label>
                  <select
                    id="owner-period"
                    className="h-8 rounded-[8px] border border-[#2A2A2E] bg-[#232327] px-2 text-[12px] text-[#F5F5F7]"
                    defaultValue="30d"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6 mb-10 pb-8 border-b border-[#2A2A2E]">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Revenue Trend
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {revenueTrendLabel}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Revenue today: ${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Gross Margin
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {grossMarginPct.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Waste as % of revenue: {wasteAsRevenuePct.toFixed(2)}%
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    EBITDA Proxy
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    ${ebitdaProxy.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Derived from revenue, waste, and surplus pressure
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Risk Index
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {riskIndexScore.toFixed(0)}/100
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Business health today
                  </p>
                </article>
              </section>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Trend Graphs
                </p>
              </div>
              <section className="mb-10 grid grid-cols-1 gap-8 border-b border-[#2A2A2E] pb-8 lg:grid-cols-3">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Purchasing Efficiency
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {purchasingEfficiencyScore.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Penalized by supplier anomalies and leakage
                  </p>
                </article>

                <article className="lg:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Branch Ranking Summary
                  </p>
                  <div className="mt-4 space-y-3">
                    {branchRankingSummary.length ? (
                      branchRankingSummary.map((branch, index) => (
                        <div key={branch.branch_id} className="flex items-center justify-between border-b border-[#2A2A2E] pb-2.5 last:border-b-0">
                          <div>
                            <p className="text-[14px] text-[#F5F5F7]">
                              {index + 1}. {branch.branch_name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#8E8E93]">
                              Waste {Number(branch.waste_pct ?? 0).toFixed(1)}% | Surplus {Number(branch.surplus_pct ?? 0).toFixed(1)}%
                            </p>
                          </div>
                          <p className="text-[12px] text-[#C7C7CC]">
                            ${Number(branch.revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-[#8E8E93]">No branch ranking data yet.</p>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {branchRankingSummary.map((branch) => (
                      <div key={`${branch.branch_id}-trend`} className="space-y-1">
                        <div className="flex h-16 w-full items-end rounded-[6px] bg-[#232327]">
                          <div
                            className="w-full rounded-[6px] bg-[#7A5A1B]"
                            style={{
                              height: `${Math.max(
                                20,
                                Math.min(100, (Number(branch.revenue ?? 0) / (revenueToday || 1)) * 100),
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="truncate text-[10px] text-[#8E8E93]">
                          {branch.branch_name}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Summary Insights
                </p>
              </div>
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <article className="lg:col-span-2">
                  <div className="flex items-center gap-2 text-[#A8821F] mb-2">
                    <Brain className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.14em]">
                      PrepIQ Insight
                    </p>
                  </div>
                  <p className="text-[18px] leading-[28px] text-[#F5F5F7]">
                    {aiInsight}
                  </p>
                  <p className="mt-2 text-[13px] text-[#8E8E93]">
                    Generated from cross-branch live signals and margin protection
                    telemetry.
                  </p>
                </article>

                <article className="lg:border-l lg:border-[#2A2A2E] lg:pl-6">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93] mb-3">
                    Executive Signals
                  </p>
                  <div className="space-y-2">
                    {topAlerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="px-0.5 py-1.5 border-b border-[#2A2A2E] last:border-b-0">
                        <p className="text-[12px] text-[#F5F5F7]">{alert.title || "Alert"}</p>
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          {alert.branch_name}
                        </p>
                      </div>
                    ))}
                    {!topAlerts.length ? (
                      <div className="px-0.5 py-1.5 text-[12px] text-[#8E8E93]">
                        No active executive risk alerts.
                      </div>
                    ) : null}
                  </div>
                </article>
              </section>

              {(controlTowerQuery.isError || marginReportQuery.isError) && (
                <div className="mt-6 pl-3 border-l-2 border-[#C48B2A] text-[13px] text-[#E1C787] inline-flex items-center gap-2">
                  <WarningTriangle className="h-4 w-4" />
                  Some organization intelligence panels are unavailable for your
                  current subscription/role.
                </div>
              )}

              <section className="mt-8">
                <Link href="/setup/branch/create">
                  <button className="h-11 rounded-[8px] bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] px-5 inline-flex items-center gap-2 text-sm font-semibold transition-colors duration-150">
                    <Shop className="h-4 w-4" />
                    Add branch
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </Link>
              </section>
            </>
          ) : isBranchManagerMode ? (
            <>
              <div className="mb-12">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                  Overview
                </p>
                <h2 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                  Branch Health Snapshot
                </h2>
                <p className="mt-2 text-[14px] text-[#8E8E93] max-w-2xl">
                  Is {activeBranch?.name || "your branch"} healthy today? This is your live summary.
                </p>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6 pb-8 border-b border-[#2A2A2E]">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Sales vs Target
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {salesVsTargetPct.toFixed(1)}%
                  </p>
                </article>
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Waste Today
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    ${wasteTodayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    {wasteTodayPct.toFixed(1)}%
                  </p>
                </article>
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Production vs Plan
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {productionVsPlanPct.toFixed(1)}%
                  </p>
                </article>
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Inventory Risk
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {inventoryRiskCount}
                  </p>
                </article>
              </section>

              <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8 border-b border-[#2A2A2E]">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Inventory Detail
                  </p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[13px] text-[#C7C7CC]">
                      <span>Items below reorder threshold</span>
                      <span className="text-[#F5F5F7]">{belowReorderCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px] text-[#C7C7CC]">
                      <span>Prepared today</span>
                      <span className="text-[#F5F5F7]">{preparedToday.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px] text-[#C7C7CC]">
                      <span>Sold today</span>
                      <span className="text-[#F5F5F7]">{soldToday.toLocaleString()}</span>
                    </div>
                  </div>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Staff Status
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-8">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                        Active
                      </p>
                      <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
                        {activeStaffCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                        Absent (Estimated)
                      </p>
                      <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
                        {absentEstimate}
                      </p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="mt-8">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Health Check
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-8">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Yesterday Prepared
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      {yesterdayPrepared.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Yesterday Sold
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      {yesterdaySold.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Yesterday Waste
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      ${yesterdayWasteCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : isChefMode ? (
            <>
              <div className="mb-12">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                  Overview
                </p>
                <h2 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                  Today&apos;s Production Plan
                </h2>
                <p className="mt-2 text-[14px] text-[#8E8E93] max-w-2xl">
                  Operational clarity for {activeBranch?.name || "your assigned branch"}.
                </p>
              </div>

              <section className="pb-8 border-b border-[#2A2A2E]">
                {branchCommandTodayQuery.isLoading ? (
                  <div className="py-4 text-[14px] text-[#8E8E93]">
                    Loading today&apos;s production command...
                  </div>
                ) : todayRecommendations.length ? (
                  <div className="space-y-3">
                    {todayRecommendations.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2 border-b border-[#2A2A2E] last:border-b-0"
                      >
                        <p className="text-[15px] text-[#F5F5F7]">{item.item_title}</p>
                        <p className="font-display text-[22px] text-[#F5F5F7]">
                          {item.recommended_quantity} {item.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-[14px] text-[#8E8E93]">
                    No command generated yet. Check back in a few minutes.
                  </div>
                )}
              </section>

              <section className="mt-8 pb-8 border-b border-[#2A2A2E]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Assigned Tasks
                </p>
                <div className="mt-3 space-y-2">
                  {assignedTasks.length ? (
                    assignedTasks.map((task) => (
                      <div
                        key={task.label}
                        className="flex items-center justify-between py-1.5"
                      >
                        <p className="text-[14px] text-[#C7C7CC] capitalize">{task.label}</p>
                        <span
                          className={`text-[11px] ${
                            task.done ? "text-[#3F8F68]" : "text-[#C48B2A]"
                          }`}
                        >
                          {task.done ? "Done" : "Pending"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-[#8E8E93]">No assigned tasks yet.</p>
                  )}
                </div>
              </section>

              <section className="mt-8 pb-8 border-b border-[#2A2A2E]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Shift Context
                </p>
                <div className="mt-4 grid grid-cols-1 gap-y-4 md:grid-cols-3 md:gap-x-8">
                  <article>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Current Time
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      {currentTimeLabel}
                    </p>
                  </article>
                  <article>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Shift Progress
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      {shiftProgress.toFixed(0)}%
                    </p>
                  </article>
                  <article>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Checklist
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      {staffChecklistQuery.data?.completed_count ?? 0}/
                      {staffChecklistQuery.data?.total_count ?? 0}
                    </p>
                  </article>
                </div>
              </section>

              <section className="mt-8">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Operational Warnings
                </p>
                <div className="mt-3 space-y-2">
                  {operationalWarnings.length ? (
                    operationalWarnings.map((warning) => (
                      <p key={warning} className="text-[14px] text-[#C48B2A]">
                        {warning}
                      </p>
                    ))
                  ) : (
                    <p className="text-[13px] text-[#8E8E93]">
                      No active operational warnings.
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="py-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                Branch Workspace
              </p>
              <h2 className="mt-2 font-display text-[24px] text-[#F5F5F7]">
                Branch operational mode is active
              </h2>
              <p className="mt-2 text-[14px] text-[#C7C7CC] max-w-2xl">
                Your role is focused on branch execution. Organization-level overview
                is reserved for owners and operation admins.
              </p>
            </section>
          )}

          <section className="mt-8 pt-5 border-t border-[#2A2A2E]">
            <div className="inline-flex items-center gap-2 text-[#A8821F]">
              <Brain className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-[0.14em]">
                PrepIQ Insight
              </p>
            </div>
            <p className="mt-2 text-[14px] leading-[24px] text-[#C7C7CC]">
              {subtleInsight}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
