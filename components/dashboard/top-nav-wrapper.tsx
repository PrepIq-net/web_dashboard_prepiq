"use client";

import { Suspense } from "react";
import { DashboardTopNav } from "./top-nav";

function TopNavFallback() {
  return (
    <div className="mb-10 -mx-2 border-b border-[#2A2A2E] px-2 pb-5 sm:-mx-4 sm:px-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Dashboard
          </p>
          <h1 className="mt-1 font-display text-[30px] font-semibold leading-[38px] text-[#F5F5F7]">
            Overview
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-[#232327] animate-pulse" />
          <div className="h-10 w-10 rounded-lg bg-[#232327] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function DashboardTopNavWrapper() {
  return (
    <Suspense fallback={<TopNavFallback />}>
      <DashboardTopNav />
    </Suspense>
  );
}
