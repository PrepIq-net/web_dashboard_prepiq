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

  // Employee self-service (mirrors mobile): submit and read your own weekly
  // availability without any management permission.
  myContext: () => `${BASE}/me/context/`,

  myAvailability: (branchId: string, week: string) =>
    `${BASE}/me/availability/${buildQuery({ branch_id: branchId, week })}`,

  submitAvailability: (branchId: string) =>
    `${BASE}/me/availability/${buildQuery({ branch_id: branchId })}`,

  scheduleWeek: (branchId: string, week: string) =>
    `${BASE}/schedules/${buildQuery({ branch_id: branchId, week })}`,

  generate: () => `${BASE}/schedules/generate/`,

  copyPrevious: () => `${BASE}/schedules/copy-previous/`,

  publish: (scheduleId: string) => `${BASE}/schedules/${scheduleId}/publish/`,

  shifts: () => `${BASE}/shifts/`,

  shiftDetail: (shiftId: string) => `${BASE}/shifts/${shiftId}/`,

  coverage: (branchId: string, week: string) =>
    `${BASE}/coverage/${buildQuery({ branch_id: branchId, week })}`,

  // Separate from coverage: 168 rows with staff attached, so it is fetched
  // when the manager opens the view rather than on every schedule page load.
  hourlyCoverage: (branchId: string, week: string) =>
    `${BASE}/coverage/hourly/${buildQuery({ branch_id: branchId, week })}`,

  laborStandard: (branchId: string) =>
    `${BASE}/standards/${buildQuery({ branch_id: branchId })}`,

  employeeLaborProfile: (branchId: string, userId: string) =>
    `${BASE}/employees/${userId}/labor-profile/${buildQuery({ branch_id: branchId })}`,

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
