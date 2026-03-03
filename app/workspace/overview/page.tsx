"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { useBranches, useCurrentUserProfile } from "@/services";

export default function WorkspaceOverviewPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const shouldHold = userLoading || (Boolean(user?.has_organization) && branchesQuery.isLoading);
  const hasBranches = (branchesQuery.data?.length ?? 0) > 0;
  const shouldShowBranchRequiredState =
    !userLoading &&
    Boolean(user?.has_organization) &&
    !hasBranches &&
    !branchesQuery.isLoading;

  useEffect(() => {
    if (shouldHold) return;
    if (hasBranches) {
      router.replace("/");
    }
  }, [shouldHold, hasBranches, router]);

  if (shouldHold) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted animate-pulse">
            Checking branch setup...
          </p>
        </div>
      </main>
    );
  }

  if (shouldShowBranchRequiredState) {
    return <BranchRequiredState />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-1">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-text-muted animate-pulse">
          Routing to dashboard...
        </p>
      </div>
    </main>
  );
}
