"use client";
import { resolvePermissions } from "@/lib/permissions";
import { useAccessGate } from "@/lib/hooks/use-access-gate";
import { PERMISSIONS } from "@/services/organizations/types";
import { useTranslation } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavArrowRight, Search } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useBranches, useCurrentUserProfile } from "@/services";
import { useSubscriptions } from "@/services/payment/hooks";
import { useExecutiveControlTower } from "@/services/production-intelligence/hooks";

type BranchStatus = "HEALTHY" | "AT_RISK" | "UNDERPERFORMING" | "NO_DATA";

type BranchRow = {
  id: string;
  name: string;
  code: string;
  address: string;
  timezone: string;
  currency: string;
  isPrimary: boolean;
  hasPerformance: boolean;
  revenue: number;
  wastePct: number;
  riskScore: number;
  status: BranchStatus;
  plan: {
    name: string;
    isTrial: boolean;
    daysLeft: number | null;
    isActive: boolean;
  } | null;
};

const EMPTY_LIST: never[] = [];
const STATUS_FILTERS = ["ALL", "HEALTHY", "AT_RISK", "UNDERPERFORMING"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function statusBadgeClasses(status: BranchStatus) {
  if (status === "HEALTHY")
    return "border-status-success/30 bg-status-success/10 text-text-primary";
  if (status === "AT_RISK")
    return "border-status-warning/30 bg-status-warning/10 text-text-primary";
  if (status === "UNDERPERFORMING")
    return "border-status-critical/30 bg-status-critical/10 text-text-primary";
  return "border-surface-4 bg-surface-3/60 text-text-muted";
}

function statusDotClass(status: BranchStatus) {
  if (status === "HEALTHY") return "bg-status-success";
  if (status === "AT_RISK") return "bg-status-warning";
  if (status === "UNDERPERFORMING") return "bg-status-critical";
  return "bg-text-disabled";
}

/**
 * Breach markers for the numeric columns. `critical` and `warning` are too low
 * contrast to colour 14px figures (docs/DESIGN.md §8), so severity rides on a
 * tinted chip with the number itself in primary text.
 */
function wasteToneClass(value: number) {
  if (value >= 6) return "bg-status-critical/15 text-text-primary";
  if (value >= 3) return "bg-status-warning/15 text-text-primary";
  return "text-text-secondary";
}

function riskToneClass(score: number) {
  if (score >= 65) return "bg-status-critical/15 text-text-primary";
  if (score >= 35) return "bg-status-warning/15 text-text-primary";
  return "text-text-secondary";
}

/** Days between now and an ISO timestamp, floored at 0. */
function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
}

