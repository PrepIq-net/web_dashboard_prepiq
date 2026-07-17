"use client";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  NativeTable,
} from "@/components/ui/native-table";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import {
  useBranches,
  useCurrentUserProfile,
  useRemoveOrganizationMember,
  useRemoveStaff,
  useStaffPerformance,
} from "@/services";
import type { StaffPerformanceRow } from "@/services/organizations/types";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { useTranslation } from "@/lib/i18n";

const columnHelper = createColumnHelper<StaffPerformanceRow>();
const TABLE_PAGE_SIZE = 100;
const CORE_ROW_MODEL = getCoreRowModel();
const EMPTY_BRANCHES: Array<{ id: string; name: string }> = [];
const EMPTY_ROWS: StaffPerformanceRow[] = [];

// Owners, admins and auditors manage the operation; their rows would only be
// noise in a table about shift and task execution.
const HIDDEN_ROLE_SLUGS = new Set(["system-super-admin", "system-admin"]);

function isHiddenRole(row: StaffPerformanceRow) {
  const slug = (row.role_slug ?? "").toLowerCase();
  const name = (row.role_name ?? "").toLowerCase();
  return HIDDEN_ROLE_SLUGS.has(slug) || slug.includes("auditor") || name.includes("auditor");
}

function isOrgLevelRole(row: StaffPerformanceRow) {
  const slug = (row.role_slug ?? "").toLowerCase();
  return slug.includes("admin") || slug.includes("super");
}

function scoreTone(value: number | null) {
  if (value === null) return "text-[#8E8E93]";
  if (value < 55) return "text-[#C44949]";
  if (value < 75) return "text-[#C48B2A]";
  return "text-[#3F8F68]";
}

function coachingTone(value: StaffPerformanceRow["coaching_priority"]) {
  if (value === "HIGH") return "text-[#C44949] bg-[#C44949]/10 border-[#C44949]/30";
  if (value === "MEDIUM") return "text-[#C48B2A] bg-[#C48B2A]/10 border-[#C48B2A]/30";
  return "text-[#3F8F68] bg-[#3F8F68]/10 border-[#3F8F68]/30";
}

