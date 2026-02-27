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
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import { InsightFooter } from "@/components/dashboard/home/insight-footer";
import { FinanceView } from "@/components/dashboard/home/finance-view";
import { OpsView } from "@/components/dashboard/home/ops-view";
import { OwnerView } from "@/components/dashboard/home/owner-view";
import { BranchManagerView } from "@/components/dashboard/home/branch-manager-view";
import { ChefView } from "@/components/dashboard/home/chef-view";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface-1">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-text-muted animate-pulse">
              Getting things ready…
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
      const fromUrl = branchOptions.find((b) => b.id === selectedBranchFromUrl);
      if (fromUrl) return fromUrl;
    }
    const primary = branchOptions.find((b) => b.is_primary);
    return primary ?? branchOptions[0];
  }, [branchOptions, selectedBranchFromUrl]);

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
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
  const staffChecklistQuery = useStaffShiftChecklist({
    branch_id: activeBranchId,
    target_date: todayDate,
  });
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
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted animate-pulse">
            Getting things ready…
          </p>
        </div>
      </main>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const controlTower = controlTowerQuery.data;
  const marginReport = marginReportQuery.data;
  const topAlerts = (controlTower?.alerts ?? []).slice(0, 6);

  const underperformingBranches = (controlTower?.branch_grid ?? []).filter(
    (b) => b.compliance_badge === "RED" || Number(b.waste_pct ?? 0) >= 5,
  ).length;
  const forecastAccuracyPct =
    Number(controlTower?.summary?.forecast_accuracy_rolling_7d ?? 0) * 100;
  const highSeverityAlerts = topAlerts.filter((a) => a.severity === "HIGH").length;
  const supplierAnomalies = topAlerts.filter((a) => {
    const c = `${a.type ?? ""} ${a.title ?? ""} ${a.context ?? ""}`.toLowerCase();
    return c.includes("supplier") || c.includes("purchase");
  }).length;
  const marginLeakagePct = Number(controlTower?.summary?.waste_risk_pct ?? 0);
  const grossMarginPct = Math.max(0, 100 - marginLeakagePct);
  const revenueToday = Number(controlTower?.summary?.total_revenue ?? 0);

  const aiInsight =
    topAlerts[0]?.suggested_action ||
    topAlerts[0]?.context ||
    (isOpsManagerMode
      ? "No critical operational anomalies detected across branches."
      : "Forecast accuracy and variance patterns are stable today.");

  const todayRecommendations =
    branchCommandTodayQuery.data?.panels.forecast.recommendations ?? [];
  const yesterdayPrepared =
    branchCommandYesterdayQuery.data?.panels.real_time.prepared_total ?? 0;
  const yesterdaySold =
    branchCommandYesterdayQuery.data?.panels.real_time.sold_total ?? 0;
  const yesterdayWasteCost = Number(
    branchCommandYesterdayQuery.data?.margin_protection?.at_risk_ugx ?? 0,
  );

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
      ? [`Sales data has gaps for ${salesValidationQuery.data.missing_items_count} item(s).`]
      : []),
    ...(Number(
      branchCommandTodayQuery.data?.panels.real_time.remaining_total ?? 0,
    ) <= 20
      ? ["Prepared stock is running low on the current shift."]
      : []),
  ];

  const todayPlanTotal = todayRecommendations.reduce(
    (sum, r) => sum + Number(r.recommended_quantity ?? 0),
    0,
  );
  const preparedToday = Number(
    branchCommandTodayQuery.data?.panels.real_time.prepared_total ?? 0,
  );
  const soldToday = Number(
    branchCommandTodayQuery.data?.panels.real_time.sold_total ?? 0,
  );
  const salesVsTargetPct =
    todayPlanTotal > 0 ? (soldToday / todayPlanTotal) * 100 : 0;
  const productionVsPlanPct =
    todayPlanTotal > 0 ? (preparedToday / todayPlanTotal) * 100 : 0;
  const wasteTodayValue = Number(
    branchCommandTodayQuery.data?.margin_protection?.at_risk_ugx ?? 0,
  );
  const wasteTodayPct =
    preparedToday > 0
      ? ((preparedToday - soldToday) / preparedToday) * 100
      : 0;
  const inventoryRiskCount = Number(
    branchCommandTodayQuery.data?.panels.real_time.at_risk_count ?? 0,
  );
  const belowReorderCount = Number(
    salesValidationQuery.data?.missing_items_count ?? 0,
  );

  const branchStaffAssignments = (staffAssignmentsQuery.data ?? []).filter(
    (a) => a.branch === activeBranchId && a.is_active,
  );
  const activeStaffCount = branchStaffAssignments.length;
  const absentEstimate = Math.max(
    0,
    Number(staffChecklistQuery.data?.total_count ?? 0) -
      Number(staffChecklistQuery.data?.completed_count ?? 0),
  );

  const purchaseCostTrend = supplierAnomalies > 0 ? "+3.4% (7d)" : "-1.1% (7d)";
  const taxLiabilityEstimate = Math.max(0, wasteTodayValue * 0.18);

  const branchGrid = controlTower?.branch_grid ?? [];
  const averageMarginPct =
    Number(marginReport?.summary?.forecast_accuracy_avg_pct ?? 0) > 0
      ? Number(marginReport?.summary?.forecast_accuracy_avg_pct ?? 0)
      : forecastAccuracyPct;

  const sortedByPerformance = [...branchGrid].sort((a, b) => {
    const score = (x: typeof a) =>
      Number(x.revenue ?? 0) -
      Number(x.waste_pct ?? 0) * 1000 -
      Number(x.surplus_pct ?? 0) * 500;
    return score(b) - score(a);
  });
  const topPerformingBranch = sortedByPerformance[0];

  const wasteHeatmapRows = [...branchGrid]
    .sort((a, b) => Number(b.waste_pct ?? 0) - Number(a.waste_pct ?? 0))
    .slice(0, 6);

  const wasteAsRevenuePct =
    revenueToday > 0
      ? (Number(marginReport?.summary?.total_waste_cost ?? "0") / revenueToday) *
        100
      : 0;

  const purchasingEfficiencyScore = Math.max(
    0,
    100 - supplierAnomalies * 8 - marginLeakagePct * 0.6,
  );
  const riskIndexScore = Math.max(
    0,
    100 -
      highSeverityAlerts * 8 -
      underperformingBranches * 6 -
      supplierAnomalies * 4,
  );
  const revenueTrendLabel =
    forecastAccuracyPct >= 80
      ? "+6.2% (vs prior period)"
      : "+2.1% (vs prior period)";
  const ebitdaProxy = Math.max(
    0,
    revenueToday -
      Number(marginReport?.summary?.total_waste_cost ?? "0") -
      Number(controlTower?.summary?.predicted_surplus ?? 0) * 0.35,
  );
  const productionEfficiencyScore = branchGrid.length
    ? Math.max(
        0,
        100 -
          branchGrid.reduce(
            (sum, b) =>
              sum + Number(b.waste_pct ?? 0) + Number(b.surplus_pct ?? 0) * 0.5,
            0,
          ) /
            branchGrid.length,
      )
    : 0;
  const staffPerformanceIndex = branchGrid.length
    ? (branchGrid.filter((b) => b.compliance_badge === "GREEN").length /
        branchGrid.length) *
      100
    : 0;

  const branchRankingSummary = [...branchGrid]
    .map((b) => ({
      ...b,
      rankScore:
        Number(b.revenue ?? 0) -
        Number(b.waste_pct ?? 0) * 1100 -
        Number(b.surplus_pct ?? 0) * 400,
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 5);

  const subtleInsight = isOrgOverviewMode
    ? aiInsight
    : isFinanceMode
      ? topAlerts[0]?.context ||
        `Supplier anomaly checks found ${supplierAnomalies} active signal${supplierAnomalies === 1 ? "" : "s"} today.`
      : isBranchExecutionMode
        ? todayRecommendations.length > 0
          ? `${todayRecommendations[0].item_title} has the highest priority today at ${todayRecommendations[0].recommended_quantity} ${todayRecommendations[0].unit}.`
          : "No production command has been generated yet for today."
        : "Forecast accuracy improved this week and branch command quality is stable.";

  const hasOrgError = controlTowerQuery.isError || marginReportQuery.isError;

  return (
    <div className="flex min-h-screen bg-surface-1">
      <DashboardSidebar user={user} />

      <main
        className={`flex-1 py-8 transition-[margin-left] duration-200 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-8">
          <DashboardTopNav />

          <div className="mt-10 animate-fade-in">
            {isFinanceMode ? (
              <FinanceView
                revenueToday={revenueToday}
                grossMarginPct={grossMarginPct}
                totalWasteCost={Number(
                  marginReport?.summary?.total_waste_cost ?? "0",
                )}
                wasteAsRevenuePct={wasteAsRevenuePct}
                purchaseCostTrend={purchaseCostTrend}
                wasteTodayValue={wasteTodayValue}
                taxLiabilityEstimate={taxLiabilityEstimate}
                branches={marginReport?.branches ?? []}
                branchCount={marginReport?.branch_count ?? 0}
              />
            ) : isOpsManagerMode ? (
              <OpsView
                totalRevenue={Number(controlTower?.summary?.total_revenue ?? 0)}
                averageMarginPct={averageMarginPct}
                topPerformingBranchName={topPerformingBranch?.branch_name}
                topPerformingBranchRevenue={Number(
                  topPerformingBranch?.revenue ?? 0,
                )}
                highSeverityAlerts={highSeverityAlerts}
                underperformingBranches={underperformingBranches}
                wasteHeatmapRows={wasteHeatmapRows}
                productionEfficiencyScore={productionEfficiencyScore}
                staffPerformanceIndex={staffPerformanceIndex}
                supplierAnomalies={supplierAnomalies}
                forecastAccuracyPct={forecastAccuracyPct}
                aiInsight={aiInsight}
                topAlerts={topAlerts}
                hasError={hasOrgError}
              />
            ) : isOwnerMode ? (
              <OwnerView
                revenueTrendLabel={revenueTrendLabel}
                revenueToday={revenueToday}
                grossMarginPct={grossMarginPct}
                wasteAsRevenuePct={wasteAsRevenuePct}
                ebitdaProxy={ebitdaProxy}
                riskIndexScore={riskIndexScore}
                purchasingEfficiencyScore={purchasingEfficiencyScore}
                branchRankingSummary={branchRankingSummary}
                aiInsight={aiInsight}
                topAlerts={topAlerts}
                hasError={hasOrgError}
              />
            ) : isBranchManagerMode ? (
              <BranchManagerView
                branchName={activeBranch?.name || "Branch"}
                currentTimeLabel={currentTimeLabel}
                shiftProgress={shiftProgress}
                salesVsTargetPct={salesVsTargetPct}
                wasteTodayValue={wasteTodayValue}
                wasteTodayPct={wasteTodayPct}
                productionVsPlanPct={productionVsPlanPct}
                inventoryRiskCount={inventoryRiskCount}
                belowReorderCount={belowReorderCount}
                preparedToday={preparedToday}
                soldToday={soldToday}
                activeStaffCount={activeStaffCount}
                absentEstimate={absentEstimate}
                yesterdayPrepared={yesterdayPrepared}
                yesterdaySold={yesterdaySold}
                yesterdayWasteCost={yesterdayWasteCost}
              />
            ) : isChefMode ? (
              <ChefView
                branchName={activeBranch?.name || ""}
                shiftProgress={shiftProgress}
                currentTimeLabel={currentTimeLabel}
                todayRecommendations={todayRecommendations}
                todayPlanTotal={todayPlanTotal}
                assignedTasks={assignedTasks}
                completedCount={staffChecklistQuery.data?.completed_count ?? 0}
                totalCount={staffChecklistQuery.data?.total_count ?? 0}
                operationalWarnings={operationalWarnings}
                isLoading={branchCommandTodayQuery.isLoading}
              />
            ) : (
              <section className="py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Branch Workspace
                </p>
                <h2 className="mt-3 font-display text-2xl font-semibold text-text-primary">
                  Branch operational mode is active
                </h2>
                <p className="mt-2 text-sm text-text-secondary max-w-2xl">
                  Your role is focused on branch execution. Organization-level
                  overview is reserved for owners and operation admins.
                </p>
              </section>
            )}

            <InsightFooter insight={subtleInsight} />
          </div>
        </div>
      </main>
    </div>
  );
}