export default function BranchesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isPending, isError } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canManage = permissions.has(PERMISSIONS.MANAGE_BRANCHES);
  const canAccess = canManage || permissions.has(PERMISSIONS.VIEW_ALL_BRANCHES);
  const canSeeMoney =
    permissions.has(PERMISSIONS.VIEW_FINANCIAL_DATA) ||
    permissions.has(PERMISSIONS.VIEW_ANALYTICS);
  const canSeeBilling = permissions.has(PERMISSIONS.MANAGE_BILLING);

  const orgId = user?.organization_id ?? "";
  const branchesQuery = useBranches(orgId);
  const controlTowerQuery = useExecutiveControlTower(
    undefined,
    canAccess && Boolean(orgId),
  );
  const subscriptionsQuery = useSubscriptions(undefined, canSeeBilling);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useAccessGate({ canAccess, isPending, isError });

  const branches = branchesQuery.data ?? EMPTY_LIST;
  const branchGrid = controlTowerQuery.data?.branch_grid ?? EMPTY_LIST;
  const subscriptions = subscriptionsQuery.data ?? EMPTY_LIST;

  // The branch roster is the source of truth for which locations exist; the
  // control tower only contributes today's performance, and a branch with no
  // service day yet must still appear in the table.
  const rows = useMemo<BranchRow[]>(() => {
    const perfByBranch = new Map(
      branchGrid.map((entry) => [entry.branch_id, entry]),
    );
    const subscriptionByBranch = new Map<string, (typeof subscriptions)[number]>();
    for (const subscription of subscriptions) {
      if (!subscription.branch) continue;
      const existing = subscriptionByBranch.get(subscription.branch);
      // Prefer whichever row is currently serving the branch.
      if (!existing || (subscription.is_currently_active && !existing.is_currently_active)) {
        subscriptionByBranch.set(subscription.branch, subscription);
      }
    }

    return branches.map((branch) => {
      const perf = perfByBranch.get(branch.id);
      const wastePct = Number(perf?.waste_pct ?? 0);
      const surplusPct = Number(perf?.surplus_pct ?? 0);
      const revenue = Number(perf?.revenue ?? 0);
      const riskScore = Math.max(0, Math.min(100, wastePct * 10 + surplusPct * 7));
      const status: BranchStatus = !perf
        ? "NO_DATA"
        : wastePct >= 6 || riskScore >= 65
          ? "UNDERPERFORMING"
          : wastePct >= 3 || riskScore >= 35
            ? "AT_RISK"
            : "HEALTHY";

      const subscription = subscriptionByBranch.get(branch.id);
      const trialDaysLeft = daysUntil(subscription?.trial_ends_at);
      const renewalDays = subscription?.days_until_renewal ?? null;

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code ?? "",
        address: branch.address ?? "",
        timezone: branch.timezone ?? "UTC",
        currency: branch.currency ?? "USD",
        isPrimary: branch.is_primary,
        hasPerformance: Boolean(perf),
        revenue,
        wastePct,
        riskScore,
        status,
        plan: subscription
          ? {
              name: subscription.plan_name ?? "—",
              isTrial: Boolean(subscription.is_trial),
              daysLeft: subscription.is_trial ? trialDaysLeft : renewalDays,
              isActive: Boolean(subscription.is_currently_active),
            }
          : null,
      };
    });
  }, [branches, branchGrid, subscriptions]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!term) return true;
      return (
        row.name.toLowerCase().includes(term) ||
        row.code.toLowerCase().includes(term) ||
        row.address.toLowerCase().includes(term)
      );
    });
  }, [rows, search, statusFilter]);

  const statusCounts = {
    total: rows.length,
    healthy: rows.filter((r) => r.status === "HEALTHY").length,
    atRisk: rows.filter((r) => r.status === "AT_RISK").length,
    underperforming: rows.filter((r) => r.status === "UNDERPERFORMING").length,
  };

  function statusLabel(status: BranchStatus) {
    if (status === "HEALTHY") return t("workspace.branches.status.healthy");
    if (status === "AT_RISK") return t("workspace.branches.status.atRisk");
    if (status === "UNDERPERFORMING")
      return t("workspace.branches.status.underperforming");
    return t("workspace.branches.status.noData");
  }

  function filterLabel(filter: StatusFilter) {
    if (filter === "ALL") return t("workspace.branches.filter.all");
    return statusLabel(filter);
  }

  const isBootstrapping = branchesQuery.isLoading && rows.length === 0;

  const columns: string[] = [
    t("workspace.branches.table.branch"),
    t("workspace.branches.table.location"),
    t("workspace.branches.table.health"),
    ...(canSeeMoney
      ? [t("workspace.branches.table.revenue"), t("workspace.branches.table.waste"), t("workspace.branches.table.risk")]
      : []),
    ...(canSeeBilling ? [t("workspace.branches.table.plan")] : []),
    "",
  ];

  return (
    <WorkspaceShell
      eyebrow={t("workspace.branches.eyebrow")}
      title={t("workspace.branches.title")}
      description={t("workspace.branches.description")}
      insight={t("workspace.branches.insight")}
    >
      {/* ── Fleet summary + primary actions ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-text-primary">
              {statusCounts.total}
            </span>{" "}
            {statusCounts.total === 1
              ? t("workspace.branches.location")
              : t("workspace.branches.locations")}
          </span>
          {statusCounts.healthy > 0 ? (
            <span className="text-text-muted">
              <span className="font-semibold text-text-primary">
                {statusCounts.healthy}
              </span>{" "}
              {t("workspace.branches.fleetHealthy")}
            </span>
          ) : null}
          {statusCounts.atRisk > 0 ? (
            <span className="text-text-muted">
              <span className="font-semibold text-text-primary">
                {statusCounts.atRisk}
              </span>{" "}
              {t("workspace.branches.fleetAtRisk")}
            </span>
          ) : null}
          {statusCounts.underperforming > 0 ? (
            <span className="text-text-muted">
              <span className="font-semibold text-text-primary">
                {statusCounts.underperforming}
              </span>{" "}
              {t("workspace.branches.fleetUnderperforming")}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {canSeeBilling ? (
            <Link
              href="/workspace/billing"
              className="inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold/40 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              {t("workspace.branches.managePlan")}
            </Link>
          ) : null}
          {canManage ? (
            <Link
              href="/workspace/branches/new"
              className="inline-flex h-9 items-center rounded-full bg-brand-gold px-6 text-xs font-semibold text-background transition-colors hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              {t("workspace.branches.addBranch")}
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Filters ── */}
      {rows.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-button border border-border-default bg-surface-3 px-3 focus-within:border-brand-gold sm:max-w-xs">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("workspace.branches.searchPlaceholder")}
              aria-label={t("workspace.branches.searchPlaceholder")}
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                aria-pressed={statusFilter === filter}
                // Gold is reserved for the Add Branch CTA; the active filter is
                // carried by a surface shift so the page has one focal point.
                className={`h-9 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                  statusFilter === filter
                    ? "border-text-muted/50 bg-surface-4 text-text-primary"
                    : "border-surface-4 text-text-muted hover:text-text-secondary"
                }`}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Branch table ── */}
      {isBootstrapping ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-14 animate-pulse rounded-xl border border-surface-4 bg-surface-2"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-4 py-20 text-center">
          <p className="text-base font-semibold text-text-primary">
            {t("workspace.branches.empty.title")}
          </p>
          <p className="mt-1 max-w-md text-sm text-text-muted">
            {t("workspace.branches.empty.description")}
          </p>
          {canManage ? (
            <Link
              href="/workspace/branches/new"
              className="mt-6 inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-background transition-colors hover:bg-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            >
              {t("workspace.branches.addBranch")}
            </Link>
          ) : null}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-surface-4 bg-surface-2 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-text-secondary">
            {t("workspace.branches.table.noMatches")}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
            }}
            className="mt-3 text-xs text-brand-gold underline underline-offset-4 hover:text-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
          >
            {t("workspace.branches.table.clearFilters")}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-4 bg-surface-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-surface-4/80 bg-surface-3/40">
                <tr>
                  {columns.map((heading, index) => (
                    <th
                      key={heading || `col-${index}`}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-4/50">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => router.push(`/workspace/branches/${row.id}`)}
                    className="cursor-pointer transition-colors hover:bg-surface-3/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(row.status)}`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-text-primary">
                              {row.name}
                            </span>
                            {row.isPrimary ? (
                              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-gold">
                                {t("workspace.branches.primary")}
                              </span>
                            ) : null}
                          </div>
                          {row.code ? (
                            <p className="mt-0.5 text-xs text-text-muted">
                              {row.code}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <p className="max-w-[260px] truncate text-sm text-text-secondary">
                        {row.address || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {row.timezone} · {row.currency}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusBadgeClasses(row.status)}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>

                    {canSeeMoney ? (
                      <>
                        <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                          {row.hasPerformance
                            ? formatMoney(row.revenue, row.currency)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.hasPerformance ? (
                            <span
                              className={`inline-flex h-6 items-center rounded-full px-2 text-sm font-semibold ${wasteToneClass(row.wastePct)}`}
                            >
                              {toPercent(row.wastePct)}
                            </span>
                          ) : (
                            <span className="text-sm text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.hasPerformance ? (
                            <span
                              className={`inline-flex h-6 items-center rounded-full px-2 text-sm font-semibold ${riskToneClass(row.riskScore)}`}
                            >
                              {row.riskScore.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-sm text-text-muted">—</span>
                          )}
                        </td>
                      </>
                    ) : null}

                    {canSeeBilling ? (
                      <td className="px-4 py-3">
                        {row.plan ? (
                          <>
                            <p className="text-sm text-text-secondary">
                              {row.plan.name}
                            </p>
                            <p className="mt-0.5 text-xs text-text-muted">
                              {row.plan.isTrial
                                ? row.plan.daysLeft != null
                                  ? t("workspace.branches.plan.trialDaysLeft", {
                                      count: row.plan.daysLeft,
                                    })
                                  : t("workspace.branches.plan.trial")
                                : row.plan.isActive
                                  ? t("workspace.branches.plan.active")
                                  : t("workspace.branches.plan.inactive")}
                            </p>
                          </>
                        ) : (
                          <span className="text-sm text-text-muted">
                            {t("workspace.branches.plan.none")}
                          </span>
                        )}
                      </td>
                    ) : null}

                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/workspace/branches/${row.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-text-muted transition-colors hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                      >
                        {t("workspace.branches.view")}
                        <NavArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance columns fill in once the control tower reports today's service */}
      {!isBootstrapping &&
      rows.length > 0 &&
      rows.every((row) => !row.hasPerformance) ? (
        <p className="mt-3 text-xs text-text-muted">
          {t("workspace.branches.performancePlaceholder")}
        </p>
      ) : null}
    </WorkspaceShell>
  );
}
