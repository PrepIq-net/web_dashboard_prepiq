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
import { ApiError } from "@/lib/api/errors";
import { useBranches, useCurrentUserProfile } from "@/services";
import { useCurrentSubscription } from "@/services/payment/hooks";
import {
  useProductionIntelligenceAccessScope,
  useSalesDataValidation,
} from "@/services/production-intelligence/hooks";

// Pages that must always be accessible regardless of subscription state. These
// are account/tenant-management surfaces — you must be able to reach them to fix
// billing, manage/create/delete an org, view sessions, or get help — so paywalling
// them would be a dead end. Kitchen-work pages stay subscription-gated. Tabs inside
// these pages that DO need a subscription/branch render their own inline gate.
const SUBSCRIPTION_EXEMPT_PATHS = [
  "/workspace/billing",
  "/workspace/profile",
  "/workspace/support",
  "/workspace/settings",
  "/workspace/notifications",
  // Talking to your colleagues is not a paid feature. An unpaid branch still
  // needs its team able to coordinate — and it is where a blocked member asks
  // whoever holds billing to sort the subscription out. @PrepIQ is gated
  // separately, inside the Hub, since the assistant IS the paid product.
  "/workspace/chat",
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

  // Declared below activeBranchId — see the gate block.

  // access-scope is the ONLY source that filters branches by what this member
  // can actually reach. The old fallback reached into branchesQuery (every
  // branch in the org) whenever access-scope hadn't resolved yet, so a member
  // assigned to one branch got probed against the org's primary branch and the
  // API correctly 403'd. Stay empty until access-scope answers, then fall back
  // only within the branches it approved.
  const accessibleBranches = accessScopeQuery.data?.accessible_branches;
  const activeBranchId = accessScopeQuery.isLoading
    ? ""
    : (accessScopeQuery.data?.default_branch_id ??
      accessibleBranches?.find((branch) => branch.is_primary)?.id ??
      accessibleBranches?.[0]?.id ??
      "");

  // ── Subscription gate ──────────────────────────────────────────────────────
  // Scoped to the branch this member actually works in, not the org's primary
  // branch: subscriptions are branch-scoped, so checking the wrong branch
  // paywalls staff whose own branch is paid up.
  const subscriptionQuery = useCurrentSubscription(
    activeBranchId ? { branch_id: activeBranchId } : undefined,
  );

  const isExemptPath = SUBSCRIPTION_EXEMPT_PATHS.some((p) =>
    pathname.startsWith(p),
  );
  const sub = subscriptionQuery.data;
  const subLoaded = !subscriptionQuery.isLoading && !accessScopeQuery.isLoading;

  // Only a 404 means "never subscribed". Any other error is the API failing to
  // answer, and must not be rendered as a paywall — that is what turned a
  // role-check 400 into "Start your 30-day free trial" for staff.
  const subError = subscriptionQuery.error;
  const subMissing = subError instanceof ApiError && subError.status === 404;
  const hasNoSubscription = subLoaded && !sub && subMissing;

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

  // Whether this viewer can do anything about a paywall. Carried on the 200 and
  // on the 404 body alike, so the gate can be honest with staff either way.
  const gatePayload = (sub ??
    (subMissing ? (subError as ApiError).details : null)) as {
    viewer_can_manage_billing?: boolean;
    billing_contacts?: { id: string; name: string }[];
  } | null;
  const canManageBilling = Boolean(gatePayload?.viewer_can_manage_billing);
  const billingContacts = gatePayload?.billing_contacts ?? [];

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
      <SubscriptionRequiredState
        variant={gateVariant}
        canManageBilling={canManageBilling}
        billingContacts={billingContacts}
        branchId={activeBranchId || undefined}
        compact
      />
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
