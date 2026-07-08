"use client";

import {
  useBranches,
  useCurrentUserProfile,
  useStaffAssignments,
} from "@/services";
import {
  useBranchCommandView,
  useProductionIntelligenceAccessScope,
  useSalesDataValidation,
  useStaffShiftChecklist,
} from "@/services/production-intelligence/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { InsightFooter } from "@/components/dashboard/home/insight-footer";
import { DashboardView } from "@/components/dashboard/home/dashboard-view";
import { BranchManagerView } from "@/components/dashboard/home/branch-manager-view";
import { CommandSection } from "@/components/dashboard/home/command-section";
import { resolvePermissions, canAccessDashboard } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useTranslation } from "@/lib/i18n";

// The dashboard "home" now lives INSIDE the workspace layout subtree so that
// navigating between it and any other /workspace/* route is a client-side
// transition that keeps the sidebar mounted (no remount / no full reload).
// The surrounding chrome (sidebar, top-nav, subscription gate, branch-required
// / sales-source empty states) is provided by app/workspace/layout.tsx — this
// page only renders the dashboard content itself.
export default function DashboardPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-text-muted animate-pulse">
              {t("dashboard.home.gettingReady")}
            </p>
          </div>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUserProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedBranchFromUrl = searchParams.get("branch");

  const permissions = resolvePermissions(user);
  const canSeeFinancials = permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA);
  const canSeeAnalytics = permissions.has(PERMISSIONS.VIEW_ANALYTICS);
  const canSeeForecasts = permissions.has(PERMISSIONS.VIEW_FORECASTS);

  // Dashboard is for management-level users. Everyone else goes to Today.
  const hasDashboardAccess = canAccessDashboard(permissions);

  // View selection: show the most informative view the user's permissions allow.
  const isOwnerMode = canSeeFinancials;
  const isOpsManagerMode = !canSeeFinancials && canSeeAnalytics;
  // Operational users who reach this route directly (e.g. via the sidebar link)
  // are bounced to Today; those with forecast access still get the branch view.
  const isBranchExecutionMode = !hasDashboardAccess && canSeeForecasts;
  const isOrgOverviewMode = isOwnerMode || isOpsManagerMode;

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const accessScopeQuery = useProductionIntelligenceAccessScope();

  const branches = branchesQuery.data ?? [];
  const accessibleBranches = accessScopeQuery.data?.accessible_branches ?? [];
  const branchOptions = useMemo(() => {
    if (!isBranchExecutionMode) return branches;
    if (!accessibleBranches.length) return branches;
    const accessibleBranchIds = new Set(
      accessibleBranches.map((branch) => branch.id),
    );
    return branches.filter((branch) => accessibleBranchIds.has(branch.id));
  }, [branches, isBranchExecutionMode, accessibleBranches]);

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const activeBranch = useMemo(() => {
    if (!branchOptions.length) return null;
    if (selectedBranchFromUrl) {
      const fromUrl = branchOptions.find((b) => b.id === selectedBranchFromUrl);
      if (fromUrl) return fromUrl;
    }
    const primary = branchOptions.find((b) => b.is_primary);
    return primary ?? branchOptions[0];
  }, [branchOptions, selectedBranchFromUrl]);

  const activeBranchId = activeBranch?.id ?? "";

  // Only fetch branch-specific data when in branch execution mode
  const branchCommandTodayQuery = useBranchCommandView(
    { branch_id: activeBranchId, target_date: todayDate },
    isBranchExecutionMode && Boolean(activeBranchId),
  );
  const branchCommandYesterdayQuery = useBranchCommandView(
    { branch_id: activeBranchId, target_date: yesterdayDate },
    isBranchExecutionMode && Boolean(activeBranchId),
  );
  const staffAssignmentsQuery = useStaffAssignments(
    user?.organization_id ?? "",
  );
  const staffChecklistQuery = useStaffShiftChecklist({
    branch_id: activeBranchId,
    target_date: todayDate,
  });
  const salesValidationQuery = useSalesDataValidation({
    branch_id: activeBranchId,
    target_date: todayDate,
  });

  // Operational users who land here directly are routed to Today. Onboarding /
  // branch-setup gating is handled by the "/" route before the happy path ever
  // reaches this page.
  const shouldRedirectToToday =
    !isLoading && Boolean(user?.has_organization) && !hasDashboardAccess;

  useEffect(() => {
    if (shouldRedirectToToday) {
      router.replace("/workspace/today");
    }
  }, [shouldRedirectToToday, router]);

  if (isLoading || shouldRedirectToToday) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted animate-pulse">
            {shouldRedirectToToday
              ? t("dashboard.home.routingToToday")
              : t("dashboard.home.gettingReady")}
          </p>
        </div>
      </main>
    );
  }

  // ── Derived values (branch execution mode only) ───────────────────────────
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
    preparedToday > 0 ? ((preparedToday - soldToday) / preparedToday) * 100 : 0;
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

  const subtleInsight =
    isBranchExecutionMode && todayRecommendations.length > 0
      ? `${todayRecommendations[0].item_title} has the highest priority today at ${todayRecommendations[0].recommended_quantity} ${todayRecommendations[0].unit}.`
      : "";

  return (
    <div className="mt-10 animate-fade-in">
      {isOrgOverviewMode ? (
        <DashboardView canSeeFinancials={canSeeFinancials} />
      ) : isBranchExecutionMode ? (
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
      ) : null}

      {isOrgOverviewMode && (
        <div className="mt-12 border-t border-surface-4 pt-12">
          <CommandSection />
        </div>
      )}

      {subtleInsight && <InsightFooter insight={subtleInsight} />}
    </div>
  );
}
