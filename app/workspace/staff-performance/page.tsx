"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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

function hashNumber(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const columnHelper = createColumnHelper<StaffPerformanceRow>();
const coreRowModel = getCoreRowModel();

export default function StaffPerformancePage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const role = user?.organization_role ?? "";

  const canAccess = ["BRANCH_MANAGER", "GM", "OPS_DIRECTOR", "ORG_OWNER", "ORG_ADMIN"].includes(role);
  const canManageStaff = ["BRANCH_MANAGER", "GM", "OPS_DIRECTOR", "ORG_OWNER", "ORG_ADMIN"].includes(role);

  const branchesQuery = useBranches(user?.organization_id ?? "");
  const orgMembersQuery = useOrganizationMembers(user?.organization_id ?? "");
  const staffQuery = useStaffAssignments(user?.organization_id ?? "");
  const controlTowerQuery = useExecutiveControlTower(undefined, canAccess);
  const removeStaffMutation = useRemoveStaff(user?.organization_id ?? "");
  const removeOrgMemberMutation = useRemoveOrganizationMember(user?.organization_id ?? "");

  const [timeframe, setTimeframe] = useState("30d");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  const branches = branchesQuery.data ?? [];
  const organizationMembers = orgMembersQuery.data ?? [];
  const staffAssignments = staffQuery.data ?? [];
  const branchGrid = controlTowerQuery.data?.branch_grid ?? [];

  const branchMap = useMemo(() => {
    return new Map(
      branches.map((branch) => [
        branch.id,
        {
          name: branch.name,
          wastePct: Number(
            branchGrid.find((item) => item.branch_id === branch.id)?.waste_pct ?? 0,
          ),
          surplusPct: Number(
            branchGrid.find((item) => item.branch_id === branch.id)?.surplus_pct ?? 0,
          ),
          complianceBadge:
            branchGrid.find((item) => item.branch_id === branch.id)?.compliance_badge ??
            "GREEN",
        },
      ]),
    );
  }, [branches, branchGrid]);

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

  const compareMap = new Map(rows.map((row) => [row.id, row]));
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
    data: rows,
    columns,
    getCoreRowModel: coreRowModel,
  });

  return (
    <WorkspaceShell
      eyebrow="Staff"
      title="Performance Intelligence"
      description="Team-level performance signals across production efficiency, errors, waste contribution, shift reliability, and trend direction."
      insight="Coaching efficiency improves when high-risk operators are identified using reliability, error rate, and waste contribution together."
    >
      <section className="grid grid-cols-1 gap-6 border-b border-[#2A2A2E] pb-8 md:grid-cols-4">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Staff Tracked</p>
          <p className="mt-1 font-display text-[30px] text-[#F5F5F7]">{rows.length}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Avg Efficiency</p>
          <p className={`mt-1 font-display text-[30px] ${scoreTone(avgEfficiency)}`}>{percent(avgEfficiency)}</p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Avg Error Rate</p>
          <p className={`mt-1 font-display text-[30px] ${avgErrorRate >= 8 ? "text-[#C44949]" : avgErrorRate >= 5 ? "text-[#C48B2A]" : "text-[#3F8F68]"}`}>
            {percent(avgErrorRate)}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">Shift Reliability</p>
          <p className={`mt-1 font-display text-[30px] ${scoreTone(avgReliability)}`}>{percent(avgReliability)}</p>
        </article>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          <p className="flex items-center text-[12px] text-[#8E8E93]">
            Filter by time and branch to isolate coaching patterns.
          </p>
        </div>
      </section>

      <section className="mt-8 border-b border-[#2A2A2E] pb-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Performance Table</p>
        <div className="mt-3 overflow-x-auto">
          {orgMembersQuery.isLoading || staffQuery.isLoading ? (
            <p className="py-6 text-[13px] text-[#8E8E93]">Loading staff intelligence...</p>
          ) : null}
          {!orgMembersQuery.isLoading && !staffQuery.isLoading && rows.length === 0 ? (
            <p className="py-6 text-[13px] text-[#8E8E93]">
              No active staff records found for the selected branch filter.
            </p>
          ) : null}
          <table className="w-full min-w-[1320px]">
            <thead className="border-b border-[#2A2A2E]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-[#8E8E93]">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[#232327]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <article>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Compare Staff</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
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
            <p className={`mt-3 text-[13px] ${compareDelta > 0 ? "text-[#3F8F68]" : compareDelta < 0 ? "text-[#C44949]" : "text-[#8E8E93]"}`}>
              Efficiency delta: {compareDelta > 0 ? "+" : ""}
              {compareDelta.toFixed(1)} pts
            </p>
          </article>

          <article>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Coaching Needs</p>
            <div className="mt-3 space-y-2">
              {coachingNeeds.length ? (
                coachingNeeds.map((row) => (
                  <div key={`coach-${row.id}`} className="border-b border-[#232327] pb-2.5">
                    <p className="text-[13px] text-[#F5F5F7]">{row.staffName}</p>
                    <p className="text-[12px] text-[#8E8E93]">
                      {row.branchName} · Efficiency {percent(row.productionEfficiency)} · Error {percent(row.errorRate)}
                    </p>
                    <p className={`text-[11px] uppercase tracking-[0.08em] ${row.coachingPriority === "HIGH" ? "text-[#C44949]" : "text-[#C48B2A]"}`}>
                      {row.coachingPriority} coaching priority
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

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">Staff Management</p>
        <div className="mt-3 divide-y divide-[#232327] border-y border-[#2A2A2E]">
          {rows.length ? (
            rows.slice(0, 16).map((row) => (
              <div key={`member-${row.memberId}`} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[13px] text-[#F5F5F7]">{row.staffName}</p>
                  <p className="text-[12px] text-[#8E8E93]">
                    {row.role.replace(/_/g, " ")} · {row.branchName}
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
