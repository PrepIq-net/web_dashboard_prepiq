"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shop, Calendar } from "iconoir-react";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { useBranches, useCurrentUserProfile, useProductionIntelligenceAccessScope } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
  useOwnerNetworkIntelligenceInsights,
} from "@/services/production-intelligence/hooks";

const EMPTY_LIST: never[] = [];

function percent(value: number) {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumberishCurrency(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isNaN(parsed)) return "$0";
  return formatCurrency(parsed);
}

export default function WorkspaceOverviewPage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();
  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;

  const branchOptions = useMemo(() => {
    const accessibleBranchIds = new Set(accessibleBranches.map((branch) => branch.id));
    const byId = new Map<string, (typeof branches)[number]>();
    for (const branch of branches) {
      byId.set(branch.id, branch);
    }
    for (const branch of accessibleBranches) {
      if (byId.has(branch.id)) continue;
      byId.set(branch.id, {
        id: branch.id,
        organization: user?.organization_id ?? "",
        organization_name: user?.organization_name ?? "",
        name: branch.name,
        code: "",
        address: "",
        phone: null,
        email: null,
        timezone: "UTC",
        is_primary: branch.is_primary,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    const merged = Array.from(byId.values());
    if (!accessibleBranchIds.size) return merged;
    return merged.filter((branch) => accessibleBranchIds.has(branch.id));
  }, [branches, accessibleBranches, user?.organization_id, user?.organization_name]);

  const defaultBranch =
    branchOptions.find((branch) => branch.id === accessScope?.default_branch_id) ??
    branchOptions.find((branch) => branch.is_primary) ??
    branchOptions[0] ??
    null;

  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState(defaultBranch?.id ?? "");

  useEffect(() => {
    if (!branchId && defaultBranch?.id) {
      setBranchId(defaultBranch.id);
    }
  }, [branchId, defaultBranch?.id]);

  const role = user?.organization_role ?? "";
  const canAccess = role === "STAFF_OPERATOR" || role === "BRANCH_MANAGER" || role === "GM";
  useEffect(() => {
    if (!userLoading && !canAccess) {
      router.replace("/");
    }
  }, [canAccess, router, userLoading]);

  const shouldHold =
    userLoading || (Boolean(user?.has_organization) && branchesQuery.isLoading);
  const hasBranches = (branchOptions.length ?? 0) > 0;
  const shouldShowBranchRequiredState =
    !userLoading &&
    Boolean(user?.has_organization) &&
    !hasBranches &&
    !branchesQuery.isLoading;

  const executiveQuery = useExecutiveControlTower(
    { branch_id: branchId || undefined, target_date: targetDate },
    Boolean(branchId),
  );
  const marginQuery = useOwnerMarginProtectionReport(
    { branch_id: branchId || undefined, target_date: targetDate },
    Boolean(branchId),
  );
  const organizationNetworkQuery = useOwnerNetworkIntelligenceInsights(
    {
      organization_id: user?.organization_id ?? undefined,
      target_date: targetDate,
      lookback_days: 30,
    },
    Boolean(user?.organization_id),
  );

  const networkInsights = useMemo(() => {
    return (organizationNetworkQuery.data?.top_network_insights ?? []).slice(0, 3).map((row) => ({
      title: row.title,
      detail: `Observed in ${row.observed_in_kitchens} kitchen${row.observed_in_kitchens === 1 ? "" : "s"}.`,
      confidence: row.confidence,
    }));
  }, [organizationNetworkQuery.data?.top_network_insights]);

  if (shouldHold) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-text-muted animate-pulse">
            Loading enterprise insights...
          </p>
        </div>
      </main>
    );
  }

  if (shouldShowBranchRequiredState) {
    return <BranchRequiredState />;
  }

  return (
    <WorkspaceShell
      eyebrow="Overview"
      title="Cross Location Dashboard"
      description="Enterprise network intelligence with shared pattern detection, waste comparison, and forecast reliability."
      insight="Executives should get one view of cross-branch truth: what pattern is repeatable, where waste is growing, and what action should be standardized."
    >
      <section className="bg-surface-2 rounded-xl p-6 border border-surface-4 mb-8 shadow-lg">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Select
            label="Anchor Branch"
            leadingIcon={<Shop className="h-4 w-4" />}
            options={branchOptions.map((branch) => ({ value: branch.id, label: branch.name }))}
            value={branchId}
            onChange={setBranchId}
            disabled={!branchOptions.length}
            placeholder={!branchOptions.length ? "No branches available" : "Select branch"}
          />
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="h-12 w-full rounded-button border border-border-default bg-surface-3 pl-10 pr-3 text-sm text-text-primary transition-all duration-200 hover:bg-surface-4 focus:outline-none focus:ring-1 focus:border-brand-gold focus:ring-brand-gold/20"
              />
            </div>
          </div>
          <article className="rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-gold">Suggested Action</p>
            <p className="mt-1 text-sm text-text-primary">
              {organizationNetworkQuery.data?.top_network_insights?.[0]?.suggested_action ??
                "No validated organization-wide transfer action yet."}
            </p>
          </article>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Network Intelligence</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">Top Network Insights</h3>
          {networkInsights.length ? (
            <div className="mt-3 space-y-2">
              {networkInsights.map((row) => (
                <div key={`${row.title}-${row.detail}`} className="rounded-lg border border-surface-4 bg-surface-3/35 px-3 py-3">
                  <p className="text-sm font-semibold text-text-primary">{row.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {row.detail}
                    {typeof row.confidence === "number" ? ` Confidence ${percent(row.confidence)}.` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              No validated network learnings available yet for this branch/day.
            </p>
          )}
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Enterprise Value</p>
          <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">Cross Location Snapshot</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Locations</p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                {organizationNetworkQuery.data?.summary.branch_count ?? executiveQuery.data?.branch_count ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Forecast Accuracy (7d)</p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                {percent(executiveQuery.data?.summary?.forecast_accuracy_rolling_7d ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Waste Risk</p>
              <p className="mt-1 text-xl font-semibold text-status-warning">
                {(executiveQuery.data?.summary?.waste_risk_pct ?? 0).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Total Waste Cost</p>
              <p className="mt-1 text-xl font-semibold text-status-critical">
                {formatNumberishCurrency(marginQuery.data?.summary?.total_waste_cost)}
              </p>
            </div>
            <div className="rounded-lg border border-surface-4 bg-surface-3/30 px-3 py-3 col-span-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Lifecycle</p>
              <p className="mt-1 text-sm text-text-secondary">
                Candidate {organizationNetworkQuery.data?.summary.candidate_patterns ?? 0}
                {" · "}Validated {organizationNetworkQuery.data?.summary.validated_patterns ?? 0}
                {" · "}Deployed {organizationNetworkQuery.data?.summary.deployed_patterns ?? 0}
                {" · "}Freshness {percent(organizationNetworkQuery.data?.summary.average_freshness_score ?? 0)}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-surface-4 bg-surface-2 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Location Performance</p>
        <h3 className="mt-2 font-display text-xl font-semibold text-text-primary">Shared Patterns and Waste Comparison</h3>
        <div className="mt-4 overflow-x-auto border-y border-surface-4/60">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-surface-4/70">
              <tr>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Location</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Revenue</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Waste %</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Forecast Accuracy</th>
                <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Margin Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-4/55">
              {(organizationNetworkQuery.data?.location_performance ?? executiveQuery.data?.branch_grid ?? []).map((row) => {
                const marginRow = (marginQuery.data?.branches ?? []).find((item) => item.branch_id === row.branch_id);
                const rowRecord = row as Record<string, unknown>;
                const revenueValue =
                  typeof rowRecord.revenue === "number"
                    ? rowRecord.revenue
                    : typeof rowRecord.net_impact === "number"
                      ? rowRecord.net_impact
                      : 0;
                const wasteText =
                  typeof rowRecord.waste_pct === "number"
                    ? `${rowRecord.waste_pct.toFixed(1)}%`
                    : formatCurrency(typeof rowRecord.waste_cost === "number" ? rowRecord.waste_cost : 0);
                const forecastValue =
                  typeof rowRecord.forecast_accuracy === "number" ? rowRecord.forecast_accuracy : null;
                return (
                  <tr key={row.branch_id}>
                    <td className="px-3 py-3 text-sm font-medium text-text-primary">{row.branch_name}</td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {formatCurrency(revenueValue)}
                    </td>
                    <td className="px-3 py-3 text-sm text-status-warning">
                      {wasteText}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {typeof forecastValue === "number"
                        ? `${forecastValue.toFixed(1)}%`
                        : typeof marginRow?.forecast_accuracy_summary === "number"
                          ? `${marginRow.forecast_accuracy_summary.toFixed(1)}%`
                        : "N/A"}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">{marginRow?.margin_signal_status ?? "N/A"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspaceShell>
  );
}
