"use client";

import { Suspense } from "react";
import { DashboardSidebar } from "./sidebar";
import type { UserProfile } from "@/services/users/types";

type DashboardSidebarWrapperProps = {
  user?: UserProfile | null;
};

function SidebarFallback() {
  return (
    <aside className="fixed left-0 top-0 z-20 h-screen w-64 border-r border-[#1C1C1F] bg-[#141416]">
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
      </div>
    </aside>
  );
}

export function DashboardSidebarWrapper({ user }: DashboardSidebarWrapperProps) {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <DashboardSidebar user={user} />
    </Suspense>
  );
}
