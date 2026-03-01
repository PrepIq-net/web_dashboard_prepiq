"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";

type RiskCategory = {
  key: "margin" | "compliance" | "inventory" | "tax" | "supplier";
  label: string;
  score: number;
  trendDelta: number;
};

type HighImpactFlag = {
  id: string;
  title: string;
  branch: string;
  category: string;
  impact: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
};

type BranchRiskRow = {
  id: string;
  branch: string;
  composite: number;
  margin: number;
  compliance: number;
  inventory: number;
  tax: number;
  supplier: number;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function riskTone(score: number) {
  if (score >= 70) return "text-[#C44949]";
  if (score >= 45) return "text-[#C48B2A]";
  return "text-[#3F8F68]";
}

function impactFromSeverity(severity?: string | null) {
  if (severity === "HIGH") return 1500;
  if (severity === "MEDIUM") return 700;
  return 250;
}

const branchColumnHelper = createColumnHelper<BranchRiskRow>();
const coreRowModel = getCoreRowModel();

export default function RiskPage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const canAccess = ["OPS_DIRECTOR", "ORG_OWNER", "ORG_ADMIN", "AUDITOR", "ACCOUNTANT"].includes(role);
  const financialOnly = role === "AUDITOR" || role === "ACCOUNTANT";

  const controlTowerQuery = useExecutiveControlTower(undefined, canAccess);
  const marginReportQuery = useOwnerMarginProtectionReport(undefined, canAccess);

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const alerts = controlTowerQuery.data?.alerts ?? [];
  const branchGrid = controlTowerQuery.data?.branch_grid ?? [];
  const marginBranches = marginReportQuery.data?.branches ?? [];
  const totalWasteCost = Number(marginReportQuery.data?.summary?.total_waste_cost ?? "0");

  const textSignals = useMemo(() => {
    return alerts.map((alert) => ({
      ...alert,
      text: `${alert.type ?? ""} ${alert.title ?? ""} ${alert.context ?? ""}`.toLowerCase(),
    }));
  }, [alerts]);

  const supplierAlertCount = textSignals.filter((alert) => alert.text.includes("supplier") || alert.text.includes("purchase") || alert.text.includes("cost")).length;
  const inventoryAlertCount = textSignals.filter((alert) => alert.text.includes("stock") || alert.text.includes("inventory")).length;
  const complianceAlertCount = textSignals.filter((alert) => alert.text.includes("compliance") || alert.text.includes("policy")).length;
  const taxAlertCount = textSignals.filter((alert) => alert.text.includes("tax") || alert.text.includes("filing")).length;

  const categoryRows = useMemo<RiskCategory[]>(() => {
    const avgWastePct = branchGrid.length
      ? branchGrid.reduce((sum, branch) => sum + Number(branch.waste_pct ?? 0), 0) / branchGrid.length
      : 0;
    const avgMarginDeviationAbs = marginBranches.length
      ? marginBranches.reduce((sum, branch) => sum + Math.abs(Number(branch.margin_deviation_pct ?? 0)), 0) /
        marginBranches.length
      : 0;

    const margin = clampScore(avgMarginDeviationAbs * 10 + avgWastePct * 6 + Math.min(20, totalWasteCost / 450));
    const compliance = clampScore(complianceAlertCount * 16 + alerts.filter((a) => a.severity === "HIGH").length * 8);
    const inventory = clampScore(inventoryAlertCount * 18 + avgWastePct * 5);
    const tax = clampScore(taxAlertCount * 20 + Math.min(30, totalWasteCost / 900));
    const supplier = clampScore(supplierAlertCount * 17 + Math.min(25, avgMarginDeviationAbs * 4));

    const rows: RiskCategory[] = [
      { key: "margin", label: "Margin Risk", score: margin, trendDelta: Math.max(-8, 4 - avgWastePct * 0.9) },
      { key: "compliance", label: "Compliance Risk", score: compliance, trendDelta: compliance >= 50 ? 5.2 : -2.4 },
      { key: "inventory", label: "Inventory Risk", score: inventory, trendDelta: inventory >= 50 ? 4.1 : -1.8 },
      { key: "tax", label: "Tax Risk", score: tax, trendDelta: tax >= 50 ? 3.6 : -1.2 },
      { key: "supplier", label: "Supplier Risk", score: supplier, trendDelta: supplier >= 50 ? 4.7 : -0.9 },
    ];

    return financialOnly ? rows.filter((row) => row.key === "margin" || row.key === "tax" || row.key === "supplier") : rows;
  }, [
    branchGrid,
    marginBranches,
    alerts,
    totalWasteCost,
    complianceAlertCount,
    inventoryAlertCount,
    taxAlertCount,
    supplierAlertCount,
    financialOnly,
  ]);

  const filteredCategoryRows = useMemo(() => {
    if (categoryFilter === "ALL") return categoryRows;
    return categoryRows.filter((row) => row.key === categoryFilter);
  }, [categoryRows, categoryFilter]);

  const highImpactFlags = useMemo<HighImpactFlag[]>(() => {
    const fromAlerts: HighImpactFlag[] = alerts.map((alert, index) => ({
      id: `flag-${alert.id}`,
      title: alert.title || alert.type || "Risk signal",
      branch: alert.branch_name,
      category: (() => {
        const text = `${alert.type ?? ""} ${alert.title ?? ""} ${alert.context ?? ""}`.toLowerCase();
        if (text.includes("tax")) return "Tax";
        if (text.includes("supplier") || text.includes("purchase")) return "Supplier";
        if (text.includes("stock") || text.includes("inventory")) return "Inventory";
        if (text.includes("compliance")) return "Compliance";
        return "Margin";
      })(),
      impact: impactFromSeverity(alert.severity) + (alerts.length - index) * 120,
      severity: alert.severity === "HIGH" ? "HIGH" : alert.severity === "MEDIUM" ? "MEDIUM" : "LOW",
    }));

    const marginDriven: HighImpactFlag[] = marginBranches
      .filter((branch) => Number(branch.margin_deviation_pct ?? 0) < -1)
      .map((branch) => ({
        id: `flag-margin-${branch.branch_id}`,
        title: `Margin deviation ${Math.abs(Number(branch.margin_deviation_pct ?? 0)).toFixed(1)}%`,
        branch: branch.branch_name,
        category: "Margin",
        impact: Math.round(Number(branch.total_waste_cost ?? "0") * 0.3),
        severity: Number(branch.margin_deviation_pct ?? 0) <= -4 ? "HIGH" : "MEDIUM",
      }));

    const merged = [...fromAlerts, ...marginDriven]
      .sort((a, b) => b.impact - a.impact)
      .slice(0, financialOnly ? 8 : 10);

    return financialOnly
      ? merged.filter((flag) => flag.category === "Margin" || flag.category === "Tax" || flag.category === "Supplier")
      : merged;
  }, [alerts, marginBranches, financialOnly]);

  const branchRows = useMemo<BranchRiskRow[]>(() => {
    return branchGrid.map((branch) => {
      const marginData = marginBranches.find((entry) => entry.branch_id === branch.branch_id);
      const wastePct = Number(branch.waste_pct ?? 0);
      const surplusPct = Number(branch.surplus_pct ?? 0);
      const marginDeviation = Math.abs(Number(marginData?.margin_deviation_pct ?? 0));
      const branchWasteCost = Number(marginData?.total_waste_cost ?? "0");

      const margin = clampScore(marginDeviation * 12 + wastePct * 6 + Math.min(25, branchWasteCost / 300));
      const inventory = clampScore(wastePct * 13 + surplusPct * 9);
      const compliance = clampScore((branch.compliance_badge === "RED" ? 62 : branch.compliance_badge === "YELLOW" ? 38 : 18) + surplusPct * 4);
      const tax = clampScore(margin * 0.35 + Math.min(45, branchWasteCost / 500));
      const supplier = clampScore(marginDeviation * 8 + inventory * 0.24);

      const composite = financialOnly
        ? clampScore(margin * 0.5 + tax * 0.25 + supplier * 0.25)
        : clampScore(margin * 0.3 + compliance * 0.2 + inventory * 0.2 + tax * 0.15 + supplier * 0.15);

      return {
        id: branch.branch_id,
        branch: branch.branch_name,
        composite,
        margin,
        compliance,
        inventory,
        tax,
        supplier,
      };
    });
  }, [branchGrid, marginBranches, financialOnly]);

  const compositeRisk = categoryRows.length
    ? categoryRows.reduce((sum, row) => sum + row.score, 0) / categoryRows.length
    : 0;

  const trendSeries = useMemo(() => {
    return [
      clampScore(compositeRisk + 6),
      clampScore(compositeRisk + 2),
      clampScore(compositeRisk - 3),
      clampScore(compositeRisk),
    ];
  }, [compositeRisk]);

  const branchColumns = useMemo(() => {
    if (financialOnly) {
      return [
        branchColumnHelper.accessor("branch", {
          header: "Branch",
          cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
        }),
        branchColumnHelper.accessor("composite", {
          header: "Composite",
          cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
        }),
        branchColumnHelper.accessor("margin", {
          header: "Margin",
          cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
        }),
        branchColumnHelper.accessor("tax", {
          header: "Tax",
          cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
        }),
        branchColumnHelper.accessor("supplier", {
          header: "Supplier",
          cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
        }),
      ];
    }

    return [
      branchColumnHelper.accessor("branch", {
        header: "Branch",
        cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      branchColumnHelper.accessor("composite", {
        header: "Composite",
        cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
      }),
      branchColumnHelper.accessor("margin", {
        header: "Margin",
        cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
      }),
      branchColumnHelper.accessor("compliance", {
        header: "Compliance",
        cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
      }),
      branchColumnHelper.accessor("inventory", {
        header: "Inventory",
        cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
      }),
      branchColumnHelper.accessor("tax", {
        header: "Tax",
        cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
      }),
      branchColumnHelper.accessor("supplier", {
        header: "Supplier",
        cell: (info) => <span className={`text-[12px] ${riskTone(info.getValue())}`}>{info.getValue().toFixed(0)}</span>,
      }),
    ];
  }, [financialOnly]);

  const branchTable = useReactTable({
    data: branchRows,
    columns: branchColumns,
    getCoreRowModel: coreRowModel,
  });

  return (
    <WorkspaceShell
      eyebrow="Risk"
      title="Systemic Risk Intelligence"
      description="Integrated risk view across margin, compliance, inventory, tax, and supplier exposure, prioritized by branch impact."
      insight="Risk clarity improves when category scores, high-impact flags, and branch exposure are reviewed in one control surface."
    >
      <section className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-3">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Composite Risk</p>
          <p className={`mt-1 font-display text-[30px] ${riskTone(compositeRisk)}`}>{compositeRisk.toFixed(0)}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">High Impact Flags</p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{highImpactFlags.length}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Estimated Exposure</p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
            {toCurrency(highImpactFlags.reduce((sum, flag) => sum + flag.impact, 0))}
          </p>
        </article>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Risk Categories</p>
            <p className="mt-1 text-[13px] text-[#8E8E93]">Score and directional trend by risk domain.</p>
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-10 w-full rounded-[8px] border border-[#2E2E33] bg-[#19191C] px-3 text-[12px] text-[#F5F5F7] md:w-[220px]"
          >
            <option value="ALL">All categories</option>
            {categoryRows.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-2">
          {filteredCategoryRows.map((category) => (
            <article key={category.key} className="flex items-center justify-between border-b border-[#232327] py-2.5">
              <div>
                <p className="text-[13px] text-[#F5F5F7]">{category.label}</p>
                <p className="text-[11px] text-[#8E8E93]">Trend {category.trendDelta > 0 ? "+" : ""}{category.trendDelta.toFixed(1)} pts</p>
              </div>
              <p className={`font-display text-[24px] ${riskTone(category.score)}`}>{category.score.toFixed(0)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Risk Trend</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {trendSeries.map((point, index) => (
            <div key={`trend-${index}`} className="border-b border-[#232327] pb-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">W-{trendSeries.length - index}</p>
              <p className={`mt-1 font-display text-[22px] ${riskTone(point)}`}>{point.toFixed(0)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">High-Impact Flags</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="border-b border-[#2A2A2E]">
              <tr>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Flag</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Branch</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Category</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Severity</th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">Impact</th>
              </tr>
            </thead>
            <tbody>
              {highImpactFlags.map((flag) => (
                <tr key={flag.id} className="border-b border-[#232327]">
                  <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">{flag.title}</td>
                  <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{flag.branch}</td>
                  <td className="px-2 py-3 text-[12px] text-[#8E8E93]">{flag.category}</td>
                  <td className={`px-2 py-3 text-[11px] ${flag.severity === "HIGH" ? "text-[#C44949]" : flag.severity === "MEDIUM" ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}>
                    {flag.severity}
                  </td>
                  <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">{toCurrency(flag.impact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Branch-Level Breakdown</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px]">
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
                <tr key={row.id} className="border-b border-[#232327]">
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
