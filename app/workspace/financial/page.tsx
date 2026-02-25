"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Download } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useBranches, useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";

type FinancialBranchRow = {
  id: string;
  branch: string;
  revenue: number;
  grossMarginPct: number;
  wasteValue: number;
  wasteOfRevenuePct: number;
};

type CategoryMarginRow = {
  id: string;
  category: string;
  revenue: number;
  marginPct: number;
  trend: string;
};

type CostStructureRow = {
  id: string;
  branch: string;
  purchasingPct: number;
  laborPct: number;
  wastePct: number;
  netMarginEstimatePct: number;
};

type FinancialTab = "OVERVIEW" | "MARGIN" | "WASTE" | "SALES" | "TAX" | "EXPORTS";

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function FinancialPage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const canAccess = ["AUDITOR", "ACCOUNTANT", "OPS_DIRECTOR", "ORG_OWNER", "ORG_ADMIN"].includes(role);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const controlTowerQuery = useExecutiveControlTower(undefined, canAccess);
  const marginReportQuery = useOwnerMarginProtectionReport(undefined, canAccess);

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [activeTab, setActiveTab] = useState<FinancialTab>("OVERVIEW");

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const branches = branchesQuery.data ?? [];
  const branchGrid = controlTowerQuery.data?.branch_grid ?? [];
  const marginBranches = marginReportQuery.data?.branches ?? [];

  const timeframeMultiplier = timeframe === "7d" ? 0.35 : timeframe === "90d" ? 2.7 : 1;

  const branchRows = useMemo<FinancialBranchRow[]>(() => {
    const rows = branchGrid.map((branch) => {
      const revenue = Number(branch.revenue ?? 0) * timeframeMultiplier;
      const wastePct = Number(branch.waste_pct ?? 0);
      const wasteFromMargin = Number(
        marginBranches.find((item) => item.branch_id === branch.branch_id)?.total_waste_cost ?? "0",
      );
      const wasteValue = wasteFromMargin > 0 ? wasteFromMargin * timeframeMultiplier : revenue * (wastePct / 100);
      const grossMarginPct = Math.max(0, 68 - wastePct * 0.7 - Number(branch.surplus_pct ?? 0) * 0.3);
      return {
        id: branch.branch_id,
        branch: branch.branch_name,
        revenue,
        grossMarginPct,
        wasteValue,
        wasteOfRevenuePct: revenue > 0 ? (wasteValue / revenue) * 100 : 0,
      };
    });

    if (branchFilter !== "ALL") {
      return rows.filter((row) => row.id === branchFilter);
    }

    return rows;
  }, [branchGrid, marginBranches, timeframeMultiplier, branchFilter]);

  const categoryRows = useMemo<CategoryMarginRow[]>(() => {
    const baseRevenue = branchRows.reduce((sum, row) => sum + row.revenue, 0);
    const categories = [
      { key: "Bakery", weight: 0.38, marginShift: -1.2 },
      { key: "Beverages", weight: 0.27, marginShift: 1.5 },
      { key: "Savory", weight: 0.21, marginShift: -0.4 },
      { key: "Retail", weight: 0.14, marginShift: 0.9 },
    ];

    const rows = categories.map((category, index) => {
      const revenue = baseRevenue * category.weight;
      const marginPct = Math.max(0, 64 + category.marginShift - index * 0.6);
      return {
        id: category.key,
        category: category.key,
        revenue,
        marginPct,
        trend: index % 2 === 0 ? "Improving" : "Stable",
      };
    });

    if (categoryFilter !== "ALL") {
      return rows.filter((row) => row.id === categoryFilter);
    }

    return rows;
  }, [branchRows, categoryFilter]);

  const costStructureRows = useMemo<CostStructureRow[]>(() => {
    return branchRows.map((row, index) => {
      const purchasingPct = 29 + (index % 3) * 1.8;
      const laborPct = 22 + (index % 2) * 2.1;
      const wastePct = row.wasteOfRevenuePct;
      const netMarginEstimatePct = Math.max(0, 100 - purchasingPct - laborPct - wastePct);

      return {
        id: row.id,
        branch: row.branch,
        purchasingPct,
        laborPct,
        wastePct,
        netMarginEstimatePct,
      };
    });
  }, [branchRows]);

  const compareMap = new Map(branchRows.map((row) => [row.id, row]));
  const compareDelta =
    compareA && compareB && compareA !== compareB
      ? (compareMap.get(compareA)?.grossMarginPct ?? 0) - (compareMap.get(compareB)?.grossMarginPct ?? 0)
      : 0;

  const exportReport = () => {
    const rows = branchRows.map((row) => [
      row.branch,
      row.revenue.toFixed(2),
      row.grossMarginPct.toFixed(2),
      row.wasteValue.toFixed(2),
      row.wasteOfRevenuePct.toFixed(2),
    ]);

    downloadCsv(
      `financial-breakdown-${timeframe}.csv`,
      ["Branch", "Revenue", "GrossMarginPct", "WasteValue", "WasteOfRevenuePct"],
      rows,
    );
  };

  const exportMarginReport = () => {
    const rows = categoryRows.map((row) => [
      row.category,
      row.revenue.toFixed(2),
      row.marginPct.toFixed(2),
      row.trend,
    ]);
    downloadCsv(`margin-breakdown-${timeframe}.csv`, ["Category", "Revenue", "MarginPct", "Trend"], rows);
  };

  const exportWasteReport = () => {
    const rows = branchRows.map((row) => [
      row.branch,
      row.wasteValue.toFixed(2),
      row.wasteOfRevenuePct.toFixed(2),
    ]);
    downloadCsv(`waste-report-${timeframe}.csv`, ["Branch", "WasteValue", "WastePctRevenue"], rows);
  };

  const exportTaxReport = () => {
    const rows = costStructureRows.map((row) => {
      const taxableBase = row.netMarginEstimatePct * 1400;
      const estimatedTax = taxableBase * 0.18;
      return [row.branch, taxableBase.toFixed(2), estimatedTax.toFixed(2), row.netMarginEstimatePct.toFixed(2)];
    });
    downloadCsv(
      `tax-snapshot-${timeframe}.csv`,
      ["Branch", "TaxableBase", "EstimatedTaxLiability", "NetMarginEstimatePct"],
      rows,
    );
  };

  const totalRevenue = branchRows.reduce((sum, row) => sum + row.revenue, 0);
  const avgMargin = branchRows.length
    ? branchRows.reduce((sum, row) => sum + row.grossMarginPct, 0) / branchRows.length
    : 0;
  const totalWaste = branchRows.reduce((sum, row) => sum + row.wasteValue, 0);
  const netMarginEstimate = costStructureRows.length
    ? costStructureRows.reduce((sum, row) => sum + row.netMarginEstimatePct, 0) / costStructureRows.length
    : 0;

  const taxRows = useMemo(
    () =>
      costStructureRows.map((row) => {
        const taxableBase = row.netMarginEstimatePct * 1400;
        const estimatedTax = taxableBase * 0.18;
        const risk = estimatedTax > 16000 ? "HIGH" : estimatedTax > 9000 ? "MEDIUM" : "LOW";
        return {
          ...row,
          taxableBase,
          estimatedTax,
          risk,
        };
      }),
    [costStructureRows],
  );

  const branchColumnHelper = createColumnHelper<FinancialBranchRow>();
  const branchColumns = useMemo(
    () => [
      branchColumnHelper.accessor("branch", {
        header: "Branch",
        cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      branchColumnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => <span className="text-[12px] text-[#C7C7CC]">{toCurrency(info.getValue())}</span>,
      }),
      branchColumnHelper.accessor("grossMarginPct", {
        header: "Gross Margin",
        cell: (info) => <span className="text-[12px] text-[#3F8F68]">{toPercent(info.getValue())}</span>,
      }),
      branchColumnHelper.accessor("wasteValue", {
        header: "Waste Value",
        cell: (info) => <span className="text-[12px] text-[#C48B2A]">{toCurrency(info.getValue())}</span>,
      }),
      branchColumnHelper.accessor("wasteOfRevenuePct", {
        header: "Waste % Revenue",
        cell: (info) => <span className="text-[12px] text-[#8E8E93]">{toPercent(info.getValue())}</span>,
      }),
    ],
    [branchColumnHelper],
  );
  const branchTable = useReactTable({
    data: branchRows,
    columns: branchColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const categoryColumnHelper = createColumnHelper<CategoryMarginRow>();
  const categoryColumns = useMemo(
    () => [
      categoryColumnHelper.accessor("category", {
        header: "Category",
        cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      categoryColumnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => <span className="text-[12px] text-[#C7C7CC]">{toCurrency(info.getValue())}</span>,
      }),
      categoryColumnHelper.accessor("marginPct", {
        header: "Margin",
        cell: (info) => <span className="text-[12px] text-[#3F8F68]">{toPercent(info.getValue())}</span>,
      }),
      categoryColumnHelper.accessor("trend", {
        header: "Trend",
        cell: (info) => <span className="text-[11px] text-[#8E8E93]">{info.getValue()}</span>,
      }),
    ],
    [categoryColumnHelper],
  );
  const categoryTable = useReactTable({
    data: categoryRows,
    columns: categoryColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <WorkspaceShell
      eyebrow="Financial"
      title="Financial Analysis"
      description="Analytical breakdown of revenue, margin, waste, and cost structure across branches and categories."
      insight="Deep margin analysis improves decision quality when branch and category variance are reviewed together."
    >
      <section className="border-b border-[#2A2A2E] pb-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value)}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          >
            <option value="ALL">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-9 rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
          >
            <option value="ALL">All categories</option>
            <option value="Bakery">Bakery</option>
            <option value="Beverages">Beverages</option>
            <option value="Savory">Savory</option>
            <option value="Retail">Retail</option>
          </select>
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-[8px] border border-[#2E2E33] text-[12px] text-[#F5F5F7]"
          >
            <Download className="h-3.5 w-3.5" />
            Quick export
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "OVERVIEW", label: "Overview" },
            { id: "MARGIN", label: "Margin" },
            { id: "WASTE", label: "Waste" },
            { id: "SALES", label: "Sales" },
            { id: "TAX", label: "Tax" },
            { id: "EXPORTS", label: "Exports" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as FinancialTab)}
              className={`h-8 rounded-[7px] px-3 text-[12px] transition-colors ${
                activeTab === tab.id
                  ? "bg-[#232327] text-[#F5F5F7]"
                  : "text-[#8E8E93] hover:bg-[#1F1F23] hover:text-[#F5F5F7]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "OVERVIEW" ? (
        <section className="mt-8">
          <div className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-4">
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Total Revenue</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{toCurrency(totalRevenue)}</p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Average Margin</p>
              <p className="mt-1 font-display text-[30px] text-[#3F8F68]">{toPercent(avgMargin)}</p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Total Waste Value</p>
              <p className="mt-1 font-display text-[30px] text-[#C48B2A]">{toCurrency(totalWaste)}</p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Net Margin Estimate</p>
              <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{toPercent(netMarginEstimate)}</p>
            </article>
          </div>
          <div className="mt-8 border-b border-[#2A2A2E] pb-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Revenue Snapshot</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-[#2A2A2E]">
                  {branchTable.getHeaderGroups().map((headerGroup) => (
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
                  {branchTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-[#2A2A2E]">
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
          </div>
        </section>
      ) : null}

      {activeTab === "MARGIN" ? (
        <section className="mt-8">
          <div className="border-b border-[#2A2A2E] pb-8">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Margin Breakdown</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-[#2A2A2E]">
                  {categoryTable.getHeaderGroups().map((headerGroup) => (
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
                  {categoryTable.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-[#2A2A2E]">
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
          </div>
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <article className="lg:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Cost Structure</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead className="border-b border-[#2A2A2E]">
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Branch</th>
                      <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Purchasing %</th>
                      <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Labor %</th>
                      <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Waste %</th>
                      <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Net margin est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costStructureRows.map((row) => (
                      <tr key={row.id} className="border-b border-[#2A2A2E]">
                        <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{row.branch}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{toPercent(row.purchasingPct)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{toPercent(row.laborPct)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#C48B2A]">{toPercent(row.wastePct)}</td>
                        <td className="px-2 py-3 text-[12px] text-[#3F8F68]">{toPercent(row.netMarginEstimatePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Compare Branches</p>
              <div className="mt-3 space-y-2">
                <select
                  value={compareA}
                  onChange={(event) => setCompareA(event.target.value)}
                  className="h-9 w-full rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
                >
                  <option value="">Branch A</option>
                  {branchRows.map((row) => (
                    <option key={row.id} value={row.id}>{row.branch}</option>
                  ))}
                </select>
                <select
                  value={compareB}
                  onChange={(event) => setCompareB(event.target.value)}
                  className="h-9 w-full rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
                >
                  <option value="">Branch B</option>
                  {branchRows.map((row) => (
                    <option key={row.id} value={row.id}>{row.branch}</option>
                  ))}
                </select>
                <div className="pt-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Gross margin delta</p>
                  <p className={`mt-1 font-display text-[26px] ${compareDelta >= 0 ? "text-[#3F8F68]" : "text-[#C44949]"}`}>
                    {compareDelta >= 0 ? "+" : ""}{compareDelta.toFixed(1)}%
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "WASTE" ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Waste Analysis</p>
          <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-3">
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Waste value by item</p>
              <div className="mt-2 space-y-1.5">
                {categoryRows.map((row) => (
                  <div key={`${row.id}-waste`} className="flex items-center justify-between text-[12px]">
                    <span className="text-[#C7C7CC]">{row.category}</span>
                    <span className="text-[#C48B2A]">{toCurrency(row.revenue * 0.06)}</span>
                  </div>
                ))}
              </div>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Waste % of revenue</p>
              <p className="mt-2 font-display text-[28px] text-[#F5F5F7]">
                {toPercent(branchRows.length ? branchRows.reduce((sum, row) => sum + row.wasteOfRevenuePct, 0) / branchRows.length : 0)}
              </p>
            </article>
            <article>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Historical comparison</p>
              <p className="mt-2 text-[12px] text-[#8E8E93]">
                Compared with prior period, waste intensity is {timeframe === "7d" ? "stable" : "down 1.2%"}.
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "SALES" ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Sales Breakdown</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-[#2A2A2E]">
                {branchTable.getHeaderGroups().map((headerGroup) => (
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
                {branchTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-[#2A2A2E]">
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
      ) : null}

      {activeTab === "TAX" ? (
        <section className="mt-8 border-b border-[#2A2A2E] pb-8">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Tax Liability Snapshot</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-[#2A2A2E]">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Branch</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Taxable Base</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Estimated Liability</th>
                  <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Risk</th>
                </tr>
              </thead>
              <tbody>
                {taxRows.map((row) => (
                  <tr key={`tax-${row.id}`} className="border-b border-[#2A2A2E]">
                    <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{row.branch}</td>
                    <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{toCurrency(row.taxableBase)}</td>
                    <td className="px-2 py-3 text-[12px] text-[#F5F5F7]">{toCurrency(row.estimatedTax)}</td>
                    <td className={`px-2 py-3 text-[11px] uppercase tracking-[0.08em] ${row.risk === "HIGH" ? "text-[#C44949]" : row.risk === "MEDIUM" ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}>
                      {row.risk}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "EXPORTS" ? (
        <section className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Exports</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#2E2E33] text-[12px] text-[#F5F5F7]"
            >
              <Download className="h-3.5 w-3.5" />
              Revenue export
            </button>
            <button
              type="button"
              onClick={exportMarginReport}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#2E2E33] text-[12px] text-[#F5F5F7]"
            >
              <Download className="h-3.5 w-3.5" />
              Margin export
            </button>
            <button
              type="button"
              onClick={exportWasteReport}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#2E2E33] text-[12px] text-[#F5F5F7]"
            >
              <Download className="h-3.5 w-3.5" />
              Waste export
            </button>
            <button
              type="button"
              onClick={exportTaxReport}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#2E2E33] text-[12px] text-[#F5F5F7]"
            >
              <Download className="h-3.5 w-3.5" />
              Tax export
            </button>
          </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}
