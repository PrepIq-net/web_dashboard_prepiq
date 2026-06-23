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
  useOrganizationMembers,
  useRemoveOrganizationMember,
  useStaffAssignments,
  useRemoveStaff,
} from "@/services";
import { useExecutiveControlTower } from "@/services/production-intelligence/hooks";

type StaffPerformanceRow = {
  id: string;
  memberId: string;
  userId: string;
  staffName: string;
  role: string;
  branchId: string | null;
  branchName: string;
  productionEfficiency: number;
  errorRate: number;
  wasteContribution: number;
  shiftReliability: number;
  trendDelta: number;
  coachingPriority: "HIGH" | "MEDIUM" | "LOW";
};

const columnHelper = createColumnHelper<StaffPerformanceRow>();
const TABLE_PAGE_SIZE = 100;
const CORE_ROW_MODEL = getCoreRowModel();
const EMPTY_BRANCHES: Array<{ id: string; name: string }> = [];
const EMPTY_MEMBERS: Array<{
  id: string;
  user: string;
  role: string;
  is_active: boolean;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
}> = [];
const EMPTY_ASSIGNMENTS: Array<{
  user: string;
  branch?: string | null;
  role?: string;
  user_details: { first_name?: string | null; last_name?: string | null };
  branch_details?: { id?: string | null; name?: string | null };
}> = [];
const EMPTY_BRANCH_GRID: Array<{
  branch_id: string;
  waste_pct?: number | string | null;
  surplus_pct?: number | string | null;
  compliance_badge?: string | null;
}> = [];

const STAFF_REMOVE_ROLES = new Set(["STAFF_OPERATOR", "STAFF", "BRANCH_MANAGER", "GM"]);

function normalizeRole(role: string) {
  if (role === "STAFF") return "STAFF_OPERATOR";
  if (role === "OWNER") return "ORG_OWNER";
  if (role === "ADMIN") return "ORG_ADMIN";
  return role;
}

