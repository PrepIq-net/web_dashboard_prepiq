export const organizationsEndpoints = {
  register: "/api/organizations/register/",
  list: "/api/organizations/me/",
  detail: (id: string) => `/api/organizations/${id}/`,
  members: (id: string) => `/api/organizations/${id}/members/`,
  addMember: (id: string) => `/api/organizations/${id}/members/add/`,
  updateMember: (id: string, userId: string) =>
    `/api/organizations/${id}/members/${userId}/update/`,
  removeMember: (id: string, userId: string) =>
    `/api/organizations/${id}/members/${userId}/`,
  leave: (id: string) => `/api/organizations/${id}/leave/`,
  transferOwnership: (id: string) =>
    `/api/organizations/${id}/transfer-ownership/`,
  /** POST to grant co-owner status, DELETE to revoke it. Primary Owner only. */
  coOwner: (id: string, userId: string) =>
    `/api/organizations/${id}/members/${userId}/co-owner/`,
  publicDetail: (id: string) => `/api/organizations/business/${id}/`,
  financialOverview: (id: string) =>
    `/api/organizations/${id}/financial/overview/`,
  staffPerformance: (id: string) =>
    `/api/organizations/${id}/staff-performance/`,
  // RBAC endpoints
  permissions: (id: string) => `/api/organizations/${id}/permissions/`,
  roles: (id: string) => `/api/organizations/${id}/roles/`,
  roleDetail: (id: string, roleId: string) =>
    `/api/organizations/${id}/roles/${roleId}/`,
  /** GET the member's effective access; POST/DELETE their direct grants. */
  memberAccess: (id: string, userId: string) =>
    `/api/organizations/${id}/members/${userId}/access/`,
} as const;
