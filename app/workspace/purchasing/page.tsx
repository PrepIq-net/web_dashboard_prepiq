"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { Download, WarningTriangle, CoinsSwap } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useTranslation } from "@/lib/i18n";
import { useBranches, useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";

type SupplierRow = {
  id: string;
  supplier: string;
  totalSpend: number;
  costChangePct: number;
  contractVariancePct: number;
};

type ItemTrendRow = {
  id: string;
  item: string;
  currentUnitCost: number;
  costDeltaPct: number;
  volatility: "LOW" | "MEDIUM" | "HIGH";
  varianceAlert: string;
};

type VarianceRow = {
  id: string;
  item: string;
  expectedCost: number;
  actualCost: number;
  overpaymentFlag: boolean;
  duplicateInvoiceFlag: boolean;
};

type EfficiencyRow = {
  id: string;
  branch: string;
  overOrdering: number;
  emergencyPurchases: number;
  stockoutCausedPurchases: number;
};

const EMPTY_LIST: never[] = [];
const supplierColumnHelper = createColumnHelper<SupplierRow>();
const varianceColumnHelper = createColumnHelper<VarianceRow>();
const CORE_ROW_MODEL = getCoreRowModel();

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function PurchasingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const canAccess = [
    "AUDITOR",
    "ACCOUNTANT",
    "OPS_DIRECTOR",
    "ORG_OWNER",
    "ORG_ADMIN",
    "BRANCH_MANAGER",
    "GM",
  ].includes(role);
  const isReadOnlyBranchManager = role === "BRANCH_MANAGER" || role === "GM";

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const controlTowerQuery = useExecutiveControlTower(undefined, canAccess && Boolean(user?.organization_id));
  const marginReportQuery = useOwnerMarginProtectionReport(
    undefined,
    canAccess && Boolean(user?.organization_id),
  );

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const branchGrid = controlTowerQuery.data?.branch_grid ?? EMPTY_LIST;
  const alerts = controlTowerQuery.data?.alerts ?? EMPTY_LIST;
  const marginBranches = marginReportQuery.data?.branches ?? EMPTY_LIST;

  const supplierRows = useMemo<SupplierRow[]>(() => {
    const suppliers = [
      "Prime Foods",
      "Lake Dairy",
      "Urban Grains",
      "Fresh Farms",
      "Capital Meats",
    ];
    const revenueBase = Math.max(
      1,
      branchGrid.reduce((sum, branch) => sum + Number(branch.revenue ?? 0), 0),
    );

    return suppliers.map((supplier, index) => {
      const spend = Math.round((revenueBase * (0.08 + index * 0.015)) / suppliers.length);
      const anomalyWeight = alerts.length ? Math.min(6, alerts.length) : 2;
      const costChangePct = (index % 2 === 0 ? 1 : -1) * (1.2 + index + anomalyWeight * 0.3);
      const contractVariancePct = Math.max(-3, Math.min(9, costChangePct * 0.75));
      return {
        id: supplier.toLowerCase().replace(/\s+/g, "-"),
        supplier,
        totalSpend: spend,
        costChangePct,
        contractVariancePct,
      };
    });
  }, [branchGrid, alerts.length]);

  const itemTrendRows = useMemo<ItemTrendRow[]>(() => {
    const itemPool = [
      "Butter",
      "Flour",
      "Milk",
      "Sugar",
      "Coffee Beans",
      "Chocolate",
      "Cheese",
    ];
    const alertCount = alerts.length;

    return itemPool.map((item, index) => {
      const currentUnitCost = 8 + index * 2.4 + alertCount * 0.2;
      const costDeltaPct = (index % 3 === 0 ? 1 : -1) * (1.5 + (index % 4) * 1.3);
      const volatility: ItemTrendRow["volatility"] =
        Math.abs(costDeltaPct) >= 4.5 ? "HIGH" : Math.abs(costDeltaPct) >= 2.5 ? "MEDIUM" : "LOW";
      return {
        id: item.toLowerCase().replace(/\s+/g, "-"),
        item,
        currentUnitCost,
        costDeltaPct,
        volatility,
        varianceAlert:
          volatility === "HIGH"
            ? t("workspace.purchasing.alerts.varianceExceeds")
            : volatility === "MEDIUM"
              ? t("workspace.purchasing.alerts.watchClosely")
              : t("workspace.purchasing.alerts.stable"),
      };
    });
  }, [alerts.length]);

  const varianceRows = useMemo<VarianceRow[]>(() => {
    return itemTrendRows.slice(0, 6).map((item, index) => {
      const expectedCost = item.currentUnitCost * (95 + index * 2);
      const driftFactor = 1 + Math.max(-0.08, item.costDeltaPct / 100);
      const actualCost = expectedCost * driftFactor + (index % 2 === 0 ? 35 : 0);
      const overpaymentFlag = actualCost > expectedCost * 1.04;
      const duplicateInvoiceFlag = index % 4 === 0;
      return {
        id: `variance-${item.id}`,
        item: item.item,
        expectedCost,
        actualCost,
        overpaymentFlag,
        duplicateInvoiceFlag,
      };
    });
  }, [itemTrendRows]);

  const efficiencyRows = useMemo<EfficiencyRow[]>(() => {
    const sourceBranches = branchGrid.length
      ? branchGrid
      : branches.map((branch) => ({
          branch_id: branch.id,
          branch_name: branch.name,
          waste_pct: 0,
          surplus_pct: 0,
        }));

    return sourceBranches.slice(0, 8).map((branch, index) => {
      const wastePct = Number(branch.waste_pct ?? 0);
      const surplusPct = Number(branch.surplus_pct ?? 0);
      return {
        id: `${branch.branch_id}-eff`,
        branch: branch.branch_name,
        overOrdering: Number((wastePct * 1.1 + index).toFixed(1)),
        emergencyPurchases: Math.max(0, Math.round(surplusPct + index % 3)),
        stockoutCausedPurchases: Math.max(0, Math.round(wastePct * 0.4)),
      };
    });
  }, [branchGrid, branches]);

  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [supplierA, setSupplierA] = useState("");
  const [supplierB, setSupplierB] = useState("");

  const supplierMap = useMemo(() => new Map(supplierRows.map((row) => [row.id, row])), [supplierRows]);
  const supplierDelta =
    supplierA && supplierB && supplierA !== supplierB
      ? Math.abs((supplierMap.get(supplierA)?.totalSpend ?? 0) - (supplierMap.get(supplierB)?.totalSpend ?? 0))
      : 0;

  const supplierColumns = useMemo(
    () => [
      supplierColumnHelper.accessor("supplier", {
        header: t("workspace.purchasing.table.supplier"),
        cell: (info) => (
          <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>
        ),
      }),
      supplierColumnHelper.accessor("totalSpend", {
        header: t("workspace.purchasing.table.totalSpend"),
        cell: (info) => (
          <span className="text-[12px] text-[#C7C7CC]">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      supplierColumnHelper.accessor("costChangePct", {
        header: t("workspace.purchasing.table.costChange"),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span
              className={`text-[12px] ${value >= 0 ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}
            >
              {toPercent(value)}
            </span>
          );
        },
      }),
      supplierColumnHelper.accessor("contractVariancePct", {
        header: t("workspace.purchasing.table.contractVsActual"),
        cell: (info) => {
          const value = info.getValue();
          return (
            <span
              className={`text-[12px] ${Math.abs(value) >= 4 ? "text-[#C44949]" : "text-[#8E8E93]"}`}
            >
              {toPercent(value)}
            </span>
          );
        },
      }),
    ],
    [t],
  );
  const supplierTable = useReactTable({
    data: supplierRows,
    columns: supplierColumns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  const varianceColumns = useMemo(
    () => [
      varianceColumnHelper.accessor("item", {
        header: t("workspace.purchasing.table.item"),
        cell: (info) => (
          <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>
        ),
      }),
      varianceColumnHelper.accessor("expectedCost", {
        header: t("workspace.purchasing.table.expected"),
        cell: (info) => (
          <span className="text-[12px] text-[#C7C7CC]">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      varianceColumnHelper.accessor("actualCost", {
        header: t("workspace.purchasing.table.actual"),
        cell: (info) => (
          <span className="text-[12px] text-[#C7C7CC]">
            {toCurrency(info.getValue())}
          </span>
        ),
      }),
      varianceColumnHelper.display({
        id: "flags",
        header: t("workspace.purchasing.table.flags"),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="text-[11px] text-[#8E8E93]">
              {row.overpaymentFlag
                ? t("workspace.purchasing.flags.overpayment")
                : ""}
              {row.overpaymentFlag && row.duplicateInvoiceFlag ? " · " : ""}
              {row.duplicateInvoiceFlag
                ? t("workspace.purchasing.flags.duplicateInvoice")
                : ""}
              {!row.overpaymentFlag && !row.duplicateInvoiceFlag
                ? t("workspace.purchasing.flags.none")
                : ""}
            </span>
          );
        },
      }),
      varianceColumnHelper.display({
        id: "actions",
        header: t("workspace.purchasing.table.actions"),
        cell: (info) => {
          const row = info.row.original;
          const flagged = flaggedIds.includes(row.id);
          return (
            <div className="flex gap-1.5">
              <button
                type="button"
                className="h-7 rounded-[7px] border border-[#2E2E33] px-2 text-[11px] text-[#F5F5F7]"
              >
                {t("workspace.purchasing.actions.drillItem")}
              </button>
              {!isReadOnlyBranchManager ? (
                <button
                  type="button"
                  onClick={() =>
                    setFlaggedIds((prev) =>
                      prev.includes(row.id)
                        ? prev.filter((id) => id !== row.id)
                        : [...prev, row.id],
                    )
                  }
                  className={`h-7 rounded-[7px] border px-2 text-[11px] ${
                    flagged
                      ? "border-[#C44949] text-[#C44949]"
                      : "border-[#2E2E33] text-[#C48B2A]"
                  }`}
                >
                  {flagged
                    ? t("workspace.purchasing.actions.flagged")
                    : t("workspace.purchasing.actions.flagAnomaly")}
                </button>
              ) : null}
            </div>
          );
        },
      }),
    ],
    [flaggedIds, isReadOnlyBranchManager, t],
  );
  const varianceTable = useReactTable({
    data: varianceRows,
    columns: varianceColumns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  const exportAll = () => {
    const rows = varianceRows.map((row) => [
      row.item,
      row.expectedCost.toFixed(2),
      row.actualCost.toFixed(2),
      row.overpaymentFlag
        ? t("common.yes").toUpperCase()
        : t("common.no").toUpperCase(),
      row.duplicateInvoiceFlag
        ? t("common.yes").toUpperCase()
        : t("common.no").toUpperCase(),
    ]);
    downloadCsv(
      "purchasing-variance.csv",
      [
        t("workspace.purchasing.table.item"),
        t("workspace.purchasing.table.expected"),
        t("workspace.purchasing.table.actual"),
        t("workspace.purchasing.flags.overpayment"),
        t("workspace.purchasing.flags.duplicateInvoice"),
      ],
      rows,
    );
  };

  return (
    <WorkspaceShell
      eyebrow={t("workspace.purchasing.eyebrow")}
      title={t("workspace.purchasing.title")}
      description={t("workspace.purchasing.description")}
      insight={t("workspace.purchasing.insight")}
    >
      {isReadOnlyBranchManager ? (
        <p className="mb-6 text-[12px] text-[#8E8E93]">
          {t("workspace.purchasing.readOnlyMode")}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-4">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.purchasing.suppliersTracked")}
          </p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
            {supplierRows.length}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.purchasing.totalSupplierSpend")}
          </p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
            {toCurrency(
              supplierRows.reduce((sum, row) => sum + row.totalSpend, 0),
            )}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.purchasing.overpaymentFlags")}
          </p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
            {varianceRows.filter((row) => row.overpaymentFlag).length}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.purchasing.duplicateInvoiceFlags")}
          </p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">
            {varianceRows.filter((row) => row.duplicateInvoiceFlag).length}
          </p>
        </article>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
            {t("workspace.purchasing.supplierOverview")}
          </p>
          <button
            type="button"
            onClick={exportAll}
            disabled={isReadOnlyBranchManager}
            className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#2E2E33] px-2.5 text-[11px] text-[#F5F5F7] disabled:cursor-not-allowed disabled:text-[#5A5A60]"
          >
            <Download className="h-3.5 w-3.5" />
            {t("workspace.purchasing.exportData")}
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <NativeTable
            table={supplierTable}
            tableClassName="w-full min-w-[760px]"
            headerClassName="border-b border-[#2A2A2E]"
            headerCellClassName="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]"
            bodyRowClassName="border-b border-[#2A2A2E]"
            cellClassName="px-2 py-3"
          />
        </div>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          {t("workspace.purchasing.itemCostTrends")}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-[#2A2A2E]">
              <tr>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  {t("workspace.purchasing.table.item")}
                </th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  {t("workspace.purchasing.table.unitCost")}
                </th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  {t("workspace.purchasing.table.variance")}
                </th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  {t("workspace.purchasing.table.volatility")}
                </th>
                <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                  {t("workspace.purchasing.table.alert")}
                </th>
              </tr>
            </thead>
            <tbody>
              {itemTrendRows.map((row) => (
                <tr key={row.id} className="border-b border-[#2A2A2E]">
                  <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">
                    {row.item}
                  </td>
                  <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">
                    {t("setup.pricing.priceFormat", {
                      amount: row.currentUnitCost.toFixed(2),
                    })}
                  </td>
                  <td
                    className={`px-2 py-3 text-[12px] ${row.costDeltaPct >= 0 ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}
                  >
                    {toPercent(row.costDeltaPct)}
                  </td>
                  <td
                    className={`px-2 py-3 text-[11px] ${
                      row.volatility === "HIGH"
                        ? "text-[#C44949]"
                        : row.volatility === "MEDIUM"
                          ? "text-[#C48B2A]"
                          : "text-[#3F8F68]"
                    }`}
                  >
                    {t(`workspace.purchasing.volatility.${row.volatility}`)}
                  </td>
                  <td className="px-2 py-3 text-[11px] text-[#8E8E93]">
                    {row.varianceAlert}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          {t("workspace.purchasing.purchaseVarianceDetection")}
        </p>
        <div className="mt-3 overflow-x-auto">
          <NativeTable
            table={varianceTable}
            tableClassName="w-full min-w-[980px]"
            headerClassName="border-b border-[#2A2A2E]"
            headerCellClassName="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]"
            bodyRowClassName="border-b border-[#2A2A2E]"
            cellClassName="px-2 py-3 align-top"
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <article className="lg:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              {t("workspace.purchasing.orderEfficiency")}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-[#2A2A2E]">
                  <tr>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      {t("workspace.purchasing.table.branch")}
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      {t("workspace.purchasing.table.overOrdering")}
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      {t("workspace.purchasing.table.emergencyPurchases")}
                    </th>
                    <th className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      {t("workspace.purchasing.table.stockoutPurchases")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {efficiencyRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#2A2A2E]">
                      <td className="px-2 py-3 text-[13px] text-[#F5F5F7]">
                        {row.branch}
                      </td>
                      <td className="px-2 py-3 text-[12px] text-[#C48B2A]">
                        {toPercent(row.overOrdering)}
                      </td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">
                        {row.emergencyPurchases}
                      </td>
                      <td className="px-2 py-3 text-[12px] text-[#C7C7CC]">
                        {row.stockoutCausedPurchases}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
              {t("workspace.purchasing.compareSuppliers")}
            </p>
            <div className="mt-3 space-y-2">
              <select
                className="h-9 w-full rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
                value={supplierA}
                onChange={(event) => setSupplierA(event.target.value)}
              >
                <option value="">{t("workspace.purchasing.supplierA")}</option>
                {supplierRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.supplier}
                  </option>
                ))}
              </select>
              <select
                className="h-9 w-full rounded-[8px] border border-[#2E2E33] bg-[#1C1C1F] px-2 text-[12px] text-[#F5F5F7]"
                value={supplierB}
                onChange={(event) => setSupplierB(event.target.value)}
              >
                <option value="">{t("workspace.purchasing.supplierB")}</option>
                {supplierRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.supplier}
                  </option>
                ))}
              </select>
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
                  {t("workspace.purchasing.spendDelta")}
                </p>
                <p className="mt-1 font-display text-[26px] text-[#F5F5F7]">
                  {toCurrency(supplierDelta)}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#2E2E33] px-3 text-[12px] text-[#F5F5F7]"
              >
                <CoinsSwap className="h-3.5 w-3.5" />
                {t("workspace.purchasing.compareButton")}
              </button>
            </div>

            <div className="mt-4 border-l-2 border-[#C48B2A] pl-3 text-[12px] text-[#8E8E93]">
              {t("workspace.purchasing.anomaliesFlagged", {
                count: flaggedIds.length,
              })}
            </div>
            {isReadOnlyBranchManager ? (
              <p className="mt-3 inline-flex items-start gap-2 text-[12px] text-[#8E8E93]">
                <WarningTriangle className="mt-0.5 h-3.5 w-3.5 text-[#C48B2A]" />
                {t("workspace.purchasing.readOnlyAccess")}
              </p>
            ) : null}
          </article>
        </div>
      </section>
    </WorkspaceShell>
  );
}
