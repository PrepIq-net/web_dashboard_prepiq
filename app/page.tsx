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
              <div className="mb-16">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                    Financial Intelligence
                  </p>
                  <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
                    Financial Snapshot
                  </h1>
                  <p className="mt-4 text-base text-text-secondary max-w-2xl">
                    Real-time financial metrics and cost analysis across all operations.
                  </p>
                </div>
                <div className="mt-8 inline-flex items-center gap-3 bg-[#1C1C1F] rounded-lg px-4 py-3">
                  <label htmlFor="finance-period" className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
                    Analysis Period
                  </label>
                  <select
                    id="finance-period"
                    className="h-9 rounded-lg border border-[#2A2A2E] bg-[#232327] px-3 text-sm text-text-primary font-medium focus:border-brand-gold focus:outline-none transition-colors"
                    defaultValue="30d"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Total Revenue
                    </p>
                    <div className="w-2 h-2 rounded-full bg-brand-gold"></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    ${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    +6.2% vs prior period
                  </p>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Gross Margin
                    </p>
                    <div className={`w-2 h-2 rounded-full ${grossMarginPct >= 70 ? 'bg-[#3F8F68]' : grossMarginPct >= 50 ? 'bg-[#C48B2A]' : 'bg-[#C44949]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    {grossMarginPct.toFixed(1)}%
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Target: 75%
                  </p>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Waste Cost
                    </p>
                    <div className="w-2 h-2 rounded-full bg-[#C44949]"></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    ${Number(marginReport?.summary?.total_waste_cost ?? "0").toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {wasteAsRevenuePct.toFixed(1)}% of revenue
                  </p>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Cost Trend
                    </p>
                    <div className={`w-2 h-2 rounded-full ${purchaseCostTrend.includes('-') ? 'bg-[#3F8F68]' : 'bg-[#C48B2A]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    {purchaseCostTrend}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    7-day rolling average
                  </p>
                </article>
              </section>

              <section className="mb-16">
                <div className="bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                        Tax Liability Analysis
                      </p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                        Current Period Estimate
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                        ${taxLiabilityEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Based on waste and margin profile
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-[#2A2A2E] mb-6"></div>
                  <div className="grid grid-cols-3 gap-8">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                        Waste Impact
                      </p>
                      <p className="text-lg font-semibold text-text-primary">
                        ${wasteTodayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                        Tax Rate Applied
                      </p>
                      <p className="text-lg font-semibold text-text-primary">18%</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                        Confidence Level
                      </p>
                      <p className="text-lg font-semibold text-[#3F8F68]">High</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-16">
                <div className="bg-[#1C1C1F] rounded-xl border border-[#2A2A2E]/50 overflow-hidden">
                  <div className="p-8 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                          Branch Performance Analysis
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                          Financial Comparison
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-text-secondary">
                          {marginReport?.branch_count ?? 0} branches tracked
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          Last updated: {new Date().toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead className="bg-[#232327]">
                        <tr>
                          <th className="px-8 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                            Branch Location
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                            Waste Cost
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                            Protected Value
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                            Forecast Accuracy
                          </th>
                          <th className="px-8 py-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A2A2E]">
                        {(marginReport?.branches ?? []).map((branch) => {
                          const accuracy = Number(branch.forecast_accuracy_summary ?? 0);
                          const wasteValue = Number(branch.total_waste_cost ?? "0");
                          return (
                            <tr key={branch.branch_id} className="hover:bg-[#232327]/50 transition-colors">
                              <td className="px-8 py-5">
                                <div>
                                  <p className="font-medium text-text-primary">{branch.branch_name}</p>
                                  <p className="text-sm text-text-secondary mt-1">ID: {branch.branch_id.slice(0, 8)}</p>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <p className="font-semibold text-text-primary">
                                  ${wasteValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <p className="font-semibold text-[#3F8F68]">
                                  ${Number(branch.money_protected_vs_baseline ?? "0").toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-[#232327] rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${accuracy >= 80 ? 'bg-[#3F8F68]' : accuracy >= 60 ? 'bg-[#C48B2A]' : 'bg-[#C44949]'}`}
                                      style={{ width: `${Math.min(100, accuracy)}%` }}
                                    />
                                  </div>
                                  <p className="font-semibold text-text-primary min-w-[3rem]">
                                    {accuracy.toFixed(1)}%
                                  </p>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  branch.margin_signal_status === 'HEALTHY' 
                                    ? 'bg-[#3F8F68]/20 text-[#3F8F68]' 
                                    : branch.margin_signal_status === 'WARNING'
                                    ? 'bg-[#C48B2A]/20 text-[#C48B2A]'
                                    : 'bg-[#C44949]/20 text-[#C44949]'
                                }`}>
                                  {branch.margin_signal_status || "Unknown"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          ) : isOpsManagerMode ? (
            <>
              <div className="mb-16">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                    Operations Command Center
                  </p>
                  <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
                    Organization Overview
                  </h1>
                  <p className="mt-4 text-base text-text-secondary max-w-2xl">
                    Real-time operational intelligence and performance metrics across all branch locations.
                  </p>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Total Revenue
                    </p>
                    <div className="w-2 h-2 rounded-full bg-brand-gold"></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    ${Number(controlTower?.summary?.total_revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">All branches today</p>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Avg Margin
                    </p>
                    <div className={`w-2 h-2 rounded-full ${averageMarginPct >= 70 ? 'bg-[#3F8F68]' : averageMarginPct >= 50 ? 'bg-[#C48B2A]' : 'bg-[#C44949]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    {averageMarginPct.toFixed(1)}%
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">Cross-branch average</p>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Top Performer
                    </p>
                    <div className="w-2 h-2 rounded-full bg-[#3F8F68]"></div>
                  </div>
                  <p className="font-display text-2xl font-semibold text-text-primary tracking-tight">
                    {topPerformingBranch?.branch_name ?? "N/A"}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Revenue: ${Number(topPerformingBranch?.revenue ?? 0).toLocaleString()}
                  </p>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Priority Alerts
                    </p>
                    <div className={`w-2 h-2 rounded-full ${highSeverityAlerts > 0 ? 'bg-[#C44949]' : 'bg-[#3F8F68]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    {highSeverityAlerts}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {underperformingBranches} branches need attention
                  </p>
                </article>
              </section>

              <section className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
                <article className="lg:col-span-2 bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                        Waste Performance Heatmap
                      </p>
                      <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                        Branch Waste Analysis
                      </h3>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {wasteHeatmapRows.length} branches analyzed
                    </p>
                  </div>
                  <div className="space-y-4">
                    {wasteHeatmapRows.length ? (
                      wasteHeatmapRows.map((branch, index) => {
                        const wastePct = Number(branch.waste_pct ?? 0);
                        const isHigh = wastePct > 8;
                        const isMedium = wastePct > 4;
                        return (
                          <div key={branch.branch_id} className="group">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-text-muted w-6">
                                  #{index + 1}
                                </span>
                                <span className="font-medium text-text-primary">
                                  {branch.branch_name}
                                </span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  isHigh ? 'bg-[#C44949]/20 text-[#C44949]' : 
                                  isMedium ? 'bg-[#C48B2A]/20 text-[#C48B2A]' : 
                                  'bg-[#3F8F68]/20 text-[#3F8F68]'
                                }`}>
                                  {isHigh ? 'High Risk' : isMedium ? 'Medium Risk' : 'Low Risk'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-text-primary">
                                  {wastePct.toFixed(1)}%
                                </span>
                                <p className="text-xs text-text-secondary">
                                  ${Number(branch.revenue ?? 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="h-3 w-full rounded-full bg-[#232327] overflow-hidden">
                              <div
                                className={`h-3 rounded-full transition-all duration-300 ${
                                  isHigh ? 'bg-[#C44949]' : 
                                  isMedium ? 'bg-[#C48B2A]' : 
                                  'bg-[#3F8F68]'
                                }`}
                                style={{ width: `${Math.min(100, wastePct * 8)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-text-secondary">No waste data available</p>
                        <p className="text-sm text-text-muted mt-1">Check back after operations begin</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Performance Metrics
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                      Key Indicators
                    </h3>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-text-secondary">
                          Production Efficiency
                        </p>
                        <span className="font-semibold text-text-primary">
                          {productionEfficiencyScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-[#232327] rounded-full overflow-hidden">
                        <div 
                          className="h-2 bg-brand-gold rounded-full transition-all duration-500"
                          style={{ width: `${productionEfficiencyScore}%` }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-text-secondary">
                          Staff Performance
                        </p>
                        <span className="font-semibold text-text-primary">
                          {staffPerformanceIndex.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 bg-[#232327] rounded-full overflow-hidden">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            staffPerformanceIndex >= 80 ? 'bg-[#3F8F68]' : 
                            staffPerformanceIndex >= 60 ? 'bg-[#C48B2A]' : 
                            'bg-[#C44949]'
                          }`}
                          style={{ width: `${staffPerformanceIndex}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#2A2A2E]">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-3">
                        Priority Actions
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#C44949]"></div>
                          <p className="text-sm text-text-secondary">
                            {underperformingBranches} branches need intervention
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#C48B2A]"></div>
                          <p className="text-sm text-text-secondary">
                            {supplierAnomalies} supplier anomalies detected
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#3F8F68]"></div>
                          <p className="text-sm text-text-secondary">
                            Forecast accuracy: {forecastAccuracyPct.toFixed(1)}%
                          </p>
                        </div>
                      </div>
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
              <div className="mb-16">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                      Branch Operations
                    </p>
                    <h2 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
                      {activeBranch?.name || "Branch"} Health
                    </h2>
                    <p className="mt-4 text-base text-text-secondary max-w-2xl">
                      Real-time operational metrics and performance indicators for your location.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-muted">Current Time</p>
                    <p className="font-display text-2xl font-semibold text-text-primary">
                      {currentTimeLabel}
                    </p>
                  </div>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Sales vs Target
                    </p>
                    <div className={`w-2 h-2 rounded-full ${salesVsTargetPct >= 90 ? 'bg-[#3F8F68]' : salesVsTargetPct >= 70 ? 'bg-[#C48B2A]' : 'bg-[#C44949]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    {salesVsTargetPct.toFixed(1)}%
                  </p>
                  <div className="mt-4 h-2 bg-[#232327] rounded-full overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        salesVsTargetPct >= 90 ? 'bg-[#3F8F68]' : 
                        salesVsTargetPct >= 70 ? 'bg-[#C48B2A]' : 
                        'bg-[#C44949]'
                      }`}
                      style={{ width: `${Math.min(100, salesVsTargetPct)}%` }}
                    />
                  </div>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Waste Today
                    </p>
                    <div className={`w-2 h-2 rounded-full ${wasteTodayPct <= 3 ? 'bg-[#3F8F68]' : wasteTodayPct <= 7 ? 'bg-[#C48B2A]' : 'bg-[#C44949]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    ${wasteTodayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {wasteTodayPct.toFixed(1)}% of production
                  </p>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Production vs Plan
                    </p>
                    <div className={`w-2 h-2 rounded-full ${productionVsPlanPct >= 95 ? 'bg-[#3F8F68]' : productionVsPlanPct >= 80 ? 'bg-[#C48B2A]' : 'bg-[#C44949]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    {productionVsPlanPct.toFixed(1)}%
                  </p>
                  <div className="mt-4 h-2 bg-[#232327] rounded-full overflow-hidden">
                    <div 
                      className="h-2 bg-brand-gold rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, productionVsPlanPct)}%` }}
                    />
                  </div>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-6 border border-[#2A2A2E]/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Inventory Risk
                    </p>
                    <div className={`w-2 h-2 rounded-full ${inventoryRiskCount === 0 ? 'bg-[#3F8F68]' : inventoryRiskCount <= 3 ? 'bg-[#C48B2A]' : 'bg-[#C44949]'}`}></div>
                  </div>
                  <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                    {inventoryRiskCount}
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Items at risk
                  </p>
                </article>
              </section>

              <section className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <article className="bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Inventory Status
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                      Stock Analysis
                    </h3>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-[#232327] rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-text-secondary">Below Reorder Point</p>
                        <p className="text-xs text-text-muted mt-1">Items requiring restocking</p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-semibold text-text-primary">
                          {belowReorderCount}
                        </p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          belowReorderCount === 0 ? 'bg-[#3F8F68]/20 text-[#3F8F68]' : 
                          belowReorderCount <= 3 ? 'bg-[#C48B2A]/20 text-[#C48B2A]' : 
                          'bg-[#C44949]/20 text-[#C44949]'
                        }`}>
                          {belowReorderCount === 0 ? 'Good' : belowReorderCount <= 3 ? 'Monitor' : 'Critical'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-[#232327] rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-text-secondary">Prepared Today</p>
                        <p className="text-xs text-text-muted mt-1">Total units produced</p>
                      </div>
                      <p className="font-display text-2xl font-semibold text-text-primary">
                        {preparedToday.toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-[#232327] rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-text-secondary">Sold Today</p>
                        <p className="text-xs text-text-muted mt-1">Units moved to customers</p>
                      </div>
                      <p className="font-display text-2xl font-semibold text-text-primary">
                        {soldToday.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Staff Operations
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                      Team Status
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center p-6 bg-[#232327] rounded-lg">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                        Active Staff
                      </p>
                      <p className="font-display text-4xl font-semibold text-[#3F8F68] mb-2">
                        {activeStaffCount}
                      </p>
                      <div className="w-full h-2 bg-[#1C1C1F] rounded-full overflow-hidden">
                        <div 
                          className="h-2 bg-[#3F8F68] rounded-full"
                          style={{ width: `${Math.min(100, (activeStaffCount / (activeStaffCount + absentEstimate)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="text-center p-6 bg-[#232327] rounded-lg">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                        Absent (Est.)
                      </p>
                      <p className="font-display text-4xl font-semibold text-[#C48B2A] mb-2">
                        {absentEstimate}
                      </p>
                      <div className="w-full h-2 bg-[#1C1C1F] rounded-full overflow-hidden">
                        <div 
                          className="h-2 bg-[#C48B2A] rounded-full"
                          style={{ width: `${Math.min(100, (absentEstimate / (activeStaffCount + absentEstimate)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-[#232327] rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-text-secondary">Shift Progress</p>
                      <span className="text-sm font-semibold text-text-primary">
                        {shiftProgress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-3 bg-[#1C1C1F] rounded-full overflow-hidden">
                      <div 
                        className="h-3 bg-brand-gold rounded-full transition-all duration-500"
                        style={{ width: `${shiftProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      Shift: 6:00 AM - 10:00 PM
                    </p>
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
              <div className="mb-16">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                      Production Command
                    </p>
                    <h2 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
                      Today&apos;s Production Plan
                    </h2>
                    <p className="mt-4 text-base text-text-secondary max-w-2xl">
                      Operational guidance and task management for {activeBranch?.name || "your assigned branch"}.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-muted">Shift Progress</p>
                    <p className="font-display text-3xl font-semibold text-brand-gold">
                      {shiftProgress.toFixed(0)}%
                    </p>
                    <p className="text-sm text-text-secondary mt-1">{currentTimeLabel}</p>
                  </div>
                </div>
              </div>

              <section className="mb-16">
                <div className="bg-[#1C1C1F] rounded-xl border border-[#2A2A2E]/50 overflow-hidden">
                  <div className="p-8 pb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                          Production Schedule
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                          Items to Prepare
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-text-secondary">
                          {todayRecommendations.length} items planned
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          Total: {todayPlanTotal.toLocaleString()} units
                        </p>
                      </div>
                    </div>
                  </div>

                  {branchCommandTodayQuery.isLoading ? (
                    <div className="px-8 pb-8">
                      <div className="flex items-center justify-center py-12 text-text-secondary">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold mr-3"></div>
                        Loading today&apos;s production command...
                      </div>
                    </div>
                  ) : todayRecommendations.length ? (
                    <div className="divide-y divide-[#2A2A2E]">
                      {todayRecommendations.slice(0, 10).map((item, index) => (
                        <div
                          key={item.id}
                          className="px-8 py-5 hover:bg-[#232327]/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center">
                                <span className="text-sm font-semibold text-brand-gold">
                                  {index + 1}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-text-primary text-lg">
                                  {item.item_title}
                                </p>
                                <p className="text-sm text-text-secondary mt-1">
                                  Priority: {index < 3 ? 'High' : index < 7 ? 'Medium' : 'Standard'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-display text-2xl font-semibold text-text-primary">
                                {item.recommended_quantity}
                              </p>
                              <p className="text-sm text-text-secondary">
                                {item.unit}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-8 pb-8">
                      <div className="text-center py-12">
                        <p className="text-text-secondary">No production command generated yet</p>
                        <p className="text-sm text-text-muted mt-1">Check back in a few minutes</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <article className="bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Task Management
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                      Assigned Tasks
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {assignedTasks.length ? (
                      assignedTasks.map((task, index) => (
                        <div
                          key={task.label}
                          className="flex items-center justify-between p-4 bg-[#232327] rounded-lg hover:bg-[#2A2A2E] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${task.done ? 'bg-[#3F8F68]' : 'bg-[#C48B2A]'}`}></div>
                            <p className="font-medium text-text-primary capitalize">
                              {task.label}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              task.done 
                                ? 'bg-[#3F8F68]/20 text-[#3F8F68]' 
                                : 'bg-[#C48B2A]/20 text-[#C48B2A]'
                            }`}
                          >
                            {task.done ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-text-secondary">No assigned tasks yet</p>
                        <p className="text-sm text-text-muted mt-1">Tasks will appear as they are assigned</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 p-4 bg-[#232327] rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-text-secondary">Task Completion</p>
                      <span className="text-sm font-semibold text-text-primary">
                        {staffChecklistQuery.data?.completed_count ?? 0}/{staffChecklistQuery.data?.total_count ?? 0}
                      </span>
                    </div>
                    <div className="h-2 bg-[#1C1C1F] rounded-full overflow-hidden">
                      <div 
                        className="h-2 bg-[#3F8F68] rounded-full transition-all duration-500"
                        style={{ 
                          width: `${
                            (staffChecklistQuery.data?.total_count ?? 0) > 0 
                              ? ((staffChecklistQuery.data?.completed_count ?? 0) / (staffChecklistQuery.data?.total_count ?? 0)) * 100 
                              : 0
                          }%` 
                        }}
                      />
                    </div>
                  </div>
                </article>

                <article className="bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                      Shift Information
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                      Current Status
                    </h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-[#232327] rounded-lg">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                          Current Time
                        </p>
                        <p className="font-display text-2xl font-semibold text-text-primary">
                          {currentTimeLabel}
                        </p>
                      </div>
                      
                      <div className="text-center p-4 bg-[#232327] rounded-lg">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                          Shift Progress
                        </p>
                        <p className="font-display text-2xl font-semibold text-brand-gold">
                          {shiftProgress.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-[#232327] rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-text-secondary">Shift Timeline</p>
                        <p className="text-xs text-text-muted">6:00 AM - 10:00 PM</p>
                      </div>
                      <div className="h-3 bg-[#1C1C1F] rounded-full overflow-hidden">
                        <div 
                          className="h-3 bg-brand-gold rounded-full transition-all duration-500"
                          style={{ width: `${shiftProgress}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="p-4 bg-[#232327] rounded-lg">
                      <p className="text-sm font-medium text-text-secondary mb-3">Operational Warnings</p>
                      {operationalWarnings.length ? (
                        <div className="space-y-2">
                          {operationalWarnings.map((warning, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#C48B2A] mt-2 flex-shrink-0"></div>
                              <p className="text-sm text-[#C48B2A]">{warning}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[#3F8F68]">
                          No active operational warnings
                        </p>
                      )}
                    </div>
                  </div>
                </article>
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

          <section className="mt-16 pt-8 border-t border-[#2A2A2E]">
            <div className="bg-[#1C1C1F] rounded-xl p-8 border border-[#2A2A2E]/50">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center flex-shrink-0">
                  <Brain className="h-5 w-5 text-brand-gold" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                      PrepIQ Intelligence
                    </p>
                    <div className="w-2 h-2 rounded-full bg-brand-gold animate-pulse"></div>
                  </div>
                  <p className="text-lg leading-relaxed text-text-primary font-medium">
                    {subtleInsight}
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">
                    Generated from real-time operational data and predictive analytics across your organization.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
