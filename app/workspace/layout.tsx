"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { CommandPaletteProvider } from "@/components/command/command-palette-provider";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import { DashboardSidebarWrapper } from "@/components/dashboard/sidebar-wrapper";
import { DashboardTopNavWrapper } from "@/components/dashboard/top-nav-wrapper";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { SalesSourceRequiredState } from "@/components/dashboard/empty-states/sales-source-required-state";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { TrialBanner, PaymentFailedBanner } from "@/components/dashboard/subscription-banners";
import { useBranches, useCurrentUserProfile } from "@/services";
import { useCurrentSubscription } from "@/services/payment/hooks";
import {
  useProductionIntelligenceAccessScope,
  useSalesDataValidation,
} from "@/services/production-intelligence/hooks";

// Pages that must always be accessible regardless of subscription state.
const SUBSCRIPTION_EXEMPT_PATHS = [
  "/workspace/billing",
  "/workspace/profile",
  "/workspace/support",
];

// Pages that must render WITHOUT an org-level branch. These are either where you
// create/manage the first branch (so gating them behind "create a branch" would
// be a dead end) or account-level areas that simply don't operate on branch
// data. Everything else is real kitchen work and stays branch-gated. Tabs inside
// these pages that DO need a branch (e.g. connecting a POS under Settings →
// Integrations) render their own inline empty state instead of blocking the page.
const BRANCH_EXEMPT_PATHS = [
  "/workspace/branches",
  "/workspace/settings",
  "/workspace/profile",
  "/workspace/billing",
  "/workspace/support",
  "/workspace/notifications",
];

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { collapsed } = useSidebarState();
  const { data: user } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const accessScopeQuery = useProductionIntelligenceAccessScope();

  // Memoize user to prevent unnecessary re-renders of wrappers
  const memoizedUser = useMemo(() => user, [user?.id]);

  // Layout-level gate checks the user's PRIMARY branch subscription (org-level health).
  // Per-page gates (via useSubscriptionTier(branchId)) handle branch-specific checks.
  const subscriptionQuery = useCurrentSubscription();

  const activeBranchId =
    accessScopeQuery.data?.default_branch_id ??
    branchesQuery.data?.find((branch) => branch.is_primary)?.id ??
    branchesQuery.data?.[0]?.id ??
    "";

  // ── Subscription gate ──────────────────────────────────────────────────────
  const isExemptPath = SUBSCRIPTION_EXEMPT_PATHS.some((p) =>
    pathname.startsWith(p),
  );
  const sub = subscriptionQuery.data;
  const subLoaded = !subscriptionQuery.isLoading;

  // "No subscription" = query finished with no data (404 or genuinely empty)
  const hasNoSubscription = subLoaded && !sub;
  // Expired/cancelled = data present but no longer active, and not a trial
  const isExpired =
    subLoaded && sub && !sub.is_currently_active && !sub.is_trial;
  // Trial that ran to end
  const isTrialExpired =
    subLoaded && sub && !sub.is_currently_active && Boolean(sub.is_trial);
  // Active trial
  const isTrial = Boolean(sub?.is_currently_active && sub?.is_trial);
  // Payment past due but still accessible
  const isPastDue = sub?.status === "PAST_DUE";
  const daysLeft = sub?.days_until_renewal ?? null;

  const shouldBlockAccess =
    !isExemptPath && Boolean(hasNoSubscription || isExpired || isTrialExpired);
  const gateVariant = hasNoSubscription
    ? "none"
    : isTrialExpired
      ? "trial_expired"
      : "expired";
  // ──────────────────────────────────────────────────────────────────────────

  // Account-level and branch-management pages opt out of the branch/sales gates
  // so they stay reachable before any branch exists (see BRANCH_EXEMPT_PATHS).
  const isBranchExemptPath = BRANCH_EXEMPT_PATHS.some((p) =>
    pathname.startsWith(p),
  );

  const shouldShowBranchRequiredState =
    !isBranchExemptPath &&
    Boolean(user?.has_organization) &&
    !branchesQuery.isLoading &&
    !branchesQuery.isError &&
    (branchesQuery.data?.length ?? 0) === 0;
  const salesValidationQuery = useSalesDataValidation({
    branch_id: activeBranchId,
  });
  const shouldShowSalesSourceRequiredState =
    !isBranchExemptPath &&
    Boolean(user?.has_organization) &&
    !shouldShowBranchRequiredState &&
    Boolean(activeBranchId) &&
    !salesValidationQuery.isLoading &&
    !salesValidationQuery.isError &&
    salesValidationQuery.data?.sales_source_connected === false;

  // Branch-required always wins: an org with zero branches must always be
  // able to create one, even with no active subscription — the first branch
  // is what unlocks the trial in the first place, so gating branch creation
  // behind a subscription check would be a dead end.
  const mainContent = shouldShowBranchRequiredState ? (
    <div className="mt-8">
      <BranchRequiredState compact />
    </div>
  ) : shouldBlockAccess ? (
    <div className="mt-8">
      <SubscriptionRequiredState variant={gateVariant} compact />
    </div>
  ) : shouldShowSalesSourceRequiredState ? (
    <div className="mt-8">
      <SalesSourceRequiredState compact />
    </div>
  ) : (
    <>
      {isTrial && (
        <TrialBanner daysLeft={typeof daysLeft === "number" ? daysLeft : null} />
      )}
      {isPastDue && <PaymentFailedBanner />}
      {children}
    </>
  );

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen bg-surface-1">
        <DashboardSidebarWrapper user={memoizedUser} />
        <main
          className={`flex-1 py-8 transition-[margin-left] duration-200 ${
            collapsed ? "ml-20" : "ml-64"
          }`}
        >
          <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-8">
            <DashboardTopNavWrapper />
            {mainContent}
          </div>
        </main>
      </div>
    </CommandPaletteProvider>
  );
}
