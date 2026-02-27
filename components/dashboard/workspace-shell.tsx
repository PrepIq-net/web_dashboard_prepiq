"use client";

import { Brain } from "iconoir-react";
import { DashboardSidebarWrapper } from "@/components/dashboard/sidebar-wrapper";
import { DashboardTopNavWrapper } from "@/components/dashboard/top-nav-wrapper";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
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
  const { collapsed } = useSidebarState();
  const { data: user } = useCurrentUserProfile();

  return (
    <div className="flex min-h-screen bg-surface-1">
      <DashboardSidebarWrapper user={user} />
      <main
        className={`flex-1 py-8 transition-[margin-left] duration-200 ${
          collapsed ? "ml-20" : "ml-64"
        }`}
      >
        <div className="mx-auto w-full max-w-[1440px] px-6 sm:px-8">
          <DashboardTopNavWrapper />
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
