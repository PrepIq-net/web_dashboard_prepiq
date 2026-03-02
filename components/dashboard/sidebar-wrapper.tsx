"use client";

import { memo } from "react";
import { DashboardSidebar } from "./sidebar";
import type { UserProfile } from "@/services/users/types";

type DashboardSidebarWrapperProps = {
  user?: UserProfile | null;
};

function SidebarContent({ user }: DashboardSidebarWrapperProps) {
  return <DashboardSidebar user={user} />;
}

export const DashboardSidebarWrapper = memo(SidebarContent);
