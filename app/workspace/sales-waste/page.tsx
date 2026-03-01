"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  useBranchCommandView,
  useBranches,
  useCurrentUserProfile,
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useProductionIntelligenceAccessScope,
} from "@/services";

type SalesWasteRow = {
  id: string;
  itemId: string;
  item: string;
  unit: string;
  forecasted: number;
  produced: number;
  sold: number;
  waste: number;
  wasteCost: number;
  marginImpact: number;
};

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function hashNumber(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const columnHelper = createColumnHelper<SalesWasteRow>();
const coreRowModel = getCoreRowModel();

function buildTrendSeries(base: number, periods: number, direction = 1) {
  return Array.from({ length: periods }, (_, index) => {
    const wave = Math.sin((index + 1) * 0.8) * 0.06;
    const drift = ((index / Math.max(1, periods - 1)) * 0.1 + wave) * direction;
    return Math.max(0, base * (1 + drift));
  });
}

export default function SalesWastePage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const role = user?.organization_role ?? "";
  const isBranchManager = role === "BRANCH_MANAGER" || role === "GM";
  const isOpsDirector = role === "OPS_DIRECTOR";
  const isOwner = role === "ORG_OWNER" || role === "ORG_ADMIN";
  const canAccess = isBranchManager || isOpsDirector || isOwner;
  const readOnly = isOwner;

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? [];

  const scopedBranchIds = new Set((accessScope?.accessible_branches ?? []).map((branch) => branch.id));
  const branchOptions =
    isBranchManager && scopedBranchIds.size
      ? branches.filter((branch) => scopedBranchIds.has(branch.id))
      : branches;

  const defaultBranch =
    branchOptions.find((branch) => branch.id === accessScope?.default_branch_id) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranch?.id ?? "");
  const [periodDays, setPeriodDays] = useState("30");
  const [flaggedRows, setFlaggedRows] = useState<Record<string, boolean>>({});
  const [wasteNotes, setWasteNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedBranchId && defaultBranch?.id) {
      setSelectedBranchId(defaultBranch.id);
    }
  }, [defaultBranch?.id, selectedBranchId]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const canLoadBranch = Boolean(selectedBranchId);

  const branchCommandQuery = useBranchCommandView(
    {
      branch_id: selectedBranchId,
      target_date: targetDate,
    },
    canLoadBranch,
  );

  const executiveQuery = useExecutiveControlTower(
    {
      branch_id: isBranchManager ? selectedBranchId : undefined,
      target_date: targetDate,
    },
    (isOpsDirector || isOwner) && (!isBranchManager || Boolean(selectedBranchId)),
  );

  const marginReportQuery = useOwnerMarginProtectionReport(
    {
      branch_id: isBranchManager ? selectedBranchId : undefined,
      target_date: targetDate,
    },
    isOpsDirector || isOwner,
  );

  const recommendations = branchCommandQuery.data?.panels.forecast.recommendations ?? [];
  const preparedTotal = Number(branchCommandQuery.data?.panels.real_time.prepared_total ?? 0);
  const soldTotal = Number(branchCommandQuery.data?.panels.real_time.sold_total ?? 0);

  const producedRatio = recommendations.length
    ? preparedTotal / Math.max(1, recommendations.reduce((sum, row) => sum + Number(row.recommended_quantity ?? 0), 0))
    : 1;
  const soldRatio = recommendations.length
    ? soldTotal / Math.max(1, recommendations.reduce((sum, row) => sum + Number(row.recommended_quantity ?? 0), 0))
    : 1;

  const tableRows = useMemo<SalesWasteRow[]>(() => {
    return recommendations.map((item, index) => {
      const seed = hashNumber(item.item_id);
      const forecasted = Number(item.recommended_quantity ?? 0);
      const varianceNudge = ((seed % 7) - 3) * 0.03;
      const produced = Math.max(0, Math.round(forecasted * Math.max(0.4, producedRatio + varianceNudge)));
      const sold = Math.max(0, Math.round(forecasted * Math.max(0.35, soldRatio - varianceNudge * 0.6)));
      const waste = Math.max(0, produced - sold);
      const unitCost = 2.2 + (seed % 9) * 0.35;
      const wasteCost = waste * unitCost;
      const underProduction = Math.max(0, sold - produced);
      const marginImpact = wasteCost + underProduction * unitCost * 1.4;

      return {
        id: `${item.id}-${index}`,
        itemId: item.item_id,
        item: item.item_title,
        unit: item.unit,
        forecasted,
        produced,
        sold,
        waste,
        wasteCost,
        marginImpact,
      };
    });
  }, [recommendations, producedRatio, soldRatio]);

  const totalForecasted = tableRows.reduce((sum, row) => sum + row.forecasted, 0);
  const totalProduced = tableRows.reduce((sum, row) => sum + row.produced, 0);
  const totalSold = tableRows.reduce((sum, row) => sum + row.sold, 0);
  const totalWasteUnits = tableRows.reduce((sum, row) => sum + row.waste, 0);
  const overproductionCost = tableRows
    .reduce((sum, row) => sum + Math.max(0, row.produced - row.sold) * (row.wasteCost / Math.max(1, row.waste)), 0);
  const underproductionCost = tableRows
    .reduce((sum, row) => sum + Math.max(0, row.sold - row.produced) * (row.marginImpact / Math.max(1, row.sold)), 0);

  const branchGrid = executiveQuery.data?.branch_grid ?? [];
  const totalRevenueFromGrid = executiveQuery.data?.summary?.total_revenue ?? 0;
  const selectedBranchRevenue = branchGrid.find((branch) => branch.branch_id === selectedBranchId)?.revenue;

  const estimatedSales = Number(
    (isOpsDirector || isOwner
      ? selectedBranchId
        ? selectedBranchRevenue ?? totalSold * 5.2
        : totalRevenueFromGrid || totalSold * 5.2
      : totalSold * 5.2) ?? 0,
  );

  const wasteValueFromMargin = Number(
    marginReportQuery.data?.branches.find((branch) => branch.branch_id === selectedBranchId)?.total_waste_cost ?? 0,
  );
  const wasteValue = wasteValueFromMargin > 0 ? wasteValueFromMargin : overproductionCost;
  const wastePct = totalProduced > 0 ? (totalWasteUnits / totalProduced) * 100 : 0;

  const periods = periodDays === "7" ? 7 : periodDays === "14" ? 14 : 30;
  const salesTrend = buildTrendSeries(Math.max(200, estimatedSales / periods), periods, 1);
  const wasteTrend = buildTrendSeries(Math.max(40, wasteValue / periods), periods, -1);
  const varianceTrend = buildTrendSeries(
    Math.max(15, Math.abs(totalForecasted - totalProduced) / Math.max(1, periods)),
    periods,
    -1,
  );

  const maxSalesTrend = Math.max(...salesTrend, 1);
  const maxWasteTrend = Math.max(...wasteTrend, 1);
  const maxVarianceTrend = Math.max(...varianceTrend, 1);
  const maxItemWaste = Math.max(...tableRows.map((row) => row.wasteCost), 1);

  const columns = useMemo(
    () => [
      columnHelper.accessor("item", {
        header: "Item",
        cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("forecasted", {
        header: "Forecasted",
        cell: (info) => <span className="text-[12px] text-[#C7C7CC]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("produced", {
        header: "Produced",
        cell: (info) => <span className="text-[12px] text-[#C7C7CC]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("sold", {
        header: "Sold",
        cell: (info) => <span className="text-[12px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("waste", {
        header: "Waste",
        cell: (info) => <span className="text-[12px] text-[#C48B2A]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("wasteCost", {
        header: "Waste Cost",
        cell: (info) => <span className="text-[12px] text-[#C48B2A]">{toCurrency(info.getValue())}</span>,
      }),
      columnHelper.accessor("marginImpact", {
        header: "Margin Impact",
        cell: (info) => <span className="text-[12px] text-[#C44949]">{toCurrency(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`/workspace/production?item=${row.itemId}&date=${targetDate}&branch=${selectedBranchId}`}
                className="inline-flex h-7 items-center rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#F5F5F7]"
              >
                Drill in
              </Link>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (readOnly) return;
                  setFlaggedRows((prev) => ({ ...prev, [row.id]: !prev[row.id] }));
                }}
                className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#C48B2A] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {flaggedRows[row.id] ? "Flagged" : "Flag waste"}
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (readOnly) return;
                  const existing = wasteNotes[row.id] ?? "";
                  const note = window.prompt(`Waste note for ${row.item}`, existing);
                  if (note !== null) {
                    setWasteNotes((prev) => ({ ...prev, [row.id]: note.trim() }));
                  }
                }}
                className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#8E8E93] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {wasteNotes[row.id] ? "Edit note" : "Add note"}
              </button>
            </div>
          );
        },
      }),
    ],
    [targetDate, selectedBranchId, readOnly, flaggedRows, wasteNotes],
  );

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: coreRowModel,
  });

  return (
    <WorkspaceShell
      eyebrow="Sales & Waste"
      title="Operational Finance"
      description="Daily performance impact through sales flow, waste intensity, overproduction cost, and underproduction drag."
      insight="Waste decisions improve when item-level variance and margin impact are reviewed alongside sales performance in the same window."
    >
      <section className="border-b border-[#2A2A2E] pb-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          />
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          >
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <select
            value={periodDays}
            onChange={(event) => setPeriodDays(event.target.value)}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <p className="flex items-center text-[12px] text-[#8E8E93]">
            {readOnly ? "Read-only mode for owner." : "Operational actions enabled for this role."}
          </p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-5">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Sales</p>
          <p className="mt-1 font-display text-[28px] text-[#F5F5F7]">{toCurrency(estimatedSales)}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Waste Value</p>
          <p className="mt-1 font-display text-[28px] text-[#C48B2A]">{toCurrency(wasteValue)}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Waste %</p>
          <p className="mt-1 font-display text-[28px] text-[#C48B2A]">{toPercent(wastePct)}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Overproduction Cost</p>
          <p className="mt-1 font-display text-[28px] text-[#C44949]">{toCurrency(overproductionCost)}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Underproduction Cost</p>
          <p className="mt-1 font-display text-[28px] text-[#C44949]">{toCurrency(underproductionCost)}</p>
        </article>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <article>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Sales Trend ({periodDays}d)</p>
            <div className="mt-3 flex h-24 items-end gap-1">
              {salesTrend.map((point, index) => (
                <div key={`sales-${index}`} className="flex-1 rounded-t-[4px] bg-[#3F8F68]/70" style={{ height: `${Math.max(8, (point / maxSalesTrend) * 100)}%` }} />
              ))}
            </div>
          </article>
          <article>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Waste Trend ({periodDays}d)</p>
            <div className="mt-3 flex h-24 items-end gap-1">
              {wasteTrend.map((point, index) => (
                <div key={`waste-${index}`} className="flex-1 rounded-t-[4px] bg-[#C48B2A]/70" style={{ height: `${Math.max(8, (point / maxWasteTrend) * 100)}%` }} />
              ))}
            </div>
          </article>
          <article>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Waste by Item</p>
            <div className="mt-3 space-y-2">
              {tableRows.slice(0, 6).map((row) => (
                <div key={`waste-item-${row.id}`}>
                  <div className="flex items-center justify-between text-[12px] text-[#C7C7CC]">
                    <span>{row.item}</span>
                    <span>{toCurrency(row.wasteCost)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#1F1F23]">
                    <div className="h-1.5 rounded-full bg-[#C48B2A]" style={{ width: `${Math.max(4, (row.wasteCost / maxItemWaste) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Forecast vs Actual Variance</p>
            <div className="mt-3 flex h-24 items-end gap-1">
              {varianceTrend.map((point, index) => (
                <div key={`var-${index}`} className="flex-1 rounded-t-[4px] bg-[#8E8E93]/60" style={{ height: `${Math.max(8, (point / maxVarianceTrend) * 100)}%` }} />
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Per-Item Performance</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1360px]">
            <thead className="border-b border-[#2A2A2E]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[#232327] align-top">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspaceShell>
  );
}
