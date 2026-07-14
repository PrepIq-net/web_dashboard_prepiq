"use client";

import Link from "next/link";
import { ArrowRight, Shop, DatabaseScript } from "iconoir-react";

type BranchRequiredStateProps = {
  compact?: boolean;
};

export function BranchRequiredState({ compact = false }: BranchRequiredStateProps) {
  return (
    <section
      className={`rounded-[14px] border border-[#2E2E33] bg-[#1C1C1F] ${
        compact ? "p-6" : "p-8 md:p-10"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
        Setup Required
      </p>
      <h1
        className={`mt-3 font-display font-semibold text-[#F5F5F7] ${
          compact ? "text-[24px] leading-[32px]" : "text-[34px] leading-[42px]"
        }`}
      >
        Create a branch to unlock your workspace
      </h1>
      <p className="mt-3 max-w-3xl text-[14px] leading-[22px] text-[#8E8E93]">
        PrepIQ needs a branch before we can load production, sales, waste, and forecasting data.
        After creating a branch, connect your POS or upload CSV sales to start intelligence.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-4">
          <div className="flex items-center gap-2 text-[#C7C7CC]">
            <Shop className="h-4 w-4 text-[#A8821F]" />
            <p className="text-[13px] font-semibold">Step 1: Create branch</p>
          </div>
          <p className="mt-2 text-[12px] text-[#8E8E93]">
            Add branch name, location, and timezone.
          </p>
        </div>
        <div className="rounded-[10px] border border-[#2E2E33] bg-[#232327] p-4">
          <div className="flex items-center gap-2 text-[#C7C7CC]">
            <DatabaseScript className="h-4 w-4 text-[#A8821F]" />
            <p className="text-[13px] font-semibold">Step 2: Add sales data</p>
          </div>
          <p className="mt-2 text-[12px] text-[#8E8E93]">
            Connect POS or upload CSV sales for forecasting.
          </p>
        </div>
      </div>

      <div className="mt-7">
        <Link
          href="/workspace/branches/new"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#A8821F] px-5 text-sm font-semibold text-[#141416] transition-colors hover:bg-[#B8962E] active:bg-[#8F6F18]"
        >
          Create Branch First
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

