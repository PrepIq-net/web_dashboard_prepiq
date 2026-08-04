"use client";

import { Suspense, useMemo, useState } from "react";
import { Refresh } from "iconoir-react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { StageLadder } from "@/components/dashboard/intelligence/stage-ladder";
import { ProgressLedger } from "@/components/dashboard/intelligence/progress-ledger";
import { CapabilityList } from "@/components/dashboard/intelligence/capability-list";
import { KitchenDNA } from "@/components/dashboard/intelligence/kitchen-dna";
import { ConfidencePanel } from "@/components/dashboard/intelligence/confidence-panel";
import { TeachPanel } from "@/components/dashboard/intelligence/teach-panel";
import { LearningDigest } from "@/components/dashboard/intelligence/learning-digest";
import {
  useBranches,
  useCurrentUserProfile,
  useProductionIntelligenceAccessScope,
} from "@/services";
import {
  useIntelligenceJourney,
  useRecomputeIntelligenceJourney,
} from "@/services/production-intelligence/hooks";
import { useTranslation } from "@/lib/i18n";

/**
 * Intelligence Journey — the page that answers "what do you actually know about
 * my kitchen?"
 *
 * Its whole reason for existing is that PrepIQ is sold as intelligence but
 * starts out knowing nothing about a new branch. Rather than hide that behind
 * confident-looking numbers, this page makes the learning itself the product:
 * the stage, the ledger behind the progress number, what is learned vs. locked,
 * and the one lever a manager can pull today — telling us what they sell.
 */

const EMPTY_LIST: never[] = [];

type IntelligenceTab =
  | "WEEK"
  | "PROGRESS"
  | "CONFDENCE"
  | "TEACH"
  | "CAPABILITIES"
  | "KITCHEN";

