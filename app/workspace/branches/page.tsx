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
import { useBranches, useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";

type BranchControlRow = {
  id: string;
  branch: string;
  revenue: number;
  marginPct: number;
  riskScore: number;
  wastePct: number;
  efficiencyScore: number;
  status: "HEALTHY" | "AT_RISK" | "UNDERPERFORMING";
};

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

const branchColumnHelper = createColumnHelper<BranchControlRow>();
const coreRowModel = getCoreRowModel();

export default function BranchesPage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const canAccess = ["OPS_DIRECTOR", "ORG_OWNER", "ORG_ADMIN"].includes(role);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const controlTowerQuery = useExecutiveControlTower(undefined, canAccess);
  const marginReportQuery = useOwnerMarginProtectionReport(undefined, canAccess);

  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [targetAdjustments, setTargetAdjustments] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const branches = branchesQuery.data ?? [];
  const branchGrid = controlTowerQuery.data?.branch_grid ?? [];
  const marginBranches = marginReportQuery.data?.branches ?? [];

  const rows = useMemo<BranchControlRow[]>(() => {
    return branchGrid.map((branch) => {
      const wastePct = Number(branch.waste_pct ?? 0);
      const surplusPct = Number(branch.surplus_pct ?? 0);
      const revenue = Number(branch.revenue ?? 0);
      const marginEntry = marginBranches.find((item) => item.branch_id === branch.branch_id);
      const marginPct =
        Number(marginEntry?.forecast_accuracy_summary ?? 0) > 0
          ? Number(marginEntry?.forecast_accuracy_summary ?? 0)
          : Math.max(0, 68 - wastePct * 0.7 - surplusPct * 0.3);

      const efficiencyScore = Math.max(0, 100 - wastePct - surplusPct * 0.6);
      const riskScore = Math.max(0, Math.min(100, wastePct * 10 + surplusPct * 7));

      const status: BranchControlRow["status"] =
        wastePct >= 6 || riskScore >= 65
          ? "UNDERPERFORMING"
          : wastePct >= 3 || riskScore >= 35
            ? "AT_RISK"
            : "HEALTHY";

      return {
        id: branch.branch_id,
        branch: branch.branch_name,
        revenue,
        marginPct,
        riskScore,
        wastePct,
        efficiencyScore,
        status,
      };
    });
  }, [branchGrid, marginBranches]);

  const statusCounts = {
    healthy: rows.filter((row) => row.status === "HEALTHY").length,
    atRisk: rows.filter((row) => row.status === "AT_RISK").length,
    underperforming: rows.filter((row) => row.status === "UNDERPERFORMING").length,
  };

  const compareMap = new Map(rows.map((row) => [row.id, row]));
  const compareDelta =
    compareA && compareB && compareA !== compareB
      ? (compareMap.get(compareA)?.efficiencyScore ?? 0) -
        (compareMap.get(compareB)?.efficiencyScore ?? 0)
      : 0;

  const columns = useMemo(
    () => [
      branchColumnHelper.accessor("branch", {
        header: "Branch",
        cell: (info) => (
          <span className="text-sm font-semibold text-text-primary">
            {info.getValue()}
          </span>
        ),
      }),
      branchColumnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => (
          <div className="inline-flex items-baseline gap-1">
            <span className="text-sm font-bold text-brand-gold tracking-tight">
              {toCurrency(info.getValue())}
            </span>
            <span className="text-xs text-text-muted font-medium">USD</span>
          </div>
        ),
      }),
      branchColumnHelper.accessor("marginPct", {
        header: "Margin",
        cell: (info) => (
          <span className="text-sm font-semibold text-status-success">
            {toPercent(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("riskScore", {
        header: "Risk Score",
        cell: (info) => {
          const value = info.getValue();
          const colorClass = value >= 65 
            ? "text-status-critical" 
            : value >= 35 
              ? "text-status-warning" 
              : "text-status-success";
          return (
            <span className={`text-sm font-bold ${colorClass}`}>
              {value.toFixed(0)}
            </span>
          );
        },
      }),
      branchColumnHelper.accessor("wastePct", {
        header: "Waste %",
        cell: (info) => (
          <span className="text-sm font-semibold text-status-warning">
            {toPercent(info.getValue())}
          </span>
        ),
      }),
      branchColumnHelper.accessor("efficiencyScore", {
        header: "Efficiency",
        cell: (info) => (
          <span className="text-sm font-medium text-text-secondary">
            {info.getValue().toFixed(1)}
          </span>
        ),
      }),
      branchColumnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          const colorClass =
            status === "HEALTHY"
              ? "text-status-success bg-status-success/10 border-status-success/20"
              : status === "AT_RISK"
                ? "text-status-warning bg-status-warning/10 border-status-warning/20"
                : "text-status-critical bg-status-critical/10 border-status-critical/20";
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${colorClass}`}>
              {status.replace("_", " ")}
            </span>
          );
        },
      }),
      branchColumnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          const target = targetAdjustments[row.id] ?? 0;
          return (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(`/?branch=${row.id}`)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-gold/40 bg-surface-3 px-3 text-xs font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold-hover active:scale-[0.98]"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setTargetAdjustments((prev) => ({ ...prev, [row.id]: target + 5 }))}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-secondary transition-all duration-200 hover:border-surface-4 hover:bg-surface-2 hover:text-text-primary active:scale-[0.98]"
              >
                +5 Target
              </button>
              <Link
                href={`/workspace/settings?branch=${row.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-surface-4 bg-surface-3 px-3 text-xs font-medium text-text-muted transition-all duration-200 hover:border-surface-4 hover:bg-surface-2 hover:text-text-secondary active:scale-[0.98]"
              >
                Settings
              </Link>
            </div>
          );
        },
      }),
    ],
    [router, targetAdjustments],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: coreRowModel,
  });

  return (
    <WorkspaceShell
      eyebrow="Branches"
      title="Branch Control"
      description="Multi-branch performance control surface for revenue, margin, risk, and operational efficiency."
      insight="Executive leverage improves when branch performance is ranked by margin and risk, then reviewed against explicit targets."
    >
      <section className="grid grid-cols-1 gap-8 border-b border-surface-4 pb-12 mb-12 md:grid-cols-4">
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            Total Branches
          </p>
          <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
            {rows.length}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">Active locations</p>
          </div>
        </article>
        
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            Healthy
          </p>
          <p className="font-display text-4xl font-semibold text-status-success tracking-tight">
            {statusCounts.healthy}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">Performing well</p>
          </div>
        </article>
        
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            At Risk
          </p>
          <p className="font-display text-4xl font-semibold text-status-warning tracking-tight">
            {statusCounts.atRisk}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">Needs attention</p>
          </div>
        </article>
        
        <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
            Underperforming
          </p>
          <p className="font-display text-4xl font-semibold text-status-critical tracking-tight">
            {statusCounts.underperforming}
          </p>
          <div className="mt-4 pt-4 border-t border-surface-4">
            <p className="text-xs text-text-muted">Critical status</p>
          </div>
        </article>
      </section>

      <section className="mt-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Branch Performance
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Branch Control Table
          </h3>
        </div>
        
        <div className="bg-surface-2 rounded-xl border border-surface-4 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px]">
              <thead className="bg-gradient-to-br from-surface-3 to-surface-2 border-b border-surface-4">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-surface-4">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="align-top transition-all duration-200 hover:bg-surface-3/50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-6">
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

      <section className="mt-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <article className="lg:col-span-2 bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-4">
              Branch Drill-in
            </p>
            <div className="space-y-3">
              {rows.slice(0, 5).map((row) => (
                <div key={`drill-${row.id}`} className="flex items-center justify-between pb-3 border-b border-surface-4 last:border-b-0 last:pb-0">
                  <p className="text-sm font-semibold text-text-primary">{row.branch}</p>
                  <p className="text-xs text-text-secondary">
                    Revenue {toCurrency(row.revenue)} · Margin {toPercent(row.marginPct)} · Risk {row.riskScore.toFixed(0)}
                  </p>
                </div>
              ))}
              {!rows.length ? (
                <p className="text-sm text-text-muted">No branches found for current organization context.</p>
              ) : null}
            </div>
          </article>

          <article className="bg-surface-2 rounded-xl p-6 border border-surface-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold mb-4">
              Compare Branches
            </p>
            <div className="space-y-3">
              <select
                value={compareA}
                onChange={(event) => setCompareA(event.target.value)}
                className="h-10 w-full rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
              >
                <option value="">Branch A</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>{row.branch}</option>
                ))}
              </select>
              <select
                value={compareB}
                onChange={(event) => setCompareB(event.target.value)}
                className="h-10 w-full rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
              >
                <option value="">Branch B</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>{row.branch}</option>
                ))}
              </select>
              <div className="pt-3 mt-3 border-t border-surface-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">
                  Efficiency Delta
                </p>
                <p className={`font-display text-3xl font-bold tracking-tight ${compareDelta >= 0 ? "text-status-success" : "text-status-critical"}`}>
                  {compareDelta >= 0 ? "+" : ""}{compareDelta.toFixed(1)}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </WorkspaceShell>
  );
}
