"use client";

import { useMemo, useState } from "react";
import { Shop } from "iconoir-react";
import {
  useAvailabilityWeek,
  useCopyPreviousWeek,
  useCoverage,
  useCreateShift,
  useCurrentUserProfile,
  useDeleteShift,
  useGenerateSchedule,
  usePublishSchedule,
  useRecomputeRequirements,
  useReviewAvailability,
  useScheduleHistory,
  useScheduleWeek,
  useUpdateShift,
} from "@/services";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { useSelectedBranch } from "@/services/context/branch-store";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useTranslation } from "@/lib/i18n";
import { AvailabilityTab } from "@/components/dashboard/schedule/availability-tab";
import {
  AssignShiftModal,
  type ShiftDraft,
} from "@/components/dashboard/schedule/assign-shift-modal";
import { CoverageTab } from "@/components/dashboard/schedule/coverage-tab";
import { HistoryTab } from "@/components/dashboard/schedule/history-tab";
import { ScheduleContextBar } from "@/components/dashboard/schedule/schedule-context-bar";
import { WeekGrid } from "@/components/dashboard/schedule/week-grid";
import { currentWeekIso } from "@/components/dashboard/schedule/schedule-helpers";

type ScheduleTab = "AVAILABILITY" | "SCHEDULE" | "COVERAGE" | "HISTORY";