function IntelligencePageInner() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const { data: accessScope } = useProductionIntelligenceAccessScope();

  const [activeTab, setActiveTab] = useState<IntelligenceTab>("WEEK");

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const branches = branchesQuery.data ?? EMPTY_LIST;

  const canViewAllBranches = Boolean(accessScope?.can_view_all_branches);
  const accessibleBranches = accessScope?.accessible_branches ?? EMPTY_LIST;

  const branchOptions = useMemo(() => {
    if (canViewAllBranches) return branches;
    if (!accessibleBranches.length) return EMPTY_LIST;
    if (!branches.length) return accessibleBranches;
    const allowed = new Set(accessibleBranches.map((branch) => branch.id));
    return branches.filter((branch) => allowed.has(branch.id));
  }, [branches, accessibleBranches, canViewAllBranches]);

  const defaultBranchId =
    branchOptions.find((branch) => branch.id === accessScope?.default_branch_id)
      ?.id ??
    branchOptions.find((branch) => branch.is_primary)?.id ??
    branchOptions[0]?.id ??
    "";

  const [pickedBranchId, setPickedBranchId] = useState("");
  const branchId = pickedBranchId || defaultBranchId;

  const journeyQuery = useIntelligenceJourney({ branch_id: branchId });
  const recompute = useRecomputeIntelligenceJourney();

  const journey = journeyQuery.data;

  const tabs: { id: IntelligenceTab; label: string }[] = [
    { id: "WEEK", label: t("intelligence.section.digestEyebrow") },
    { id: "PROGRESS", label: t("intelligence.section.progressEyebrow") },
    { id: "CONFDENCE", label: t("intelligence.section.confidenceEyebrow") },
    { id: "TEACH", label: t("intelligence.section.teachEyebrow") },
    {
      id: "CAPABILITIES",
      label: t("intelligence.section.capabilitiesEyebrow"),
    },
    { id: "KITCHEN", label: t("intelligence.section.dnaEyebrow") },
  ];

  return (
    <WorkspaceShell
      eyebrow={t("intelligence.eyebrow")}
      title={t("intelligence.title")}
      description={t("intelligence.description")}
      insight=""
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-45">
          <Select
            label={t("intelligence.branchLabel")}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={branchId}
            onChange={setPickedBranchId}
          />
        </div>

        <div className="flex items-center gap-4 pb-1">
          {journey?.computed_at ? (
            <p className="text-xs text-text-muted">
              {t("intelligence.computedAt", {
                time: new Date(journey.computed_at).toLocaleString(),
              })}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!branchId || recompute.isPending}
            onClick={() => recompute.mutate({ branch_id: branchId })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-xs font-medium text-text-secondary transition-colors duration-150 hover:border-brand-gold/50 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
          >
            <Refresh
              className={`h-3.5 w-3.5 ${recompute.isPending ? "animate-spin" : ""}`}
              strokeWidth={1.5}
              aria-hidden
            />
            {t("intelligence.recompute")}
          </button>
        </div>
      </div>
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

      {!branchId ? (
        <p className="py-16 text-center text-sm text-text-secondary">
          {t("intelligence.noBranch")}
        </p>
      ) : journeyQuery.isLoading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
          <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
        </div>
      ) : journeyQuery.isError ? (
        <p className="py-16 text-center text-sm text-text-secondary">
          {t("intelligence.loadError")}
        </p>
      ) : journey ? (
        <div className="space-y-14">
          {activeTab == "WEEK" ? (
            <div>
              <section className="space-y-6">
                <SectionHeader
                  eyebrow={t("intelligence.section.stageEyebrow")}
                  title={journey.stage.label}
                />
                <StageLadder journey={journey} />
              </section>

              {journey.learning_digest ? (
                <section className="space-y-6">
                  <SectionHeader
                    eyebrow={t("intelligence.section.digestEyebrow")}
                    title={t("intelligence.section.digestTitle")}
                  />
                  <LearningDigest digest={journey.learning_digest} />
                </section>
              ) : null}
            </div>
          ) : null}

          {activeTab == "PROGRESS" ? (
            <section className="space-y-6">
              <SectionHeader
                eyebrow={t("intelligence.section.progressEyebrow")}
                title={t("intelligence.section.progressTitle")}
                supporting={t("intelligence.section.progressSupporting")}
              />
              <ProgressLedger progress={journey.progress} />
            </section>
          ) : null}

          {activeTab == "CONFDENCE" ? (
            <section className="space-y-6">
              <SectionHeader
                eyebrow={t("intelligence.section.confidenceEyebrow")}
                title={t("intelligence.section.confidenceTitle")}
              />
              <ConfidencePanel
                confidence={journey.confidence}
                blendMix={journey.blend_mix}
              />
            </section>
          ) : null}

          {activeTab == "TEACH" ? (
            <section className="space-y-6">
              <SectionHeader
                eyebrow={t("intelligence.section.teachEyebrow")}
                title={t("intelligence.section.teachTitle")}
                supporting={t("intelligence.section.teachSupporting")}
              />
              <TeachPanel branchId={branchId} />
            </section>
          ) : null}

          {activeTab == "CAPABILITIES" ? (
            <section className="space-y-6">
              <SectionHeader
                eyebrow={t("intelligence.section.capabilitiesEyebrow")}
                title={t("intelligence.section.capabilitiesTitle")}
              />
              <CapabilityList capabilities={journey.capabilities} />
            </section>
          ) : null}

          {activeTab == "KITCHEN" ? (
            <section className="space-y-6">
              <SectionHeader
                eyebrow={t("intelligence.section.dnaEyebrow")}
                title={t("intelligence.section.dnaTitle")}
                supporting={t("intelligence.section.dnaSupporting")}
              />
              <KitchenDNA entries={journey.kitchen_dna} />
            </section>
          ) : null}
        </div>
      ) : null}
    </WorkspaceShell>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense fallback={null}>
      <IntelligencePageInner />
    </Suspense>
  );
}