export default function StaffPerformancePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.MANAGE_TEAM);
  const canManageStaff = permissions.has(PERMISSIONS.MANAGE_TEAM);
  const orgId = user?.organization_id ?? "";

  const branchesQuery = useBranches(orgId);
  const removeStaffMutation = useRemoveStaff(orgId);
  const removeOrgMemberMutation = useRemoveOrganizationMember(orgId);

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const activeBranchId = branchFilter && branchFilter !== "ALL" ? branchFilter : undefined;
  const days = timeframe === "7d" ? 7 : timeframe === "90d" ? 90 : 30;
  const { tier, planType, isLoading: tierLoading, shouldBlockAccess, gateVariant } = useSubscriptionTier(activeBranchId);
  const [tablePage, setTablePage] = useState(0);

  const performanceQuery = useStaffPerformance(
    orgId,
    { days: days as 7 | 30 | 90, branch_id: activeBranchId },
    canAccess,
  );

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const branches = (branchesQuery.data ?? EMPTY_BRANCHES) as typeof branchesQuery.data extends Array<infer T>
    ? T[]
    : typeof EMPTY_BRANCHES;

  const rows = useMemo<StaffPerformanceRow[]>(() => {
    const staff = performanceQuery.data?.staff ?? EMPTY_ROWS;
    return staff.filter((row) => !isHiddenRole(row));
  }, [performanceQuery.data]);

  useEffect(() => {
    setTablePage(0);
  }, [timeframe, branchFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const safePage = Math.min(tablePage, totalPages - 1);
    const start = safePage * TABLE_PAGE_SIZE;
    return rows.slice(start, start + TABLE_PAGE_SIZE);
  }, [rows, tablePage, totalPages]);

  const percent = (value: number | null) =>
    value === null ? t("workspace.staffPerformance.noData") : `${value.toFixed(1)}%`;

  const withCompletion = rows.filter((row) => row.tasks.completion_rate !== null);
  const avgCompletion = withCompletion.length
    ? withCompletion.reduce((sum, row) => sum + (row.tasks.completion_rate ?? 0), 0) /
      withCompletion.length
    : null;
  const withAdherence = rows.filter((row) => row.schedule.adherence_rate !== null);
  const avgAdherence = withAdherence.length
    ? withAdherence.reduce((sum, row) => sum + (row.schedule.adherence_rate ?? 0), 0) /
      withAdherence.length
    : null;
  const highCoachingCount = rows.filter((row) => row.coaching_priority === "HIGH").length;
  const mediumCoachingCount = rows.filter((row) => row.coaching_priority === "MEDIUM").length;

  const coachingNeeds = rows
    .filter((row) => row.coaching_priority === "HIGH" || row.coaching_priority === "MEDIUM")
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 6);

  const handleRemoveMember = (row: StaffPerformanceRow) => {
    if (!canManageStaff) return;
    const confirmation = window.confirm(
      t("workspace.staffPerformance.confirmRemove", { name: row.name }),
    );
    if (!confirmation) return;

    if (isOrgLevelRole(row)) {
      removeOrgMemberMutation.mutate(row.user_id);
      return;
    }
    removeStaffMutation.mutate({ memberId: row.member_id });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: t("workspace.staffPerformance.columnStaff"),
        cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("role_name", {
        header: t("workspace.staffPerformance.columnRole"),
        cell: (info) => (
          <span className="text-[11px] uppercase tracking-[0.08em] text-[#8E8E93]">
            {info.getValue() ?? t("workspace.staffPerformance.noData")}
          </span>
        ),
      }),
      columnHelper.accessor("branch_name", {
        header: t("workspace.staffPerformance.columnBranch"),
        cell: (info) => (
          <span className="text-[12px] text-[#C7C7CC]">
            {info.getValue() ?? t("workspace.staffPerformance.noData")}
          </span>
        ),
      }),
      columnHelper.display({
        id: "adherence",
        header: t("workspace.staffPerformance.columnAdherence"),
        cell: (info) => {
          const rate = info.row.original.schedule.adherence_rate;
          return <span className={`text-[12px] ${scoreTone(rate)}`}>{percent(rate)}</span>;
        },
      }),
      columnHelper.display({
        id: "submission",
        header: t("workspace.staffPerformance.columnSubmission"),
        cell: (info) => {
          const schedule = info.row.original.schedule;
          return (
            <span className="text-[12px] text-[#C7C7CC]">
              {t("workspace.staffPerformance.submissionCell", {
                submitted: String(schedule.weeks_submitted),
                expected: String(schedule.weeks_expected),
              })}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "tasks",
        header: t("workspace.staffPerformance.columnTasks"),
        cell: (info) => {
          const tasks = info.row.original.tasks;
          return (
            <span className="text-[12px] text-[#C7C7CC]">
              {t("workspace.staffPerformance.tasksCell", {
                completed: String(tasks.completed),
                assigned: String(tasks.assigned),
              })}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "completion",
        header: t("workspace.staffPerformance.columnCompletion"),
        cell: (info) => {
          const rate = info.row.original.tasks.completion_rate;
          return <span className={`text-[12px] ${scoreTone(rate)}`}>{percent(rate)}</span>;
        },
      }),
      columnHelper.display({
        id: "onTime",
        header: t("workspace.staffPerformance.columnOnTime"),
        cell: (info) => {
          const rate = info.row.original.tasks.on_time_rate;
          return <span className={`text-[12px] ${scoreTone(rate)}`}>{percent(rate)}</span>;
        },
      }),
      columnHelper.accessor("score", {
        header: t("workspace.staffPerformance.columnScore"),
        cell: (info) => (
          <span className={`text-[12px] font-semibold ${scoreTone(info.getValue())}`}>
            {info.getValue() === null
              ? t("workspace.staffPerformance.noData")
              : info.getValue()!.toFixed(0)}
          </span>
        ),
      }),
      columnHelper.accessor("coaching_priority", {
        header: t("workspace.staffPerformance.columnCoaching"),
        cell: (info) => {
          const value = info.getValue();
          if (value === "NONE") {
            return <span className="text-[11px] text-[#8E8E93]">{t("workspace.staffPerformance.noData")}</span>;
          }
          return (
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${coachingTone(value)}`}
            >
              {value}
            </span>
          );
        },
      }),
    ],
    [t],
  );

  const table = useReactTable({
    data: pagedRows,
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <WorkspaceShell
      eyebrow={t("workspace.staffPerformance.eyebrow")}
      title={t("workspace.staffPerformance.title")}
      description={t("workspace.staffPerformance.description")}
      insight={t("workspace.staffPerformance.insight")}
    >
      <section className="grid grid-cols-1 gap-8 border-b border-surface-4 pb-12 md:grid-cols-4">
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{t("workspace.staffPerformance.staffTracked")}</p>
          <p className="font-display text-4xl font-semibold tracking-tight text-text-primary">{rows.length}</p>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className="text-xs text-text-muted">{t("workspace.staffPerformance.activeOperators")}</p>
          </div>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{t("workspace.staffPerformance.avgCompletion")}</p>
          <p className={`font-display text-4xl font-semibold tracking-tight ${scoreTone(avgCompletion)}`}>
            {percent(avgCompletion)}
          </p>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className="text-xs text-text-muted">{t("workspace.staffPerformance.avgCompletionCaption")}</p>
          </div>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{t("workspace.staffPerformance.avgAdherence")}</p>
          <p className={`font-display text-4xl font-semibold tracking-tight ${scoreTone(avgAdherence)}`}>
            {percent(avgAdherence)}
          </p>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className="text-xs text-text-muted">{t("workspace.staffPerformance.avgAdherenceCaption")}</p>
          </div>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{t("workspace.staffPerformance.coachingQueue")}</p>
          <div className="flex items-baseline gap-2 text-text-primary">
            <span className="font-display text-3xl text-[#C44949]">{highCoachingCount}</span>
            <span className="text-sm text-text-muted">{t("workspace.staffPerformance.high")}</span>
            <span className="ml-3 font-display text-2xl text-[#C48B2A]">{mediumCoachingCount}</span>
            <span className="text-sm text-text-muted">{t("workspace.staffPerformance.medium")}</span>
          </div>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className="text-xs text-text-muted">{t("workspace.staffPerformance.coachingCaption")}</p>
          </div>
        </article>
      </section>

      <section className="mt-10 border-b border-surface-4 pb-10">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.staffPerformance.scope")}</p>
          <p className="mt-1 text-sm text-text-muted">
            {t("workspace.staffPerformance.scopeDescription")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label={t("workspace.staffPerformance.timeframe")}
            value={timeframe}
            onChange={setTimeframe}
            options={[
              { value: "7d", label: t("workspace.staffPerformance.last7Days") },
              { value: "30d", label: t("workspace.staffPerformance.last30Days") },
              { value: "90d", label: t("workspace.staffPerformance.last90Days") },
            ]}
          />
          <Select
            label={t("workspace.staffPerformance.branch")}
            value={branchFilter}
            onChange={setBranchFilter}
            options={[
              { value: "ALL", label: t("workspace.staffPerformance.allBranches") },
              ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
          />
        </div>
        <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 px-4 py-3">
          <p className="text-xs text-text-muted">
            {t("workspace.staffPerformance.scopeNote")}
          </p>
        </div>
      </section>

      {activeBranchId && !tierLoading && shouldBlockAccess ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : !tierLoading && tier < 2 ? (
        <SubscriptionRequiredState variant="intelligence_required" currentPlanType={planType} compact />
      ) : (
        <>
      <section className="mt-10 border-b border-surface-4 pb-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.staffPerformance.performanceTable")}</p>
            <p className="mt-1 text-sm text-text-muted">{t("workspace.staffPerformance.performanceTableDesc")}</p>
          </div>
          <p className="text-xs text-text-muted">
            {rows.length === 1
              ? t("workspace.staffPerformance.totalRecord", { count: rows.length })
              : t("workspace.staffPerformance.totalRecords", { count: rows.length })
            }
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 shadow-lg">
          {performanceQuery.isLoading ? (
            <p className="px-6 py-6 text-sm text-text-muted">{t("workspace.staffPerformance.loadingStaff")}</p>
          ) : null}
          {performanceQuery.isError ? (
            <p className="px-6 py-6 text-sm text-status-critical">{t("workspace.staffPerformance.loadError")}</p>
          ) : null}
          {!performanceQuery.isLoading && !performanceQuery.isError && rows.length === 0 ? (
            <p className="px-6 py-6 text-sm text-text-muted">
              {t("workspace.staffPerformance.noStaffRecords")}
            </p>
          ) : null}
          {rows.length > TABLE_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 border-b border-surface-4 px-6 py-4">
              <p className="text-xs text-text-muted">
                {t("workspace.staffPerformance.showingRecords", { showing: Math.min(TABLE_PAGE_SIZE, rows.length), total: rows.length })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={tablePage <= 0}
                  onClick={() => setTablePage((prev) => Math.max(0, prev - 1))}
                  className="h-8 rounded-lg border border-[#2E2E33] px-3 text-[11px] text-text-secondary disabled:opacity-40"
                >
                  {t("workspace.staffPerformance.previous")}
                </button>
                <span className="text-[11px] text-text-muted">
                  {t("workspace.staffPerformance.pageIndicator", { page: Math.min(tablePage + 1, totalPages), total: totalPages })}
                </span>
                <button
                  type="button"
                  disabled={tablePage >= totalPages - 1}
                  onClick={() => setTablePage((prev) => Math.min(totalPages - 1, prev + 1))}
                  className="h-8 rounded-lg border border-[#2E2E33] px-3 text-[11px] text-text-secondary disabled:opacity-40"
                >
                  {t("workspace.staffPerformance.next")}
                </button>
              </div>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <NativeTable
              table={table}
              tableClassName="w-full min-w-[1320px]"
              headerClassName="border-b border-surface-4 bg-[#232327]/65"
              headerCellClassName="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted"
              bodyRowClassName="border-b border-[#232327] transition-colors hover:bg-[#232327]/40"
              cellClassName="px-4 py-3"
            />
          ) : null}
        </div>
      </section>

      <section className="mt-10">
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.staffPerformance.coachingNeeds")}</p>
          <p className="mt-1 text-sm text-text-muted">
            {t("workspace.staffPerformance.coachingNeedsDesc")}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {coachingNeeds.length ? (
              coachingNeeds.map((row) => (
                <div key={`coach-${row.member_id}`} className="rounded-lg border border-surface-4 bg-[#232327] px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] text-[#F5F5F7]">{row.name}</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${coachingTone(row.coaching_priority)}`}>
                      {row.coaching_priority}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#8E8E93]">
                    {t("workspace.staffPerformance.coachingRowDetail", {
                      branch: row.branch_name ?? t("workspace.staffPerformance.noData"),
                      completion: percent(row.tasks.completion_rate),
                      adherence: percent(row.schedule.adherence_rate),
                    })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-[#8E8E93]">{t("workspace.staffPerformance.noCoachingNeeded")}</p>
            )}
          </div>
        </article>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">{t("workspace.staffPerformance.staffManagement")}</p>
            <p className="mt-1 text-sm text-text-muted">{t("workspace.staffPerformance.staffManagementDesc")}</p>
          </div>
          {canManageStaff ? <p className="text-xs text-text-muted">{t("workspace.staffPerformance.adminControlsEnabled")}</p> : null}
        </div>
        <div className="divide-y divide-[#232327] rounded-xl border border-surface-4 bg-surface-2 px-6">
          {rows.length ? (
            rows.slice(0, 16).map((row) => (
              <div key={`member-${row.member_id}`} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[13px] text-text-primary">{row.name}</p>
                  <p className="text-[12px] text-text-muted">
                    {row.role_name ?? t("workspace.staffPerformance.noData")} · {row.branch_name ?? t("workspace.staffPerformance.noData")}
                  </p>
                </div>
                {canManageStaff ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(row)}
                    disabled={removeStaffMutation.isPending || removeOrgMemberMutation.isPending}
                    className="inline-flex h-8 items-center rounded-full border border-[#C44949]/45 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C44949] transition-colors hover:bg-[#C44949]/10 disabled:opacity-50"
                  >
                    {t("workspace.staffPerformance.remove")}
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="py-4 text-[12px] text-[#8E8E93]">{t("workspace.staffPerformance.noActiveMembers")}</p>
          )}
        </div>
      </section>
        </>
      )}
    </WorkspaceShell>
  );
}