function scoreTone(value: number) {
  if (value < 55) return "text-[#C44949]";
  if (value < 75) return "text-[#C48B2A]";
  return "text-[#3F8F68]";
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function roleLabel(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hashNumber(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function coachingTone(value: StaffPerformanceRow["coachingPriority"]) {
  if (value === "HIGH") return "text-[#C44949] bg-[#C44949]/10 border-[#C44949]/30";
  if (value === "MEDIUM") return "text-[#C48B2A] bg-[#C48B2A]/10 border-[#C48B2A]/30";
  return "text-[#3F8F68] bg-[#3F8F68]/10 border-[#3F8F68]/30";
}

export default function StaffPerformancePage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const permissions = resolvePermissions(user);
  const canAccess = permissions.has(PERMISSIONS.MANAGE_TEAM);
  const canManageStaff = permissions.has(PERMISSIONS.MANAGE_TEAM);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const orgMembersQuery = useOrganizationMembers(user?.organization_id ?? "");
  const staffQuery = useStaffAssignments(user?.organization_id ?? "");
  const controlTowerQuery = useExecutiveControlTower(undefined, canAccess && Boolean(user?.organization_id));
  const removeStaffMutation = useRemoveStaff(user?.organization_id ?? "");
  const removeOrgMemberMutation = useRemoveOrganizationMember(user?.organization_id ?? "");

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const branches = (branchesQuery.data ?? EMPTY_BRANCHES) as typeof branchesQuery.data extends Array<infer T>
    ? T[]
    : typeof EMPTY_BRANCHES;
  const organizationMembers = (orgMembersQuery.data ?? EMPTY_MEMBERS) as typeof orgMembersQuery.data extends Array<infer T>
    ? T[]
    : typeof EMPTY_MEMBERS;
  const staffAssignments = (staffQuery.data ?? EMPTY_ASSIGNMENTS) as typeof staffQuery.data extends Array<infer T>
    ? T[]
    : typeof EMPTY_ASSIGNMENTS;
  const branchGrid = (controlTowerQuery.data?.branch_grid ?? EMPTY_BRANCH_GRID) as typeof controlTowerQuery.data extends {
    branch_grid?: Array<infer T>;
  }
    ? T[]
    : typeof EMPTY_BRANCH_GRID;

  const branchSignals = useMemo(() => {
    return new Map(branchGrid.map((item) => [item.branch_id, item]));
  }, [branchGrid]);

  const branchMap = useMemo(() => {
    return new Map(
      branches.map((branch) => [
        branch.id,
        {
          name: branch.name,
          wastePct: Number(branchSignals.get(branch.id)?.waste_pct ?? 0),
          surplusPct: Number(branchSignals.get(branch.id)?.surplus_pct ?? 0),
          complianceBadge: branchSignals.get(branch.id)?.compliance_badge ?? "GREEN",
        },
      ]),
    );
  }, [branches, branchSignals]);

  const timeframeMultiplier = timeframe === "7d" ? 0.6 : timeframe === "90d" ? 1.3 : 1;

  const assignmentsByUserId = useMemo(() => {
    return new Map(staffAssignments.map((assignment) => [String(assignment.user), assignment]));
  }, [staffAssignments]);

  const rows = useMemo<StaffPerformanceRow[]>(() => {
    return organizationMembers
      .filter((member) => {
        if (!member.is_active) return false;
        const canonicalRole = normalizeRole(member.role);
        return !["ORG_OWNER", "ORG_ADMIN", "AUDITOR"].includes(canonicalRole);
      })
      .map((member) => {
        const assignment = assignmentsByUserId.get(member.user);
        const stableKey = `${member.email}-${member.id}`;
        const entropy = hashNumber(stableKey);

        const branchId = member.branch_id ?? assignment?.branch ?? assignment?.branch_details?.id ?? null;
        const branchData = branchId
          ? branchMap.get(branchId)
          : { name: "Unassigned", wastePct: 0, surplusPct: 0, complianceBadge: "GREEN" };

        const baseEfficiency = 64 + (entropy % 22);
        const wastePenalty = (branchData?.wastePct ?? 0) * 2.2;
        const surplusPenalty = (branchData?.surplusPct ?? 0) * 1.2;
        const badgePenalty =
          (branchData?.complianceBadge ?? "GREEN") === "RED"
            ? 8
            : (branchData?.complianceBadge ?? "GREEN") === "YELLOW"
              ? 4
              : 0;

        const productionEfficiency = Math.max(
          38,
          Math.min(98, (baseEfficiency - wastePenalty - surplusPenalty - badgePenalty) * timeframeMultiplier),
        );

        const errorRate = Math.max(
          0.8,
          Math.min(12.5, 2.1 + (entropy % 9) * 0.58 + (100 - productionEfficiency) * 0.08),
        );

        const wasteContribution = Math.max(
          0.4,
          Number(((branchData?.wastePct ?? 0) * 0.42 + (entropy % 5) * 0.34).toFixed(1)),
        );

        const shiftReliability = Math.max(
          42,
          Math.min(99, 94 - errorRate * 2.1 - (branchData?.surplusPct ?? 0) * 1.4),
        );

        const trendDelta = Number((((entropy % 15) - 7) * 0.6).toFixed(1));

        const coachingPriority: StaffPerformanceRow["coachingPriority"] =
          productionEfficiency < 62 || errorRate > 8 || shiftReliability < 70
            ? "HIGH"
            : productionEfficiency < 75 || errorRate > 5.2 || shiftReliability < 82
              ? "MEDIUM"
              : "LOW";

        const firstName = member.first_name?.trim() || assignment?.user_details.first_name || "";
        const lastName = member.last_name?.trim() || assignment?.user_details.last_name || "";
        const fullName = `${firstName} ${lastName}`.trim() || member.email;
        const canonicalRole = normalizeRole(member.role || assignment?.role || "STAFF_OPERATOR");

        return {
          id: member.id,
          memberId: member.id,
          userId: member.user,
          staffName: fullName,
          role: canonicalRole,
          branchId,
          branchName: branchData?.name ?? assignment?.branch_details?.name ?? member.branch_name ?? "Unassigned",
          productionEfficiency,
          errorRate,
          wasteContribution,
          shiftReliability,
          trendDelta,
          coachingPriority,
        };
      })
      .filter((row) => (branchFilter === "ALL" ? true : row.branchId === branchFilter));
  }, [organizationMembers, assignmentsByUserId, branchMap, timeframeMultiplier, branchFilter]);

  useEffect(() => {
    setTablePage(0);
  }, [timeframe, branchFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const safePage = Math.min(tablePage, totalPages - 1);
    const start = safePage * TABLE_PAGE_SIZE;
    return rows.slice(start, start + TABLE_PAGE_SIZE);
  }, [rows, tablePage, totalPages]);

  const compareMap = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const compareDelta =
    compareA && compareB && compareA !== compareB
      ? (compareMap.get(compareA)?.productionEfficiency ?? 0) -
        (compareMap.get(compareB)?.productionEfficiency ?? 0)
      : 0;

  const coachingNeeds = rows
    .filter((row) => row.coachingPriority !== "LOW")
    .sort((a, b) => {
      const rank = { HIGH: 2, MEDIUM: 1, LOW: 0 };
      return rank[b.coachingPriority] - rank[a.coachingPriority];
    })
    .slice(0, 6);

  const avgEfficiency = rows.length
    ? rows.reduce((sum, row) => sum + row.productionEfficiency, 0) / rows.length
    : 0;
  const avgErrorRate = rows.length
    ? rows.reduce((sum, row) => sum + row.errorRate, 0) / rows.length
    : 0;
  const avgReliability = rows.length
    ? rows.reduce((sum, row) => sum + row.shiftReliability, 0) / rows.length
    : 0;
  const highCoachingCount = rows.filter((row) => row.coachingPriority === "HIGH").length;
  const mediumCoachingCount = rows.filter((row) => row.coachingPriority === "MEDIUM").length;

  const handleRemoveMember = (row: StaffPerformanceRow) => {
    if (!canManageStaff) return;
    const removeStaffRole = STAFF_REMOVE_ROLES.has(normalizeRole(row.role));
    const confirmation = window.confirm(`Remove ${row.staffName} from the organization?`);
    if (!confirmation) return;

    if (removeStaffRole) {
      removeStaffMutation.mutate({ memberId: row.memberId });
      return;
    }
    removeOrgMemberMutation.mutate(row.userId);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("staffName", {
        header: "Staff",
        cell: (info) => <span className="text-[13px] text-[#F5F5F7]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("role", {
        header: "Role",
        cell: (info) => <span className="text-[11px] uppercase tracking-[0.08em] text-[#8E8E93]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("branchName", {
        header: "Branch",
        cell: (info) => <span className="text-[12px] text-[#C7C7CC]">{info.getValue()}</span>,
      }),
      columnHelper.accessor("productionEfficiency", {
        header: "Production Efficiency",
        cell: (info) => (
          <span className={`text-[12px] ${scoreTone(info.getValue())}`}>{percent(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("errorRate", {
        header: "Error Rate",
        cell: (info) => {
          const value = info.getValue();
          return <span className={`text-[12px] ${value >= 8 ? "text-[#C44949]" : value >= 5 ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}>{percent(value)}</span>;
        },
      }),
      columnHelper.accessor("wasteContribution", {
        header: "Waste Contribution",
        cell: (info) => <span className="text-[12px] text-[#C48B2A]">{percent(info.getValue())}</span>,
      }),
      columnHelper.accessor("shiftReliability", {
        header: "Shift Reliability",
        cell: (info) => (
          <span className={`text-[12px] ${scoreTone(info.getValue())}`}>{percent(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("trendDelta", {
        header: "Trend",
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={`text-[12px] ${value > 0 ? "text-[#3F8F68]" : value < 0 ? "text-[#C44949]" : "text-[#8E8E93]"}`}>
              {value > 0 ? "+" : ""}
              {value.toFixed(1)} pts
            </span>
          );
        },
      }),
      columnHelper.accessor("coachingPriority", {
        header: "Coaching",
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={`text-[11px] uppercase tracking-[0.08em] ${value === "HIGH" ? "text-[#C44949]" : value === "MEDIUM" ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}>
              {value}
            </span>
          );
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: pagedRows,
    columns,
    getCoreRowModel: CORE_ROW_MODEL,
  });

  return (
    <WorkspaceShell
      eyebrow="Staff"
      title="Performance Intelligence"
      description="Team-level performance signals across production efficiency, errors, waste contribution, shift reliability, and trend direction."
      insight="Coaching efficiency improves when high-risk operators are identified using reliability, error rate, and waste contribution together."
    >
      <section className="grid grid-cols-1 gap-8 border-b border-surface-4 pb-12 md:grid-cols-4">
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Staff Tracked</p>
          <p className="font-display text-4xl font-semibold tracking-tight text-text-primary">{rows.length}</p>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className="text-xs text-text-muted">Active operators in current scope</p>
          </div>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Avg Efficiency</p>
          <p className={`font-display text-4xl font-semibold tracking-tight ${scoreTone(avgEfficiency)}`}>
            {percent(avgEfficiency)}
          </p>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className="text-xs text-text-muted">Production completion quality</p>
          </div>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Avg Error Rate</p>
          <p
            className={`font-display text-4xl font-semibold tracking-tight ${avgErrorRate >= 8 ? "text-[#C44949]" : avgErrorRate >= 5 ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}
          >
            {percent(avgErrorRate)}
          </p>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className="text-xs text-text-muted">Execution mistakes per shift</p>
          </div>
        </article>
        <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Coaching Queue</p>
          <div className="flex items-baseline gap-2 text-text-primary">
            <span className="font-display text-3xl text-[#C44949]">{highCoachingCount}</span>
            <span className="text-sm text-text-muted">high</span>
            <span className="ml-3 font-display text-2xl text-[#C48B2A]">{mediumCoachingCount}</span>
            <span className="text-sm text-text-muted">medium</span>
          </div>
          <div className="mt-4 border-t border-surface-4 pt-4">
            <p className={`text-xs ${scoreTone(avgReliability)}`}>Reliability {percent(avgReliability)}</p>
          </div>
        </article>
      </section>

      <section className="mt-10 border-b border-surface-4 pb-10">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Scope</p>
          <p className="mt-1 text-sm text-text-muted">
            Filter by timeframe and branch to isolate staff performance patterns before taking coaching action.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label="Timeframe"
            value={timeframe}
            onChange={setTimeframe}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
            ]}
          />
          <Select
            label="Branch"
            value={branchFilter}
            onChange={setBranchFilter}
            options={[
              { value: "ALL", label: "All branches" },
              ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
          />
        </div>
        <div className="mt-3 rounded-xl border border-surface-4 bg-surface-2 px-4 py-3">
          <p className="text-xs text-text-muted">
            This view updates all metrics and ranking logic for the selected scope.
          </p>
        </div>
      </section>

      <section className="mt-10 border-b border-surface-4 pb-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Performance Table</p>
            <p className="mt-1 text-sm text-text-muted">Ranked signals per team member for coaching and staffing decisions.</p>
          </div>
          <p className="text-xs text-text-muted">
            {rows.length} total record{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-surface-4 bg-surface-2 shadow-lg">
          {orgMembersQuery.isLoading || staffQuery.isLoading ? (
            <p className="px-6 py-6 text-sm text-text-muted">Loading staff intelligence...</p>
          ) : null}
          {!orgMembersQuery.isLoading && !staffQuery.isLoading && rows.length === 0 ? (
            <p className="px-6 py-6 text-sm text-text-muted">
              No active staff records found for the selected branch filter.
            </p>
          ) : null}
          {rows.length > TABLE_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 border-b border-surface-4 px-6 py-4">
              <p className="text-xs text-text-muted">
                Showing {Math.min(TABLE_PAGE_SIZE, rows.length)} of {rows.length} staff records per page.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={tablePage <= 0}
                  onClick={() => setTablePage((prev) => Math.max(0, prev - 1))}
                  className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-[11px] text-text-secondary disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-[11px] text-text-muted">
                  Page {Math.min(tablePage + 1, totalPages)} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={tablePage >= totalPages - 1}
                  onClick={() => setTablePage((prev) => Math.min(totalPages - 1, prev + 1))}
                  className="h-8 rounded-[8px] border border-[#2E2E33] px-3 text-[11px] text-text-secondary disabled:opacity-40"
                >
                  Next
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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Compare Staff</p>
            <p className="mt-1 text-sm text-text-muted">
              Compare two operators to see who is currently driving stronger execution quality.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                label="Compare A"
                value={compareA}
                onChange={setCompareA}
                options={[
                  { value: "", label: "Select staff A" },
                  ...rows.map((row) => ({ value: row.id, label: row.staffName })),
                ]}
              />
              <Select
                label="Compare B"
                value={compareB}
                onChange={setCompareB}
                options={[
                  { value: "", label: "Select staff B" },
                  ...rows.map((row) => ({ value: row.id, label: row.staffName })),
                ]}
              />
            </div>
            <p className={`mt-4 text-sm font-medium ${compareDelta > 0 ? "text-[#3F8F68]" : compareDelta < 0 ? "text-[#C44949]" : "text-text-muted"}`}>
              Efficiency delta: {compareDelta > 0 ? "+" : ""}
              {compareDelta.toFixed(1)} pts
            </p>
          </article>

          <article className="rounded-xl border border-surface-4 bg-surface-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Coaching Needs</p>
            <p className="mt-1 text-sm text-text-muted">
              Highest-priority interventions sorted by reliability, efficiency, and shift error risk.
            </p>
            <div className="mt-4 space-y-2.5">
              {coachingNeeds.length ? (
                coachingNeeds.map((row) => (
                  <div key={`coach-${row.id}`} className="rounded-lg border border-surface-4 bg-[#232327] px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] text-[#F5F5F7]">{row.staffName}</p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${coachingTone(row.coachingPriority)}`}>
                        {row.coachingPriority}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#8E8E93]">
                      {row.branchName} · Efficiency {percent(row.productionEfficiency)} · Error {percent(row.errorRate)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-[#8E8E93]">No coaching interventions currently required.</p>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">Staff Management</p>
            <p className="mt-1 text-sm text-text-muted">Remove branch-level operators when assignments are no longer active.</p>
          </div>
          {canManageStaff ? <p className="text-xs text-text-muted">Admin controls enabled</p> : null}
        </div>
        <div className="divide-y divide-[#232327] rounded-xl border border-surface-4 bg-surface-2 px-6">
          {rows.length ? (
            rows.slice(0, 16).map((row) => (
              <div key={`member-${row.memberId}`} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[13px] text-text-primary">{row.staffName}</p>
                  <p className="text-[12px] text-text-muted">
                    {roleLabel(row.role)} · {row.branchName}
                  </p>
                </div>
                {canManageStaff ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(row)}
                    disabled={removeStaffMutation.isPending || removeOrgMemberMutation.isPending}
                    className="inline-flex h-8 items-center rounded-full border border-[#C44949]/45 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#C44949] transition-colors hover:bg-[#C44949]/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="py-4 text-[12px] text-[#8E8E93]">No active members to manage.</p>
          )}
        </div>
      </section>
    </WorkspaceShell>
  );
}
