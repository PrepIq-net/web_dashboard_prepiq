"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
  useSalesWasteReport,
} from "@/services";

const EMPTY_LIST: never[] = [];

type SalesWasteItemRow = {
  item_id: string;
  item_title: string | null;
  unit: string;
  forecasted: number;
  produced: number;
  sold: number;
  waste: number;
  revenue: number;
  food_cost: number;
  waste_cost: number;
  over_prep: number;
  under_prep: number;
  lost_revenue: number;
  margin_impact: number;
  margin_pct: number;
};

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatQuantity(value: number, unit: string) {
  if (Number.isNaN(value)) return `0 ${unit}`;
  return `${value.toFixed(0)} ${unit}`;
}

function SalesWasteItemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const role = user?.organization_role ?? "";
  const canAccess = ["ORG_OWNER", "ORG_ADMIN", "OPS_DIRECTOR", "GM", "BRANCH_MANAGER"].includes(role);
  const canViewAllBranches = Boolean(accessScope?.can_view_all_branches);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;

  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;
  const scopedBranchIds = new Set(accessibleBranches.map((branch) => branch.id));
  const branchOptions = useMemo(() => {
    if (canViewAllBranches) {
      return branches;
    }
    if (accessibleBranches.length) {
      if (!branches.length) {
        return accessibleBranches;
      }
      return branches.filter((branch) => scopedBranchIds.has(branch.id));
    }
    return [];
  }, [accessibleBranches, branches, canViewAllBranches, scopedBranchIds]);

  const defaultBranch =
    branchOptions.find((branch) => branch.id === accessScope?.default_branch_id) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  const queryBranchId = searchParams.get("branch") ?? "";
  const queryDate = searchParams.get("date") ?? "";
  const queryPeriod = searchParams.get("period") ?? "";
  const queryItemId = searchParams.get("item") ?? "";

  const [selectedBranchId, setSelectedBranchId] = useState(
    queryBranchId || (defaultBranch?.id ?? ""),
  );
  const [anchorDate, setAnchorDate] = useState(
    queryDate || new Date().toISOString().slice(0, 10),
  );
  const [period, setPeriod] = useState(queryPeriod || "30d");

  useEffect(() => {
    if (!selectedBranchId && defaultBranch?.id) {
      setSelectedBranchId(defaultBranch.id);
    }
  }, [defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!branchOptions.length) return;
    if (!selectedBranchId) return;
    const isAllowed = branchOptions.some((branch) => branch.id === selectedBranchId);
    if (!isAllowed && defaultBranch?.id) {
      setSelectedBranchId(defaultBranch.id);
    }
  }, [branchOptions, defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const reportQuery = useSalesWasteReport({
    branch_id: selectedBranchId,
    period,
    target_date: anchorDate,
  });
  const report = reportQuery.data;

  const itemRow = useMemo(() => {
    if (!report?.items || !queryItemId) return null;
    return report.items.find((row) => row.item_id === queryItemId) ?? null;
  }, [report?.items, queryItemId]);

  const revenueShare =
    report?.totals.revenue && itemRow
      ? Math.min(100, (itemRow.revenue / report.totals.revenue) * 100)
      : 0;

  if (!queryItemId) {
    return (
      <WorkspaceShell
        eyebrow="Sales & Waste"
        title="Item Detail"
        description="Choose an item from the Sales & Waste table to view details."
        insight=""
      >
        <section className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-secondary">
          Missing item id. Go back to Sales &amp; Waste and select an item.
        </section>
      </WorkspaceShell>
    );
  }

  if (report && !itemRow) {
    return (
      <WorkspaceShell
        eyebrow="Sales & Waste"
        title="Item Detail"
        description="Item not found for the selected window."
        insight=""
      >
        <section className="rounded-xl border border-surface-4 bg-surface-2 p-6 text-sm text-text-secondary">
          We could not find this item in the current period. Try adjusting the period
          or date window, or return to Sales &amp; Waste to choose another item.
        </section>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow="Sales & Waste"
      title="Item Profit Detail"
      description="See how one menu item affects revenue, waste, and margin."
      insight=""
    >
      <section className="mb-6 rounded-xl border border-surface-4 bg-surface-2 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
              Item Drill-Down
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              {itemRow?.item_title ?? "Unknown Item"}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Unit: {itemRow?.unit ?? "PCS"} · Revenue share: {toPercent(revenueShare)}
            </p>
          </div>
          <Link
            href={`/workspace/sales-waste?branch=${selectedBranchId}&date=${anchorDate}&period=${period}`}
            className="inline-flex h-10 items-center rounded-lg border border-surface-4 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary hover:text-text-primary"
          >
            Back to Sales &amp; Waste
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Select
            label="Branch"
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
          />
          <Select
            label="Period"
            options={[
              { value: "today", label: "Today" },
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
            ]}
            value={period}
            onChange={setPeriod}
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Anchor Date
            </label>
            <input
              type="date"
              value={anchorDate}
              onChange={(event) => setAnchorDate(event.target.value)}
              className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 text-sm text-text-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Selected Window
            </label>
            <div className="h-12 w-full rounded-button border border-border-default bg-surface-3 px-4 flex items-center text-sm text-text-secondary">
              {report
                ? `${report.period_start_date} → ${report.period_end_date}`
                : "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Revenue
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-status-success">
              {toCurrency(itemRow?.revenue ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              Sold: {formatQuantity(itemRow?.sold ?? 0, itemRow?.unit ?? "PCS")}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Waste Cost
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-status-warning">
              {toCurrency(itemRow?.waste_cost ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              Waste: {formatQuantity(itemRow?.waste ?? 0, itemRow?.unit ?? "PCS")}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Lost Revenue
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-status-critical">
              {toCurrency(itemRow?.lost_revenue ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              Under-prep: {formatQuantity(itemRow?.under_prep ?? 0, itemRow?.unit ?? "PCS")}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Margin %
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-brand-gold">
              {toPercent(itemRow?.margin_pct ?? 0)}
            </p>
            <p className="mt-2 text-xs text-text-muted">
              Margin impact: {toCurrency(itemRow?.margin_impact ?? 0)}
            </p>
          </article>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Forecast vs Prep
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Forecasted: {formatQuantity(itemRow?.forecasted ?? 0, itemRow?.unit ?? "PCS")}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Produced: {formatQuantity(itemRow?.produced ?? 0, itemRow?.unit ?? "PCS")}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Over / Under Prep
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Over-prep: {formatQuantity(itemRow?.over_prep ?? 0, itemRow?.unit ?? "PCS")}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Under-prep: {formatQuantity(itemRow?.under_prep ?? 0, itemRow?.unit ?? "PCS")}
            </p>
          </article>
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Food Cost
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Food cost: {toCurrency(itemRow?.food_cost ?? 0)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Revenue share: {toPercent(revenueShare)}
            </p>
          </article>
        </div>

        <div className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Operational Signals
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-text-secondary md:grid-cols-2">
            <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
              {(itemRow?.over_prep ?? 0) > 0
                ? `Over-prep detected. Consider slowing production to reduce waste.`
                : "Over-prep is under control for this window."}
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3 p-4">
              {(itemRow?.under_prep ?? 0) > 0
                ? `Under-prep risk. Increase prep to protect revenue.`
                : "No stockout risk detected from under-prep."}
            </div>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

export default function SalesWasteItemPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-8 text-sm text-text-muted">
          Loading item performance…
        </div>
      }
    >
      <SalesWasteItemContent />
    </Suspense>
  );
}
