"use client";

import { useMemo } from "react";
import { useSidebarState } from "@/components/dashboard/sidebar-state";
import { DashboardSidebarWrapper } from "@/components/dashboard/sidebar-wrapper";
import { DashboardTopNavWrapper } from "@/components/dashboard/top-nav-wrapper";
import { useCurrentUserProfile } from "@/services";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebarState();
  const { data: user } = useCurrentUserProfile();

  // Memoize user to prevent unnecessary re-renders of wrappers
  const memoizedUser = useMemo(() => user, [user?.id]);

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
          {children}
        </div>
      </main>
    </div>
  );
}
