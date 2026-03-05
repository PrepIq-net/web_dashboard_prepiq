"use client";

import { memo } from "react";
import { DashboardTopNav } from "./top-nav";

function TopNavContent() {
  return <DashboardTopNav />;
}

export const DashboardTopNavWrapper = memo(TopNavContent);
