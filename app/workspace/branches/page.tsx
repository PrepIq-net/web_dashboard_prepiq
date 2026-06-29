"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useTranslation } from "@/lib/i18n";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useBranches, useCurrentUserProfile } from "@/services";
import {
  useExecutiveControlTower,
  useOwnerMarginProtectionReport,
} from "@/services/production-intelligence/hooks";

type BranchCard = {
  id: string;
  name: string;
  revenue: number;
  wastePct: number;
  riskScore: number;
  efficiencyScore: number;
  status: "HEALTHY" | "AT_RISK" | "UNDERPERFORMING";
};

const EMPTY_LIST: never[] = [];

function toCurrency(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function toPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function statusBadgeClasses(status: BranchCard["status"]) {
  if (status === "HEALTHY")
    return "border-status-success/30 bg-status-success/10 text-status-success";
  if (status === "AT_RISK")
    return "border-status-warning/30 bg-status-warning/10 text-status-warning";
  return "border-status-critical/30 bg-status-critical/10 text-status-critical";
}

function statusBorderClass(status: BranchCard["status"]) {
  if (status === "HEALTHY") return "border-l-status-success/60";
  if (status === "AT_RISK") return "border-l-status-warning/60";
  return "border-l-status-critical/60";
}

function statusDotClass(status: BranchCard["status"]) {
  if (status === "HEALTHY") return "bg-status-success";
  if (status === "AT_RISK") return "bg-status-warning animate-pulse";
  return "bg-status-critical animate-pulse";
}

function riskToneClass(score: number) {
  if (score >= 65) return "text-status-critical";
  if (score >= 35) return "text-status-warning";
  return "text-status-success";
}

export default function BranchesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.MANAGE_BRANCHES);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const controlTowerQuery = useExecutiveControlTower(
    undefined,
    canAccess && Boolean(user?.organization_id),
  );
  const marginReportQuery = useOwnerMarginProtectionReport(
    undefined,
    canAccess && Boolean(user?.organization_id),
  );

  useEffect(() => {
    if (!isLoading && !canAccess) router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  const branchGrid = controlTowerQuery.data?.branch_grid ?? EMPTY_LIST;
  const marginBranches = marginReportQuery.data?.branches ?? EMPTY_LIST;

  const cards = useMemo<BranchCard[]>(() => {
    return branchGrid.map((branch) => {
      const wastePct = Number(branch.waste_pct ?? 0);
      const surplusPct = Number(branch.surplus_pct ?? 0);
      const revenue = Number(branch.revenue ?? 0);
      const marginEntry = marginBranches.find(
        (m) => m.branch_id === branch.branch_id,
      );
      const efficiencyScore = Math.max(0, 100 - wastePct - surplusPct * 0.6);
      const riskScore = Math.max(
        0,
        Math.min(100, wastePct * 10 + surplusPct * 7),
      );
      const status: BranchCard["status"] =
        wastePct >= 6 || riskScore >= 65
          ? "UNDERPERFORMING"
          : wastePct >= 3 || riskScore >= 35
            ? "AT_RISK"
            : "HEALTHY";

      void marginEntry;

      return {
        id: branch.branch_id,
        name: branch.branch_name,
        revenue,
        wastePct,
        riskScore,
        efficiencyScore,
        status,
      };
    });
  }, [branchGrid, marginBranches]);

  // When the control tower hasn't loaded yet, fall back to the flat branch list
  const branches = branchesQuery.data ?? EMPTY_LIST;
  const displayCards: BranchCard[] = cards.length
    ? cards
    : branches.map((b) => ({
        id: b.id,
        name: b.name,
        revenue: 0,
        wastePct: 0,
        riskScore: 0,
        efficiencyScore: 0,
        status: "HEALTHY" as const,
      }));

  const statusCounts = {
    total: displayCards.length,
    healthy: displayCards.filter((c) => c.status === "HEALTHY").length,
    atRisk: displayCards.filter((c) => c.status === "AT_RISK").length,
    underperforming: displayCards.filter((c) => c.status === "UNDERPERFORMING")
      .length,
  };

  function statusLabel(status: BranchCard["status"]) {
    if (status === "HEALTHY") return t("workspace.branches.status.healthy");
    if (status === "AT_RISK") return t("workspace.branches.status.atRisk");
    return t("workspace.branches.status.underperforming");
  }

  return (
    <WorkspaceShell
      eyebrow={t("workspace.branches.eyebrow")}
      title={t("workspace.branches.title")}
      description={t("workspace.branches.description")}
      insight=""
    >
      {/* ── Top bar: fleet summary + billing link ── */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-surface-4/60 pb-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span className="text-text-muted">
            <span className="font-semibold text-text-primary">
              {statusCounts.total}
            </span>{" "}
            {statusCounts.total === 1 ? t("workspace.branches.location") : t("workspace.branches.locations")}
          </span>
          {statusCounts.healthy > 0 ? (
            <span className="text-text-muted">
              <span className="font-semibold text-status-success">
                {statusCounts.healthy}
              </span>{" "}
              {t("workspace.branches.fleetHealthy")}
            </span>
          ) : null}
          {statusCounts.atRisk > 0 ? (
            <span className="text-text-muted">
              <span className="font-semibold text-status-warning">
                {statusCounts.atRisk}
              </span>{" "}
              {t("workspace.branches.fleetAtRisk")}
            </span>
          ) : null}
          {statusCounts.underperforming > 0 ? (
            <span className="text-text-muted">
              <span className="font-semibold text-status-critical">
                {statusCounts.underperforming}
              </span>{" "}
              {t("workspace.branches.fleetUnderperforming")}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/workspace/billing"
            className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
          >
            {t("workspace.branches.managePlan")}
          </Link>
          <Link
            href="/workspace/branches/new"
            className="inline-flex h-8 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
          >
            {t("workspace.branches.addBranch")}
          </Link>
        </div>
      </div>

      {/* ── Branch cards ── */}
      {displayCards.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayCards.map((card) => (
            <article
              key={card.id}
              className={`overflow-hidden rounded-xl border border-l-[3px] bg-surface-2 border-surface-4 ${statusBorderClass(card.status)}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${statusDotClass(card.status)}`}
                  />
                  <p className="truncate text-base font-semibold text-text-primary">
                    {card.name}
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${statusBadgeClasses(card.status)}`}
                >
                  {statusLabel(card.status)}
                </span>
              </div>

              {/* Metrics */}
              {cards.length > 0 ? (
                <div className="mt-4 grid grid-cols-3 divide-x divide-surface-4/60 border-y border-surface-4/60">
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.branches.metric.revenue")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-brand-gold">
                      {toCurrency(card.revenue)}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.branches.metric.waste")}
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold ${
                        card.wastePct >= 6
                          ? "text-status-critical"
                          : card.wastePct >= 3
                            ? "text-status-warning"
                            : "text-status-success"
                      }`}
                    >
                      {toPercent(card.wastePct)}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                      {t("workspace.branches.metric.risk")}
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold ${riskToneClass(card.riskScore)}`}
                    >
                      {card.riskScore.toFixed(0)}
                      <span className="ml-0.5 text-[10px] font-normal text-text-muted">
                        {t("workspace.branches.riskScale")}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-5 mt-4 rounded-lg border border-surface-4 bg-surface-3/40 px-4 py-3">
                  <p className="text-xs text-text-muted">
                    {t("workspace.branches.performancePlaceholder")}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <Link
                  href={`/workspace/today?branch_id=${card.id}`}
                  className="inline-flex h-8 items-center rounded-full bg-brand-gold px-4 text-xs font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
                >
                  {t("workspace.branches.viewToday")}
                </Link>
                <Link
                  href={`/workspace/risk?branch=${card.id}`}
                  className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-surface-4 hover:text-text-primary"
                >
                  {t("workspace.branches.link.risk")}
                </Link>
                <Link
                  href={`/workspace/settings?tab=integrations&branch=${card.id}`}
                  className="inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors hover:border-surface-4 hover:text-text-primary"
                >
                  {t("workspace.branches.link.integration")}
                </Link>
                <Link
                  href={`/workspace/settings?tab=branches&branch=${card.id}`}
                  className="ml-auto inline-flex h-8 items-center rounded-full border border-surface-4 px-3 text-xs font-medium text-text-muted transition-colors hover:border-surface-4 hover:text-text-secondary"
                >
                  {t("workspace.branches.link.configure")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-4 py-20 text-center">
          <p className="text-base font-semibold text-text-primary">
            {t("workspace.branches.empty.title")}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {t("workspace.branches.empty.description")}
          </p>
          <Link
            href="/workspace/branches/new"
            className="mt-5 inline-flex h-10 items-center rounded-full bg-brand-gold px-6 text-sm font-semibold text-[#141416] transition-all hover:bg-[#B8962E] active:scale-[0.98]"
          >
            {t("workspace.branches.addBranch")}
          </Link>
        </div>
      )}

      {/* Loading skeleton when no data yet */}
      {(controlTowerQuery.isLoading || branchesQuery.isLoading) &&
      !displayCards.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-44 animate-pulse rounded-xl border border-surface-4 bg-surface-2"
            />
          ))}
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