export default function SchedulePage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const { branchOptions, defaultBranch, isLoading: branchesLoading } = useBranchOptions();
  // Shared branch selection — persists across navigation and reloads.
  const [branchId, setBranchId] = useSelectedBranch({
    branches: branchOptions,
    defaultBranchId: defaultBranch?.id,
  });

  const [weekIso, setWeekIso] = useState(currentWeekIso);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("SCHEDULE");
  const [draft, setDraft] = useState<ShiftDraft | null>(null);

  const permissions = useMemo(() => resolvePermissions(user), [user]);
  const canManage = permissions.has(PERMISSIONS.MANAGE_SCHEDULE);
  const canPublish = permissions.has(PERMISSIONS.PUBLISH_SCHEDULE);

  const weekQuery = useScheduleWeek(branchId, weekIso);
  const availabilityQuery = useAvailabilityWeek(
    branchId,
    weekIso,
    activeTab === "AVAILABILITY",
  );
  const coverageQuery = useCoverage(branchId, weekIso, activeTab === "COVERAGE");
  const historyQuery = useScheduleHistory(branchId, 8, activeTab === "HISTORY");

  const generate = useGenerateSchedule(branchId, weekIso);
  const publish = usePublishSchedule(branchId, weekIso);
  const copyPrevious = useCopyPreviousWeek(branchId, weekIso);
  const createShift = useCreateShift(branchId, weekIso);
  const updateShift = useUpdateShift(branchId, weekIso);
  const deleteShift = useDeleteShift(branchId, weekIso);
  const review = useReviewAvailability(branchId, weekIso);
  const recompute = useRecomputeRequirements(branchId, weekIso);

  const week = weekQuery.data;
  const schedule = week?.schedule ?? null;
  const coverage = week?.coverage;

  const tabs: { id: ScheduleTab; label: string }[] = [
    { id: "AVAILABILITY", label: t("schedule.tabs.availability") },
    { id: "SCHEDULE", label: t("schedule.tabs.schedule") },
    { id: "COVERAGE", label: t("schedule.tabs.coverage") },
    { id: "HISTORY", label: t("schedule.tabs.history") },
  ];

  if (!branchesLoading && branchOptions.length === 0) {
    return (
      <WorkspaceShell
        eyebrow={t("schedule.eyebrow")}
        title={t("schedule.title")}
        description={t("schedule.description")}
        insight={t("schedule.description")}
      >
        <BranchRequiredState />
      </WorkspaceShell>
    );
  }

  const handleSaveShift = (values: {
    shiftTemplateId: string | null;
    laborRoleId: string | null;
    notes: string;
  }) => {
    if (!draft || !branchId) return;

    if (draft.shift) {
      updateShift.mutate(
        {
          shiftId: draft.shift.id,
          payload: {
            shift_template_id: values.shiftTemplateId,
            labor_role_id: values.laborRoleId,
            notes: values.notes,
          },
        },
        { onSuccess: () => setDraft(null) },
      );
      return;
    }

    createShift.mutate(
      {
        branch_id: branchId,
        week_start_date: weekIso,
        user_id: draft.userId,
        date: draft.dateIso,
        shift_template_id: values.shiftTemplateId,
        labor_role_id: values.laborRoleId,
        notes: values.notes,
      },
      { onSuccess: () => setDraft(null) },
    );
  };

  return (
    <WorkspaceShell
      eyebrow={t("schedule.eyebrow")}
      title={t("schedule.title")}
      description={t("schedule.description")}
      insight={t("schedule.description")}
    >
      {branchOptions.length > 1 ? (
        <div className="mb-6 max-w-xs">
          <Select
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            value={branchId}
            onChange={setBranchId}
            leadingIcon={<Shop className="h-4 w-4" />}
          />
        </div>
      ) : null}

      <ScheduleContextBar
        weekIso={weekIso}
        onWeekChange={setWeekIso}
        coveragePct={coverage?.coverage_pct ?? null}
        coverageStatus={coverage?.status ?? "UNKNOWN"}
        schedule={schedule}
        canManage={canManage}
        canPublish={canPublish}
        generating={generate.isPending}
        publishing={publish.isPending}
        copying={copyPrevious.isPending}
        onGenerate={() => generate.mutate()}
        onPublish={() => schedule && publish.mutate(schedule.id)}
        onCopyPrevious={() => copyPrevious.mutate()}
      />

      <div className="mb-6 flex gap-1 border-b border-surface-4/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex h-10 items-center px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "SCHEDULE" ? (
        <TabBody query={weekQuery}>
          {week ? (
            <div className="space-y-4">
              {schedule?.generation_metadata?.summary ? (
                <GenerationNotice
                  summary={schedule.generation_metadata.summary}
                  warnings={schedule.generation_metadata.warnings ?? []}
                  rejectedSwaps={schedule.generation_metadata.rejected_swaps ?? []}
                />
              ) : null}
              {schedule && schedule.shifts.length === 0 ? (
                <p className="rounded-xl border border-surface-4/60 bg-surface-2 p-6 text-center text-sm text-text-muted">
                  {t("schedule.grid.empty")}
                </p>
              ) : null}
              <WeekGrid
                weekStartIso={weekIso}
                roster={week.roster}
                shifts={schedule?.shifts ?? []}
                canEdit={canManage && schedule?.status !== "PUBLISHED"}
                understaffedDays={coverage?.understaffed_days ?? []}
                onCellClick={(userId, dateIso) => setDraft({ userId, dateIso })}
                onShiftClick={(shift) =>
                  setDraft({ userId: shift.user.id, dateIso: shift.date, shift })
                }
              />
            </div>
          ) : null}
        </TabBody>
      ) : null}

      {activeTab === "AVAILABILITY" ? (
        <TabBody query={availabilityQuery}>
          {availabilityQuery.data ? (
            <AvailabilityTab
              data={availabilityQuery.data}
              canReview={canManage}
              reviewingId={review.isPending ? review.variables?.availabilityId ?? null : null}
              onReview={(availabilityId, status) =>
                review.mutate({ availabilityId, payload: { status } })
              }
            />
          ) : null}
        </TabBody>
      ) : null}

      {activeTab === "COVERAGE" ? (
        <TabBody query={coverageQuery}>
          {coverageQuery.data ? (
            <CoverageTab
              data={coverageQuery.data}
              canRecompute={canManage}
              recomputing={recompute.isPending}
              onRecompute={() => recompute.mutate()}
            />
          ) : null}
        </TabBody>
      ) : null}

      {activeTab === "HISTORY" ? (
        <TabBody query={historyQuery}>
          {historyQuery.data ? <HistoryTab weeks={historyQuery.data.weeks} /> : null}
        </TabBody>
      ) : null}

      <AssignShiftModal
        draft={draft}
        roster={week?.roster ?? []}
        templates={week?.shift_templates ?? []}
        roles={week?.labor_roles ?? []}
        saving={createShift.isPending || updateShift.isPending}
        deleting={deleteShift.isPending}
        onClose={() => setDraft(null)}
        onSave={handleSaveShift}
        onDelete={() =>
          draft?.shift &&
          deleteShift.mutate(draft.shift.id, { onSuccess: () => setDraft(null) })
        }
      />
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
          {(query.error as Error)?.message ?? "Something went wrong."}
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function GenerationNotice({
  summary,
  warnings,
  rejectedSwaps,
}: {
  summary: string;
  warnings: string[];
  rejectedSwaps: string[];
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-surface-4/60 bg-surface-2 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {t("schedule.generation.title")}
      </p>
      <p className="mt-1.5 text-sm text-text-secondary">{summary}</p>
      {warnings.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-status-warning">
            {t("schedule.generation.warnings")}
          </p>
          <ul className="mt-1 space-y-0.5">
            {warnings.map((warning) => (
              <li key={warning} className="text-xs text-text-muted">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {rejectedSwaps.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {t("schedule.generation.rejectedSwaps")}
          </summary>
          <ul className="mt-1 space-y-0.5">
            {rejectedSwaps.map((note) => (
              <li key={note} className="text-xs text-text-muted">
                {note}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
