"use client";

import { KpiCard } from "./kpi-card";

interface BranchManagerViewProps {
  branchName: string;
  currentTimeLabel: string;
  shiftProgress: number;
  salesVsTargetPct: number;
  wasteTodayValue: number;
  wasteTodayPct: number;
  productionVsPlanPct: number;
  inventoryRiskCount: number;
  belowReorderCount: number;
  preparedToday: number;
  soldToday: number;
  activeStaffCount: number;
  absentEstimate: number;
  yesterdayPrepared: number;
  yesterdaySold: number;
  yesterdayWasteCost: number;
}

export function BranchManagerView({
  branchName,
  currentTimeLabel,
  shiftProgress,
  salesVsTargetPct,
  wasteTodayValue,
  wasteTodayPct,
  productionVsPlanPct,
  inventoryRiskCount,
  belowReorderCount,
  preparedToday,
  soldToday,
  activeStaffCount,
  absentEstimate,
  yesterdayPrepared,
  yesterdaySold,
  yesterdayWasteCost,
}: BranchManagerViewProps) {
  const salesStatus =
    salesVsTargetPct >= 90 ? "success" : salesVsTargetPct >= 70 ? "warning" : "critical";
  const wasteStatus =
    wasteTodayPct <= 3 ? "success" : wasteTodayPct <= 7 ? "warning" : "critical";
  const prodStatus =
    productionVsPlanPct >= 95 ? "success" : productionVsPlanPct >= 80 ? "warning" : "critical";
  const invStatus =
    inventoryRiskCount === 0 ? "success" : inventoryRiskCount <= 3 ? "warning" : "critical";

  const totalStaff = activeStaffCount + absentEstimate;
  const activeRatio = totalStaff > 0 ? (activeStaffCount / totalStaff) * 100 : 0;
  const absentRatio = totalStaff > 0 ? (absentEstimate / totalStaff) * 100 : 0;

  const belowReorderBadge =
    belowReorderCount === 0
      ? { cls: "bg-status-success/15 text-status-success", text: "Good" }
      : belowReorderCount <= 3
        ? { cls: "bg-status-warning/15 text-status-warning", text: "Monitor" }
        : { cls: "bg-status-critical/15 text-status-critical", text: "Critical" };

  return (
    <>
      {/* Header */}
      <div className="mb-12 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
            Branch Operations
          </p>
          <h1 className="mt-3 font-display text-5xl font-semibold text-text-primary tracking-tight">
            {branchName} Health
          </h1>
          <p className="mt-4 text-base text-text-secondary max-w-2xl">
            Real-time operational metrics and performance indicators for your location.
          </p>
        </div>
        <div className="text-right shrink-0 mt-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Current Time
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-text-primary">
            {currentTimeLabel}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
        <KpiCard
          label="Sales vs Target"
          value={`${salesVsTargetPct.toFixed(1)}%`}
          status={salesStatus}
          progress={salesVsTargetPct}
          progressColor={salesStatus}
        />
        <KpiCard
          label="Waste Today"
          value={`$${wasteTodayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtext={`${wasteTodayPct.toFixed(1)}% of production`}
          status={wasteStatus}
        />
        <KpiCard
          label="Production vs Plan"
          value={`${productionVsPlanPct.toFixed(1)}%`}
          status={prodStatus}
          progress={productionVsPlanPct}
          progressColor="gold"
        />
        <KpiCard
          label="Inventory Risk"
          value={inventoryRiskCount}
          subtext="Items at risk"
          status={invStatus}
        />
      </section>

      {/* Inventory + Staff */}
      <section className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory */}
        <article className="bg-surface-2 rounded-card p-8 border border-surface-4/50">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Inventory Status
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
              Stock Analysis
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-5 bg-surface-3 rounded-xl">
              <div>
                <p className="text-sm font-medium text-text-secondary">Below Reorder Point</p>
                <p className="text-xs text-text-muted mt-0.5">Items requiring restocking</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${belowReorderBadge.cls}`}>
                  {belowReorderBadge.text}
                </span>
                <p className="font-display text-2xl font-semibold text-text-primary">
                  {belowReorderCount}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-5 bg-surface-3 rounded-xl">
              <div>
                <p className="text-sm font-medium text-text-secondary">Prepared Today</p>
                <p className="text-xs text-text-muted mt-0.5">Total units produced</p>
              </div>
              <p className="font-display text-2xl font-semibold text-text-primary">
                {preparedToday.toLocaleString()}
              </p>
            </div>

            <div className="flex items-center justify-between p-5 bg-surface-3 rounded-xl">
              <div>
                <p className="text-sm font-medium text-text-secondary">Sold Today</p>
                <p className="text-xs text-text-muted mt-0.5">Units moved to customers</p>
              </div>
              <p className="font-display text-2xl font-semibold text-text-primary">
                {soldToday.toLocaleString()}
              </p>
            </div>
          </div>
        </article>

        {/* Staff */}
        <article className="bg-surface-2 rounded-card p-8 border border-surface-4/50">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
              Staff Operations
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold text-text-primary">
              Team Status
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-5 bg-surface-3 rounded-xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Active Staff
              </p>
              <p className="font-display text-4xl font-semibold text-status-success">
                {activeStaffCount}
              </p>
              <div className="mt-3 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-success rounded-full transition-all duration-500"
                  style={{ width: `${activeRatio}%` }}
                />
              </div>
            </div>
            <div className="p-5 bg-surface-3 rounded-xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted mb-3">
                Absent (Est.)
              </p>
              <p className="font-display text-4xl font-semibold text-status-warning">
                {absentEstimate}
              </p>
              <div className="mt-3 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-warning rounded-full transition-all duration-500"
                  style={{ width: `${absentRatio}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-5 bg-surface-3 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-text-secondary">Shift Progress</p>
              <span className="text-sm font-semibold text-brand-gold">
                {shiftProgress.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-2 bg-brand-gold rounded-full transition-all duration-500"
                style={{ width: `${shiftProgress}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-2">Shift: 6:00 AM – 10:00 PM</p>
          </div>
        </article>
      </section>

      {/* Health Check — unboxed */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mb-6">
          Health Check — Yesterday
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 md:gap-x-10">
          {[
            { label: "Prepared", value: yesterdayPrepared.toLocaleString() },
            { label: "Sold", value: yesterdaySold.toLocaleString() },
            {
              label: "Waste Cost",
              value: `$${yesterdayWasteCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Yesterday {item.label}
              </p>
              <p className="mt-2 font-display text-[30px] font-semibold text-text-primary leading-9">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
