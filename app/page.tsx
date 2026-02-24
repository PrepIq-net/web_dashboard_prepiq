"use client";

import { useBranches, useCurrentUserProfile } from "@/services";
import {
  useBranchCommandView,
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useProductionIntelligenceAccessScope,
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
  const subtleInsight = isOrgOverviewMode
    ? aiInsight
    : isFinanceMode
      ? topAlerts[0]?.context ||
        `Supplier anomaly checks found ${supplierAnomalies} active signal${supplierAnomalies === 1 ? "" : "s"} today.`
      : isBranchExecutionMode
        ? branchInsight
        : "Forecast accuracy improved this week and branch command quality is stable.";

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
                    Financial Intelligence
                  </p>
                  <h1 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                    Profit Protection Command
                  </h1>
                </div>
              </div>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6 mb-10 pb-8 border-b border-[#2A2A2E]">
                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Waste Impact
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
                    Margin Leakage
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {marginLeakagePct.toFixed(1)}%
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Supplier Anomalies
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {supplierAnomalies}
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    Tax Certificate Automation
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    In Progress
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    Filing automation module staged
                  </p>
                </article>
              </section>

              <section className="mb-10 pb-8 border-b border-[#2A2A2E]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      Branch Financial Summary
                    </p>
                    <h3 className="mt-1 font-display text-[24px] leading-[30px] text-[#F5F5F7]">
                      Waste and Protection by Branch
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
          ) : isOrgOverviewMode ? (
            <>
              {/* Header Section */}
              <div className="mb-12">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                    {isOpsManagerMode ? "Operational Mode" : "Executive View"}
                  </p>
                  <h1 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                    {isOpsManagerMode
                      ? "Organization operations command"
                      : "Operations snapshot"}
                  </h1>
                </div>
              </div>

              {/* KPI Strip */}
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
                    Total Waste Cost
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    $
                    {Number(
                      marginReport?.summary?.total_waste_cost ?? "0",
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">Daily margin report</p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    {isOpsManagerMode ? "Forecast Accuracy Trend" : "Margin Impact"}
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {isOpsManagerMode
                      ? `${forecastAccuracyPct.toFixed(1)}%`
                      : `${Number(controlTower?.summary?.waste_risk_pct ?? 0).toFixed(1)}%`}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    {isOpsManagerMode
                      ? "Rolling 7-day forecast performance"
                      : "Waste risk across items"}
                  </p>
                </article>

                <article>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                    {isOpsManagerMode ? "Underperforming Branches" : "Risk Alerts"}
                  </p>
                  <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
                    {isOpsManagerMode ? underperformingBranches : topAlerts.length}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8E8E93]">
                    {isOpsManagerMode
                      ? `${highSeverityAlerts} high-severity alerts active`
                      : `${highSeverityAlerts} high severity`}
                  </p>
                </article>
              </section>

              {/* Branch Comparison */}
              <section className="mb-10 pb-8 border-b border-[#2A2A2E]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      Branch Performance
                    </p>
                    <h3 className="mt-1 font-display text-[24px] leading-[30px] text-[#F5F5F7]">
                      {isOpsManagerMode
                        ? "Operational Branch Board"
                        : "Organization Comparison"}
                    </h3>
                  </div>
                  <span className="text-[12px] text-[#8E8E93]">
                    {controlTower?.branch_count ?? 0} branches tracked
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
                          Revenue
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Waste %
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Surplus %
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Activity
                        </th>
                        <th className="py-2 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                          Compliance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(controlTower?.branch_grid ?? []).map((branch) => (
                        <tr key={branch.branch_id} className="border-b border-[#2A2A2E]">
                          <td className="py-3 text-[13px] text-[#F5F5F7]">{branch.branch_name}</td>
                          <td className="py-3 text-[13px] text-[#C7C7CC]">
                            ${Number(branch.revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 text-[13px] text-[#C7C7CC]">
                            {Number(branch.waste_pct ?? 0).toFixed(1)}%
                          </td>
                          <td className="py-3 text-[13px] text-[#C7C7CC]">
                            {Number(branch.surplus_pct ?? 0).toFixed(1)}%
                          </td>
                          <td className="py-3 text-[12px] text-[#8E8E93]">
                            {branch.staff_activity_status || "N/A"}
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-[6px] text-[11px] font-medium ${
                                branch.compliance_badge === "GREEN"
                                  ? "text-[#3F8F68]"
                                  : branch.compliance_badge === "AMBER"
                                    ? "text-[#C48B2A]"
                                    : "text-[#C44949]"
                              }`}
                            >
                              {branch.compliance_badge || "N/A"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* AI Insight + Alerts */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <article className="lg:col-span-2">
                  <div className="flex items-center gap-2 text-[#A8821F] mb-2">
                    <Brain className="h-4 w-4" />
                    <p className="text-[11px] uppercase tracking-[0.14em]">
                      {isOpsManagerMode ? "Operational Insight" : "PrepIQ Insight"}
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
                    {isOpsManagerMode ? "Operational Alerts" : "Active Risk Alerts"}
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
          ) : isBranchManagerMode ? (
            <>
              <div className="mb-12">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                  Branch Command
                </p>
                <h2 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                  Today&apos;s Prep Command
                </h2>
                <p className="mt-2 text-[14px] text-[#8E8E93] max-w-2xl">
                  Operational clarity for {activeBranch?.name || "your assigned branch"}.
                </p>
              </div>

              <section className="pb-8 border-b border-[#2A2A2E]">
                {branchCommandTodayQuery.isLoading ? (
                  <div className="py-4 text-[14px] text-[#8E8E93]">
                    Loading today&apos;s prep command...
                  </div>
                ) : todayRecommendations.length ? (
                  <div className="space-y-3">
                    {todayRecommendations.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2 border-b border-[#2A2A2E] last:border-b-0"
                      >
                        <p className="text-[15px] text-[#F5F5F7]">{item.item_title}</p>
                        <p className="font-display text-[20px] text-[#F5F5F7]">
                          {item.recommended_quantity} {item.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-[14px] text-[#8E8E93]">
                    No prep command available yet.
                  </div>
                )}
              </section>

              <section className="mt-8 pb-8 border-b border-[#2A2A2E]">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  Yesterday&apos;s Variance
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-8">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Prepared
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      {yesterdayPrepared.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Sold
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      {yesterdaySold.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                      Waste Cost
                    </p>
                    <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">
                      ${yesterdayWasteCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </section>

              <section className="mt-8">
                <div className="flex items-center gap-2 text-[#A8821F] mb-2">
                  <Brain className="h-4 w-4" />
                  <p className="text-[11px] uppercase tracking-[0.14em]">
                    PrepIQ Insight
                  </p>
                </div>
                <p className="text-[17px] leading-[28px] text-[#F5F5F7]">{branchInsight}</p>
              </section>
            </>
          ) : isChefMode ? (
            <>
              <div className="mb-12">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
                  Production Mode
                </p>
                <h2 className="mt-2 font-display text-4xl font-semibold text-text-primary">
                  Today&apos;s Plan
                </h2>
                <p className="mt-2 text-[14px] text-[#8E8E93] max-w-2xl">
                  Here&apos;s what to prepare for {activeBranch?.name || "your branch"}.
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
