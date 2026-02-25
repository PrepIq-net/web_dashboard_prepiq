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
  }, [isLoading, canAccess, router]);

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

  const branchColumnHelper = createColumnHelper<BranchControlRow>();
  const columns = useMemo(
    () => [
      branchColumnHelper.accessor("branch", {
        header: "Branch",
        cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      branchColumnHelper.accessor("revenue", {
        header: "Revenue",
        cell: (info) => <span className="text-[12px] text-[#C7C7CC]">{toCurrency(info.getValue())}</span>,
      }),
      branchColumnHelper.accessor("marginPct", {
        header: "Margin",
        cell: (info) => <span className="text-[12px] text-[#3F8F68]">{toPercent(info.getValue())}</span>,
      }),
      branchColumnHelper.accessor("riskScore", {
        header: "Risk Score",
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={`text-[12px] ${value >= 65 ? "text-[#C44949]" : value >= 35 ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}>
              {value.toFixed(0)}
            </span>
          );
        },
      }),
      branchColumnHelper.accessor("wastePct", {
        header: "Waste %",
        cell: (info) => <span className="text-[12px] text-[#C48B2A]">{toPercent(info.getValue())}</span>,
      }),
      branchColumnHelper.accessor("efficiencyScore", {
        header: "Efficiency",
        cell: (info) => <span className="text-[12px] text-[#C7C7CC]">{info.getValue().toFixed(1)}</span>,
      }),
      branchColumnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          const colorClass =
            status === "HEALTHY"
              ? "text-[#3F8F68]"
              : status === "AT_RISK"
                ? "text-[#C48B2A]"
                : "text-[#C44949]";
          return <span className={`text-[11px] ${colorClass}`}>{status}</span>;
        },
      }),
      branchColumnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          const target = targetAdjustments[row.id] ?? 0;
          return (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => router.push(`/?branch=${row.id}`)}
                className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#F5F5F7]"
              >
                Open dashboard
              </button>
              <button
                type="button"
                onClick={() => setTargetAdjustments((prev) => ({ ...prev, [row.id]: target + 5 }))}
                className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#A8821F]"
              >
                Set target +5
              </button>
              <Link
                href={`/workspace/settings?branch=${row.id}`}
                className="inline-flex h-7 items-center rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#8E8E93]"
              >
                Manage settings
              </Link>
            </div>
          );
        },
      }),
    ],
    [branchColumnHelper, router, targetAdjustments],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <WorkspaceShell
      eyebrow="Branches"
      title="Branch Control"
      description="Multi-branch performance control surface for revenue, margin, risk, and operational efficiency."
      insight="Executive leverage improves when branch performance is ranked by margin and risk, then reviewed against explicit targets."
    >
      <section className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-4">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Total Branches</p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{rows.length}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Healthy</p>
          <p className="mt-1 font-display text-[30px] text-[#3F8F68]">{statusCounts.healthy}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">At Risk</p>
          <p className="mt-1 font-display text-[30px] text-[#C48B2A]">{statusCounts.atRisk}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Underperforming</p>
          <p className="mt-1 font-display text-[30px] text-[#C44949]">{statusCounts.underperforming}</p>
        </article>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Branch List</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1220px]">
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
                <tr key={row.id} className="border-b border-[#2A2A2E] align-top">
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

      <section className="mt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <article className="lg:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Branch Drill-in</p>
            <div className="mt-3 space-y-2">
              {rows.slice(0, 5).map((row) => (
                <div key={`drill-${row.id}`} className="flex items-center justify-between border-b border-[#2A2A2E] pb-2">
                  <p className="text-[13px] text-[#F5F5F7]">{row.branch}</p>
                  <p className="text-[12px] text-[#C7C7CC]">
                    Revenue {toCurrency(row.revenue)} · Margin {toPercent(row.marginPct)} · Risk {row.riskScore.toFixed(0)}
                  </p>
                </div>
              ))}
              {!rows.length ? (
                <p className="text-[12px] text-[#8E8E93]">No branches found for current organization context.</p>
              ) : null}
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
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>{row.branch}</option>
                ))}
              </select>
              <select
                value={compareB}
                onChange={(event) => setCompareB(event.target.value)}
                className="h-9 w-full rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
              >
                <option value="">Branch B</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>{row.branch}</option>
                ))}
              </select>
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Efficiency delta</p>
                <p className={`mt-1 font-display text-[26px] ${compareDelta >= 0 ? "text-[#3F8F68]" : "text-[#C44949]"}`}>
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
