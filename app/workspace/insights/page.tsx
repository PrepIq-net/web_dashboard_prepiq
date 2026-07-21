"use client";

import { useMemo, useState } from "react";
import { useCurrentUserProfile } from "@/services";
import {
  useInsightFeed,
  useInsightSummary,
  useOpportunities,
  useRootCauses,
  useSetInsightStatus,
} from "@/services/insights/hooks";
import type { InsightStatus } from "@/services/insights/types";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { useSelectedBranch } from "@/services/context/branch-store";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { UUID_PATTERN } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { FreshnessNotice } from "@/components/dashboard/insights/insight-primitives";
import { SummaryTab } from "@/components/dashboard/insights/summary-tab";
import {
  FeedTab,
  type FeedFilter,
} from "@/components/dashboard/insights/feed-tab";
import { OpportunitiesTab } from "@/components/dashboard/insights/opportunities-tab";
import { RootCausesTab } from "@/components/dashboard/insights/root-causes-tab";

type AnalystTab = "SUMMARY" | "FEED" | "OPPORTUNITIES" | "ROOT_CAUSES";

/** The Intelligence tier, mirroring PLAN_TIER_MAP in services/payment/hooks. */
const INTELLIGENCE_TIER = 2;

export default function InsightsPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const {
    branchOptions,
    defaultBranch,
    isLoading: branchesLoading,
  } = useBranchOptions();

  const [branchId, setBranchId] = useSelectedBranch({
    branches: branchOptions,
    defaultBranchId: defaultBranch?.id,
  });
  const safeBranchId = UUID_PATTERN.test(branchId) ? branchId : "";

  const {
    tier,
    planType,
    isLoading: tierLoading,
    shouldBlockAccess,
    gateVariant,
  } = useSubscriptionTier(safeBranchId || undefined);

  const subscriptionBlocked = Boolean(safeBranchId) && !tierLoading && shouldBlockAccess;
  const tierBlocked = Boolean(safeBranchId) && !tierLoading && tier < INTELLIGENCE_TIER;
  const blocked = subscriptionBlocked || tierBlocked;

  const permissions = useMemo(() => resolvePermissions(user), [user]);
  // The same union the API enforces (insights/views.py::_require_analytics), so
  // the page does not render controls that would come back 403.
  const canView =
    permissions.has(PERMISSIONS.VIEW_ANALYTICS) ||
    permissions.has(PERMISSIONS.VIEW_PRODUCTION_REPORTS);

  const [activeTab, setActiveTab] = useState<AnalystTab>("SUMMARY");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("ACTIVE");

  const enabled = Boolean(safeBranchId) && !blocked && canView;

  const summaryQuery = useInsightSummary(safeBranchId, enabled && activeTab === "SUMMARY");
  const feedQuery = useInsightFeed(
    safeBranchId,
    { status: feedFilter },
    enabled && activeTab === "FEED",
  );
  const opportunitiesQuery = useOpportunities(
    safeBranchId,
    enabled && activeTab === "OPPORTUNITIES",
  );
  const rootCausesQuery = useRootCauses(
    safeBranchId,
    undefined,
    enabled && activeTab === "ROOT_CAUSES",
  );

  const setStatus = useSetInsightStatus(safeBranchId);
  const pendingId = setStatus.isPending
    ? (setStatus.variables?.insightId ?? null)
    : null;

  const handleStatusChange = (insightId: string, status: InsightStatus) => {
    setStatus.mutate({ insightId, status });
  };

  const tabs: { id: AnalystTab; label: string }[] = [
    { id: "SUMMARY", label: t("workspace.insights.tabs.summary") },
    { id: "FEED", label: t("workspace.insights.tabs.feed") },
    { id: "OPPORTUNITIES", label: t("workspace.insights.tabs.opportunities") },
    { id: "ROOT_CAUSES", label: t("workspace.insights.tabs.rootCauses") },
  ];

  const shell = {
    eyebrow: t("workspace.insights.eyebrow"),
    title: t("workspace.insights.title"),
    description: t("workspace.insights.description"),
    insight: t("workspace.insights.insight"),
  };

  if (!branchesLoading && branchOptions.length === 0) {
    return (
      <WorkspaceShell {...shell}>
        <BranchRequiredState />
      </WorkspaceShell>
    );
  }

  if (user && !canView) {
    return (
      <WorkspaceShell {...shell}>
        <p className="py-14 text-center text-[14px] text-text-muted">
          {t("workspace.insights.noPermission")}
        </p>
      </WorkspaceShell>
    );
  }

  // Freshness belongs to the branch, not the tab, so whichever query has loaded
  // can report it — the banner should not vanish when you change tabs.
  const freshness =
    summaryQuery.data ??
    feedQuery.data ??
    opportunitiesQuery.data ??
    rootCausesQuery.data ??
    null;

  return (
    <WorkspaceShell {...shell}>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs">
          <Select
            label={t("workspace.insights.branch")}
            value={branchId}
            onChange={setBranchId}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
          />
        </div>
      </div>

      {subscriptionBlocked ? (
        <SubscriptionRequiredState variant={gateVariant} compact branchId={safeBranchId} />
      ) : tierBlocked ? (
        <SubscriptionRequiredState
          variant="intelligence_required"
          currentPlanType={planType}
          compact
        />
      ) : (
        <>
          <div className="mb-8 flex gap-1 overflow-x-auto border-b border-surface-4/60">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-10 shrink-0 items-center px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-brand-gold text-brand-gold"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {freshness ? <FreshnessNotice freshness={freshness} /> : null}

          {activeTab === "SUMMARY" ? (
            <TabBody query={summaryQuery}>
              {summaryQuery.data ? (
                <SummaryTab
                  data={summaryQuery.data}
                  canManage={canView}
                  pending={setStatus.isPending}
                  onStatusChange={handleStatusChange}
                />
              ) : null}
            </TabBody>
          ) : null}

          {activeTab === "FEED" ? (
            <TabBody query={feedQuery}>
              {feedQuery.data ? (
                <FeedTab
                  data={feedQuery.data}
                  filter={feedFilter}
                  onFilterChange={setFeedFilter}
                  canManage={canView}
                  pendingId={pendingId}
                  onStatusChange={handleStatusChange}
                />
              ) : null}
            </TabBody>
          ) : null}

          {activeTab === "OPPORTUNITIES" ? (
            <TabBody query={opportunitiesQuery}>
              {opportunitiesQuery.data ? (
                <OpportunitiesTab
                  data={opportunitiesQuery.data}
                  canManage={canView}
                  pendingId={pendingId}
                  onStatusChange={handleStatusChange}
                />
              ) : null}
            </TabBody>
          ) : null}

          {activeTab === "ROOT_CAUSES" ? (
            <TabBody query={rootCausesQuery}>
              {rootCausesQuery.data ? (
                <RootCausesTab data={rootCausesQuery.data} />
              ) : null}
            </TabBody>
          ) : null}
        </>
      )}
    </WorkspaceShell>
  );
}

function TabBody({
  query,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error?: unknown };
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (query.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="rounded-xl border border-status-critical/30 bg-status-critical/10 p-6 text-center">
        <p className="text-sm text-status-critical">
          {(query.error as Error)?.message ?? t("workspace.insights.loadError")}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
