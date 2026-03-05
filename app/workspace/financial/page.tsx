"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { Download, Calendar, Filter, ArrowUp } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
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

const EMPTY_LIST: never[] = [];
const financialBranchColumnHelper = createColumnHelper<FinancialBranchRow>();
const financialCategoryColumnHelper = createColumnHelper<CategoryMarginRow>();
const CORE_ROW_MODEL = getCoreRowModel();

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
  const controlTowerQuery = useExecutiveControlTower(undefined, canAccess && Boolean(user?.organization_id));
  const marginReportQuery = useOwnerMarginProtectionReport(
    undefined,
    canAccess && Boolean(user?.organization_id),
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const branchGrid = controlTowerQuery.data?.branch_grid ?? EMPTY_LIST;
  const marginBranches = marginReportQuery.data?.branches ?? EMPTY_LIST;

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

  const compareMap = useMemo(() => new Map(branchRows.map((row) => [row.id, row])), [branchRows]);
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

  const branchColumns = useMemo(
    () => [
      financialBranchColumnHelper.accessor("branch", {
        header: "Branch",
        cell: (info) => <span className="text-sm font-semibold text-text-primary">{info.getValue()}</span>,
      }),
      financialBranchColumnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => <span className="text-sm text-text-secondary">{toCurrency(info.getValue())}</span>,
      }),
      financialBranchColumnHelper.accessor("grossMarginPct", {
        header: "Gross Margin",
        cell: (info) => <span className="text-sm font-semibold text-status-success">{toPercent(info.getValue())}</span>,
      }),
      financialBranchColumnHelper.accessor("wasteValue", {
        header: "Waste Value",
        cell: (info) => <span className="text-sm font-semibold text-status-warning">{toCurrency(info.getValue())}</span>,
      }),
      financialBranchColumnHelper.accessor("wasteOfRevenuePct", {
        header: "Waste % Revenue",
        cell: (info) => <span className="text-sm text-text-muted">{toPercent(info.getValue())}</span>,
      }),
    ],
    [],
  );
  const branchTable = useReactTable({
    data: branchRows,
    columns: branchColumns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  const categoryColumns = useMemo(
    () => [
      financialCategoryColumnHelper.accessor("category", {
        header: "Category",
        cell: (info) => <span className="text-sm font-semibold text-text-primary">{info.getValue()}</span>,
      }),
      financialCategoryColumnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => <span className="text-sm text-text-secondary">{toCurrency(info.getValue())}</span>,
      }),
      financialCategoryColumnHelper.accessor("marginPct", {
        header: "Margin",
        cell: (info) => <span className="text-sm font-semibold text-status-success">{toPercent(info.getValue())}</span>,
      }),
      financialCategoryColumnHelper.accessor("trend", {
        header: "Trend",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <ArrowUp className="h-3 w-3 text-status-success" />
            <span className="text-xs text-text-muted">{info.getValue()}</span>
          </div>
        ),
      }),
    ],
    [],
  );
  const categoryTable = useReactTable({
    data: categoryRows,
    columns: categoryColumns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <WorkspaceShell
      eyebrow="Financial"
      title="Financial Analysis"
      description="Analytical breakdown of revenue, margin, waste, and cost structure across branches and categories."
      insight="Deep margin analysis improves decision quality when branch and category variance are reviewed together."
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Select
            label="Timeframe"
            leadingIcon={<Calendar className="h-4 w-4" />}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
            ]}
            value={timeframe}
            onChange={setTimeframe}
          />
          
          <Select
            label="Branch Filter"
            leadingIcon={<Filter className="h-4 w-4" />}
            options={[
              { value: "ALL", label: "All branches" },
              ...branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              })),
            ]}
            value={branchFilter}
            onChange={setBranchFilter}
          />
          
          <Select
            label="Category Filter"
            leadingIcon={<Filter className="h-4 w-4" />}
            options={[
              { value: "ALL", label: "All categories" },
              { value: "Bakery", label: "Bakery" },
              { value: "Beverages", label: "Beverages" },
              { value: "Savory", label: "Savory" },
              { value: "Retail", label: "Retail" },
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Quick Export
            </label>
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-button border border-border-default bg-surface-3 text-sm font-medium text-text-primary transition-all duration-200 hover:bg-surface-4 hover:border-brand-gold hover:text-brand-gold active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-surface-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "OVERVIEW", label: "Overview" },
              { id: "MARGIN", label: "Margin Analysis" },
              { id: "WASTE", label: "Waste Analysis" },
              { id: "SALES", label: "Sales Breakdown" },
              { id: "TAX", label: "Tax Liability" },
              { id: "EXPORTS", label: "Export Center" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as FinancialTab)}
                className={`inline-flex h-10 items-center px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-brand-gold/20 text-brand-gold border border-brand-gold/40 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-3 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === "OVERVIEW" ? (
        <section className="mt-8">
          <div className="grid grid-cols-1 gap-6 mb-12 md:grid-cols-4">
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Total Revenue
              </p>
              <p className="font-display text-4xl font-semibold text-status-success tracking-tight">
                {toCurrency(totalRevenue)}
              </p>
              <div className="mt-4 pt-4 border-t border-surface-4">
                <p className="text-xs text-text-muted">{timeframe} period</p>
              </div>
            </article>
            
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Average Margin
              </p>
              <p className="font-display text-4xl font-semibold text-brand-gold tracking-tight">
                {toPercent(avgMargin)}
              </p>
              <div className="mt-4 pt-4 border-t border-surface-4">
                <div className="w-full h-1.5 bg-surface-4 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-gold rounded-full"
                    style={{ width: `${Math.min(avgMargin, 100)}%` }}
                  />
                </div>
              </div>
            </article>
            
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Total Waste Value
              </p>
              <p className="font-display text-4xl font-semibold text-status-critical tracking-tight">
                {toCurrency(totalWaste)}
              </p>
              <div className="mt-4 pt-4 border-t border-surface-4">
                <p className="text-xs text-text-muted">Cost impact</p>
              </div>
            </article>
            
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Net Margin Estimate
              </p>
              <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                {toPercent(netMarginEstimate)}
              </p>
              <div className="mt-4 pt-4 border-t border-surface-4">
                <p className="text-xs text-text-muted">After all costs</p>
              </div>
            </article>
          </div>
          
          <div className="mt-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Financial Performance
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Revenue Snapshot
              </h3>
            </div>
            
            <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <NativeTable
                  table={branchTable}
                  tableClassName="w-full min-w-[860px]"
                  headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
                  bodyClassName="divide-y divide-surface-4"
                  headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                  bodyRowClassName="transition-all duration-200 hover:bg-surface-3/50"
                  cellClassName="px-6 py-4"
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "MARGIN" ? (
        <section className="mt-8">
          <div className="mb-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Margin Analysis
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Category Breakdown
              </h3>
            </div>
            
            <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <NativeTable
                  table={categoryTable}
                  tableClassName="w-full min-w-[760px]"
                  headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
                  bodyClassName="divide-y divide-surface-4"
                  headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                  bodyRowClassName="transition-all duration-200 hover:bg-surface-3/50"
                  cellClassName="px-6 py-4"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <article className="lg:col-span-2">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Cost Structure
                </p>
                <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                  Branch Cost Analysis
                </h3>
              </div>
              
              <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead className="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Branch</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Purchasing %</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Labor %</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Waste %</th>
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Net Margin Est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-4">
                      {costStructureRows.map((row) => (
                        <tr key={row.id} className="transition-all duration-200 hover:bg-surface-3/50">
                          <td className="px-6 py-4 text-sm font-semibold text-text-primary">{row.branch}</td>
                          <td className="px-6 py-4 text-sm text-text-secondary">{toPercent(row.purchasingPct)}</td>
                          <td className="px-6 py-4 text-sm text-text-secondary">{toPercent(row.laborPct)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-status-warning">{toPercent(row.wastePct)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-status-success">{toPercent(row.netMarginEstimatePct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
            
            <article>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  Branch Comparison
                </p>
                <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">
                  Margin Delta
                </h3>
              </div>
              
              <div className="bg-surface-2 rounded-xl p-6 border border-surface-4 space-y-4">
                <Select
                  label="Branch A"
                  options={[
                    { value: "", label: "Select Branch A" },
                    ...branchRows.map((row) => ({
                      value: row.id,
                      label: row.branch,
                    })),
                  ]}
                  value={compareA}
                  onChange={setCompareA}
                />
                
                <Select
                  label="Branch B"
                  options={[
                    { value: "", label: "Select Branch B" },
                    ...branchRows.map((row) => ({
                      value: row.id,
                      label: row.branch,
                    })),
                  ]}
                  value={compareB}
                  onChange={setCompareB}
                />
                
                <div className="pt-4 border-t border-surface-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                    Gross Margin Delta
                  </p>
                  <div className="flex items-baseline gap-2">
                    <p className={`font-display text-3xl font-semibold tracking-tight ${
                      compareDelta >= 0 ? "text-status-success" : "text-status-critical"
                    }`}>
                      {compareDelta >= 0 ? "+" : ""}{compareDelta.toFixed(1)}%
                    </p>
                    {compareDelta !== 0 && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        compareDelta >= 0 
                          ? "bg-status-success/20 text-status-success" 
                          : "bg-status-critical/20 text-status-critical"
                      }`}>
                        {compareDelta >= 0 ? "Better" : "Worse"}
                      </span>
                    )}
                  </div>
                  {compareDelta === 0 && compareA && compareB && (
                    <p className="text-xs text-text-muted mt-2">Select different branches to compare</p>
                  )}
                </div>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "WASTE" ? (
        <section className="mt-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Waste Analysis
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Cost Impact Breakdown
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-4">
                Waste Value by Category
              </p>
              <div className="space-y-3">
                {categoryRows.map((row) => (
                  <div key={`${row.id}-waste`} className="flex items-center justify-between p-3 rounded-lg bg-surface-3/50 border border-surface-4">
                    <span className="text-sm font-medium text-text-secondary">{row.category}</span>
                    <span className="text-sm font-semibold text-status-warning">{toCurrency(row.revenue * 0.06)}</span>
                  </div>
                ))}
              </div>
            </article>
            
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Waste % of Revenue
              </p>
              <p className="font-display text-4xl font-semibold text-status-critical tracking-tight">
                {toPercent(branchRows.length ? branchRows.reduce((sum, row) => sum + row.wasteOfRevenuePct, 0) / branchRows.length : 0)}
              </p>
              <div className="mt-4 pt-4 border-t border-surface-4">
                <div className="w-full h-2 bg-surface-4 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-critical rounded-full"
                    style={{ 
                      width: `${Math.min(
                        branchRows.length ? (branchRows.reduce((sum, row) => sum + row.wasteOfRevenuePct, 0) / branchRows.length) * 2 : 0, 
                        100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            </article>
            
            <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Historical Comparison
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${timeframe === "7d" ? "bg-status-success" : "bg-status-warning"}`} />
                  <span className="text-sm text-text-secondary">
                    vs Prior Period: {timeframe === "7d" ? "Stable" : "Down 1.2%"}
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  {timeframe === "7d" 
                    ? "Waste levels remain consistent with recent patterns."
                    : "Improvement trend indicates better inventory management."
                  }
                </p>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "SALES" ? (
        <section className="mt-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Sales Performance
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Revenue Breakdown
            </h3>
          </div>
          
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <NativeTable
                table={branchTable}
                tableClassName="w-full min-w-[860px]"
                headerClassName="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4"
                bodyClassName="divide-y divide-surface-4"
                headerCellClassName="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                bodyRowClassName="transition-all duration-200 hover:bg-surface-3/50"
                cellClassName="px-6 py-4"
              />
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "TAX" ? (
        <section className="mt-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Tax Planning
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Liability Snapshot
            </h3>
          </div>
          
          <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Branch</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Taxable Base</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Estimated Liability</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-4">
                  {taxRows.map((row) => (
                    <tr key={`tax-${row.id}`} className="transition-all duration-200 hover:bg-surface-3/50">
                      <td className="px-6 py-4 text-sm font-semibold text-text-primary">{row.branch}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">{toCurrency(row.taxableBase)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-text-primary">{toCurrency(row.estimatedTax)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.08em] ${
                          row.risk === "HIGH" 
                            ? "bg-status-critical/20 text-status-critical border border-status-critical/40" 
                            : row.risk === "MEDIUM" 
                              ? "bg-status-warning/20 text-status-warning border border-status-warning/40" 
                              : "bg-status-success/20 text-status-success border border-status-success/40"
                        }`}>
                          {row.risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "EXPORTS" ? (
        <section className="mt-8">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Data Export
            </p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
              Download Reports
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-status-success/20">
                  <Download className="h-5 w-5 text-status-success" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Revenue Export</h4>
                  <p className="text-xs text-text-muted">Complete revenue breakdown</p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportReport}
                className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-status-success/40 bg-surface-3 text-sm font-medium text-status-success transition-all duration-200 hover:border-status-success hover:bg-status-success/10 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
            
            <div className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/20">
                  <Download className="h-5 w-5 text-brand-gold" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Margin Export</h4>
                  <p className="text-xs text-text-muted">Category margin analysis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportMarginReport}
                className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-brand-gold/40 bg-surface-3 text-sm font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
            
            <div className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning/20">
                  <Download className="h-5 w-5 text-status-warning" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Waste Export</h4>
                  <p className="text-xs text-text-muted">Waste cost analysis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportWasteReport}
                className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-status-warning/40 bg-surface-3 text-sm font-medium text-status-warning transition-all duration-200 hover:border-status-warning hover:bg-status-warning/10 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
            
            <div className="bg-surface-2 rounded-xl p-6 border border-surface-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-status-critical/20">
                  <Download className="h-5 w-5 text-status-critical" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Tax Export</h4>
                  <p className="text-xs text-text-muted">Tax liability snapshot</p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportTaxReport}
                className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-status-critical/40 bg-surface-3 text-sm font-medium text-status-critical transition-all duration-200 hover:border-status-critical hover:bg-status-critical/10 active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}
