"use client";

import { Brain } from "iconoir-react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { useCurrentUserProfile } from "@/services";

type WorkspaceShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  insight: string;
  children: React.ReactNode;
};

export function WorkspaceShell({
  eyebrow,
  title,
  description,
  insight,
  children,
}: WorkspaceShellProps) {
  const { data: user, isLoading } = useCurrentUserProfile();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="h-12 w-12 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted">
            Loading workspace...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-1">
      <DashboardSidebar user={user} />
      <main className="ml-64 flex-1 py-8">
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-8">
          <section className="pb-8 border-b border-[#2A2A2E]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
              {eyebrow}
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold text-text-primary">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-[14px] text-[#8E8E93]">
              {description}
            </p>
          </section>

          <section className="mt-8">{children}</section>

          <section className="mt-10 pt-5 border-t border-[#2A2A2E]">
            <div className="inline-flex items-center gap-2 text-[#A8821F]">
              <Brain className="h-4 w-4" />
              <p className="text-[11px] uppercase tracking-[0.14em]">
                PrepIQ Insight
              </p>
            </div>
            <p className="mt-2 text-[14px] leading-[24px] text-[#C7C7CC]">
              {insight}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
