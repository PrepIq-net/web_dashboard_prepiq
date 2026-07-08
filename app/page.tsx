"use client";

import { useBranches, useCurrentUserProfile } from "@/services";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { resolvePermissions, canAccessDashboard } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

// The app root is a pure router: it decides where an authenticated user belongs
// (onboarding / branch setup / Today / Dashboard) and forwards there. The
// dashboard content itself now lives at /workspace/dashboard, inside the
// persistent workspace layout, so navigating to it keeps the sidebar mounted.
// Keeping the onboarding/setup gating HERE means no-org users never flash
// through the workspace layout's subscription/branch gates.
export default function Home() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<HomeSpinner label={t("dashboard.home.gettingReady")} />}>
      <HomeRouter />
    </Suspense>
  );
}

function HomeSpinner({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-1">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-text-muted animate-pulse">
          {label}
        </p>
      </div>
    </main>
  );
}

function HomeRouter() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();

  const permissions = resolvePermissions(user);
  const hasDashboardAccess = canAccessDashboard(permissions);

  const hasOrganization = Boolean(user?.has_organization);
  const branchesQuery = useBranches(user?.organization_id ?? "");

  const needsOnboarding = !isLoading && user != null && !hasOrganization;
  const isOperationalUser =
    !isLoading && hasOrganization && !hasDashboardAccess;
  const needsBranchSetup =
    !isLoading &&
    hasOrganization &&
    hasDashboardAccess &&
    !branchesQuery.isLoading &&
    !branchesQuery.isError &&
    (branchesQuery.data?.length ?? 0) === 0;
  const readyForDashboard =
    !isLoading &&
    hasOrganization &&
    hasDashboardAccess &&
    !branchesQuery.isLoading &&
    (branchesQuery.data?.length ?? 0) > 0;

  useEffect(() => {
    if (needsOnboarding) {
      router.replace("/onboarding");
    } else if (isOperationalUser) {
      router.replace("/workspace/today");
    } else if (needsBranchSetup) {
      router.replace("/setup/branch/create");
    } else if (readyForDashboard) {
      const qs = searchParams.toString();
      router.replace(`/workspace/dashboard${qs ? `?${qs}` : ""}`);
    }
  }, [
    needsOnboarding,
    isOperationalUser,
    needsBranchSetup,
    readyForDashboard,
    router,
    searchParams,
  ]);

  const label = needsOnboarding
    ? t("dashboard.home.gettingReady")
    : isOperationalUser
      ? t("dashboard.home.routingToToday")
      : needsBranchSetup
        ? t("dashboard.home.routingToSetup")
        : t("dashboard.home.gettingReady");

  return <HomeSpinner label={label} />;
}
