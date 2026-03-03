const ORG = (orgId: string) => `/api/organizations/${orgId}`;

export const branchEndpoints = {
  // ── Branches ──────────────────────────────────────────────────────────────
  list: (orgId: string) => `${ORG(orgId)}/branches/`,
  detail: (orgId: string, branchId: string) =>
    `${ORG(orgId)}/branches/${branchId}/`,
  setPrimary: (orgId: string, branchId: string) =>
    `${ORG(orgId)}/branches/${branchId}/set-primary/`,

  // ── Departments ───────────────────────────────────────────────────────────
  departments: (orgId: string) => `${ORG(orgId)}/departments/`,
  departmentDetail: (orgId: string, deptId: string) =>
    `${ORG(orgId)}/departments/${deptId}/`,

  // ── Staff invites ─────────────────────────────────────────────────────────
  staffInviteContext: (orgId: string) => `${ORG(orgId)}/staff/invite-context/`,
  invites: (orgId: string) => `${ORG(orgId)}/invites/`,
  revokeInvite: (orgId: string, inviteId: string) =>
    `${ORG(orgId)}/invites/${inviteId}/revoke/`,
  /** Token-based — no orgId needed */
  acceptInvite: () => `/api/organizations/invites/accept/`,

  // ── Staff assignments ─────────────────────────────────────────────────────
  staffAssignments: (orgId: string) => `${ORG(orgId)}/staff-assignments/`,
  removeStaff: (orgId: string, memberId: string) =>
    `${ORG(orgId)}/staff/${memberId}/remove/`,
} as const;
