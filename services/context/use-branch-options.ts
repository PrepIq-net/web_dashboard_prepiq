"use client";

import { useMemo } from "react";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
} from "@/services";
import type { Branch } from "@/services/branches/types";
import { EMPTY_LIST } from "@/lib/constants";

/**
 * Branch options for workspace pages, merged with the production-intelligence
 * access scope.
 *
 * Previously each page (today, planning, dashboard) re-implemented this merge
 * with slight variations. The rules, unified:
 * - Start from the org's branches.
 * - Add scope-only branches the org list doesn't know about (staff users can
 *   be granted access to branches outside their org listing) as synthetic
 *   Branch records.
 * - If the scope restricts access, filter to accessible branches only.
 * - The default branch is: scope default > primary > first option.
 */
export function useBranchOptions() {
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const branches = branchesQuery.data ?? (EMPTY_LIST as Branch[]);
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;

  const branchOptions = useMemo(() => {
    const accessibleBranchIds = new Set(
      accessibleBranches.map((branch) => branch.id),
    );
    const byId = new Map<string, Branch>();
    for (const branch of branches) {
      byId.set(branch.id, branch);
    }
    for (const branch of accessibleBranches) {
      if (byId.has(branch.id)) continue;
      byId.set(branch.id, {
        id: branch.id,
        organization: user?.organization_id ?? "",
        organization_name: user?.organization_name ?? "",
        name: branch.name,
        code: "",
        address: "",
        phone: null,
        email: null,
        timezone: "UTC",
        is_primary: branch.is_primary,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Branch);
    }
    const merged = Array.from(byId.values());
    if (!accessibleBranchIds.size) return merged;
    return merged.filter((branch) => accessibleBranchIds.has(branch.id));
  }, [
    branches,
    accessibleBranches,
    user?.organization_id,
    user?.organization_name,
  ]);

  const defaultBranch =
    branchOptions.find(
      (branch) => branch.id === accessScope?.default_branch_id,
    ) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  return {
    user,
    accessScope,
    branchOptions,
    defaultBranch,
    isLoading: userLoading || branchesQuery.isLoading,
  };
}
