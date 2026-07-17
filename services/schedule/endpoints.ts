const BASE = `/api/labor`;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const scheduleEndpoints = {
  availability: (branchId: string, week: string) =>
    `${BASE}/availability/${buildQuery({ branch_id: branchId, week })}`,

  reviewAvailability: (availabilityId: string) =>
    `${BASE}/availability/${availabilityId}/review/`,

  scheduleWeek: (branchId: string, week: string) =>
    `${BASE}/schedules/${buildQuery({ branch_id: branchId, week })}`,

  generate: () => `${BASE}/schedules/generate/`,

  copyPrevious: () => `${BASE}/schedules/copy-previous/`,

  publish: (scheduleId: string) => `${BASE}/schedules/${scheduleId}/publish/`,

  shifts: () => `${BASE}/shifts/`,

  shiftDetail: (shiftId: string) => `${BASE}/shifts/${shiftId}/`,

  coverage: (branchId: string, week: string) =>
    `${BASE}/coverage/${buildQuery({ branch_id: branchId, week })}`,

  recomputeRequirements: () => `${BASE}/requirements/recompute/`,

  history: (branchId: string, weeks: number) =>
    `${BASE}/history/${buildQuery({ branch_id: branchId, weeks })}`,

  shiftTemplates: (branchId: string) =>
    `${BASE}/shift-templates/${buildQuery({ branch_id: branchId })}`,

  roles: (branchId: string) => `${BASE}/roles/${buildQuery({ branch_id: branchId })}`,

  // Roster membership (BranchStaff) is managed via the branch-command staff
  // action, not labor — assigning an existing org member a branch role is what
  // puts them on the schedule roster.
  assignRosterRole: () =>
    `/api/production-intelligence/home/branch-command/staff-action/`,
} as const;
