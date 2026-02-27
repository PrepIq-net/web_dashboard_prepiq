"use client";

import { KpiCard } from "./kpi-card";

interface BranchFinancialRow {
  branch_id: string;
  branch_name: string;
  total_waste_cost?: string | number;
  money_protected_vs_baseline?: string | number | null;
  forecast_accuracy_summary?: number;
  margin_signal_status?: string | null;
}

interface FinanceViewProps {
  revenueToday: number;
  grossMarginPct: number;
  totalWasteCost: number;
  wasteAsRevenuePct: number;
  purchaseCostTrend: string;
  wasteTodayValue: number;
  taxLiabilityEstimate: number;
  branches: BranchFinancialRow[];
  branchCount: number;
}

export function FinanceView({
  revenueToday,
  grossMarginPct,
  totalWasteCost,
  wasteAsRevenuePct,
  purchaseCostTrend,
  wasteTodayValue,
  taxLiabilityEstimate,
  branches,
  branchCount,
}: FinanceViewProps) {
  const marginStatus =
    grossMarginPct >= 70
      ? "success"
      : grossMarginPct >= 50
        ? "warning"
        : "critical";
  const costStatus = purchaseCostTrend.startsWith("-") ? "success" : "warning";

  return (
    <>
      {/* Header */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
          Financial Intelligence
        </p>
        <div className="mt-3 flex items-end justify-between gap-6">
          <h1 className="font-display text-5xl font-semibold text-text-primary tracking-tight">
            Financial Snapshot
          </h1>
          <div className="shrink-0 inline-flex items-center gap-3 mb-1">
            <label
              htmlFor="finance-period"
              className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted"
            >
              Period
            </label>
            <select
              id="finance-period"
              className="h-9 rounded-button border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary font-medium focus:border-brand-gold focus:outline-none transition-colors"
              defaultValue="30d"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
        <p className="mt-4 text-base text-text-secondary max-w-2xl">
          Real-time financial metrics and cost analysis across all operations.
        </p>
      </div>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
        <KpiCard
          label="Total Revenue"
          value={`$${revenueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtext="+6.2% vs prior period"
          status="gold"
        />
        <KpiCard
          label="Gross Margin"
          value={`${grossMarginPct.toFixed(1)}%`}
          subtext="Target: 75%"
          status={marginStatus}
          progress={grossMarginPct}
          progressColor={marginStatus}
        />
        <KpiCard
          label="Waste Cost"
          value={`$${totalWasteCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtext={`${wasteAsRevenuePct.toFixed(1)}% of revenue`}
          status="critical"
        />
        <KpiCard
          label="Cost Trend"
          value={purchaseCostTrend}
          subtext="7-day rolling average"
          status={costStatus}
          compact
        />
      </section>

      {/* Tax Liability */}
      <section className="mb-12">
        <div className="bg-surface-2 rounded-card p-8 border border-surface-4/50">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Tax Liability Analysis
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Current Period Estimate
              </h2>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-semibold text-text-primary tracking-tight">
                ${taxLiabilityEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Based on waste and margin profile
              </p>
            </div>
          </div>
          <div className="h-px bg-surface-4 mb-6" />
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                Waste Impact
              </p>
              <p className="text-lg font-semibold text-text-primary">
                ${wasteTodayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                Tax Rate Applied
              </p>
              <p className="text-lg font-semibold text-text-primary">18%</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted mb-2">
                Confidence Level
              </p>
              <p className="text-lg font-semibold text-status-success">High</p>
            </div>
          </div>
        </div>
      </section>

      {/* Branch Performance Table */}
      <section className="mb-12">
        <div className="bg-surface-2 rounded-card border border-surface-4/50 overflow-hidden">
          <div className="px-8 py-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                Branch Performance Analysis
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary">
                Financial Comparison
              </h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-text-secondary">
                {branchCount} branches tracked
              </p>
              <p className="text-xs text-text-muted mt-1">
                Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-surface-3">
                <tr>
                  <th className="pl-8 pr-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Branch Location
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Waste Cost
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Protected Value
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Forecast Accuracy
                  </th>
                  <th className="px-8 py-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-4">
                {branches.map((branch) => {
                  const accuracy = Number(branch.forecast_accuracy_summary ?? 0);
                  const wasteValue = Number(branch.total_waste_cost ?? "0");
                  const accuracyColor =
                    accuracy >= 80
                      ? "bg-status-success"
                      : accuracy >= 60
                        ? "bg-status-warning"
                        : "bg-status-critical";
                  const statusCls =
                    branch.margin_signal_status === "HEALTHY"
                      ? "bg-status-success/15 text-status-success"
                      : branch.margin_signal_status === "WARNING"
                        ? "bg-status-warning/15 text-status-warning"
                        : "bg-status-critical/15 text-status-critical";

                  return (
                    <tr
                      key={branch.branch_id}
                      className="hover:bg-surface-3/50 transition-colors duration-150"
                    >
                      <td className="pl-8 pr-4 py-5">
                        <p className="font-medium text-text-primary">
                          {branch.branch_name}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          ID: {branch.branch_id.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className="font-semibold text-text-primary">
                          ${wasteValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <p className="font-semibold text-status-success">
                          ${Number(branch.money_protected_vs_baseline ?? "0").toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${accuracyColor}`}
                              style={{ width: `${Math.min(100, accuracy)}%` }}
                            />
                          </div>
                          <p className="font-semibold text-text-primary min-w-[3rem] text-right">
                            {accuracy.toFixed(1)}%
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusCls}`}
                        >
                          {branch.margin_signal_status || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!branches.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-8 py-12 text-center text-text-muted"
                    >
                      No branch data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
