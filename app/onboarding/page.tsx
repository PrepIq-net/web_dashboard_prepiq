"use client";

import { useCurrentUserProfile } from "@/services";
import { useBranches } from "@/services/branches/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthLogoRow } from "@/components/auth/auth-logo-row";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function OnboardingPage() {
  const { data: user, isLoading } = useCurrentUserProfile();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !user?.has_organization) return;

    if (branchesQuery.isLoading) return;

    const hasBranches = (branchesQuery.data?.length ?? 0) > 0;
    if (hasBranches) {
      router.replace("/");
      return;
    }

    router.replace("/setup/branch/create");
  }, [user, isLoading, branchesQuery.isLoading, branchesQuery.data, router]);

  if (isLoading || (user && user?.has_organization)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted">
            Checking your setup...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-base overflow-x-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-12 md:px-12 md:py-24">
        {/* Background glow for a "pro" feel */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-gold/5 blur-[120px]" />

        <header className="relative z-10 flex items-center justify-between mb-20">
          <AuthLogoRow size={48} />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-text-muted">Setting up</p>
          </div>
        </header>

        <section className="relative z-10 flex-1">
          <OnboardingWizard />
        </section>

        <footer className="relative z-10 mt-20 pt-8 border-t border-border-default/50">
          <p className="text-xs text-text-muted">
            PrepIQ Workspace Infrastructure &copy; 2026. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
