"use client";

import { useMemo } from "react";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import { DashboardSidebarWrapper } from "@/components/dashboard/sidebar-wrapper";
import { DashboardTopNavWrapper } from "@/components/dashboard/top-nav-wrapper";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { SalesSourceRequiredState } from "@/components/dashboard/empty-states/sales-source-required-state";
import { useBranches, useCurrentUserProfile } from "@/services";
import {
  useProductionIntelligenceAccessScope,
  useSalesDataValidation,
} from "@/services/production-intelligence/hooks";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebarState();
  const { data: user } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const accessScopeQuery = useProductionIntelligenceAccessScope();

  // Memoize user to prevent unnecessary re-renders of wrappers
  const memoizedUser = useMemo(() => user, [user?.id]);
  const shouldShowBranchRequiredState =
    Boolean(user?.has_organization) &&
    !branchesQuery.isLoading &&
    !branchesQuery.isError &&
    (branchesQuery.data?.length ?? 0) === 0;
  const activeBranchId =
    accessScopeQuery.data?.default_branch_id ??
    branchesQuery.data?.find((branch) => branch.is_primary)?.id ??
    branchesQuery.data?.[0]?.id ??
    "";
  const salesValidationQuery = useSalesDataValidation({
    branch_id: activeBranchId,
  });
  const shouldShowSalesSourceRequiredState =
    Boolean(user?.has_organization) &&
    !shouldShowBranchRequiredState &&
    Boolean(activeBranchId) &&
    !salesValidationQuery.isLoading &&
    !salesValidationQuery.isError &&
    salesValidationQuery.data?.sales_source_connected === false;

  return (
    <div className="flex min-h-screen bg-surface-1">
      <DashboardSidebarWrapper user={memoizedUser} />
      <main
        className={`flex-1 py-8 transition-[margin-left] duration-200 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-8">
          <DashboardTopNavWrapper />
          {shouldShowBranchRequiredState ? (
            <div className="mt-8">
              <BranchRequiredState compact />
            </div>
          ) : shouldShowSalesSourceRequiredState ? (
            <div className="mt-8">
              <SalesSourceRequiredState compact />
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
