export const organizationsEndpoints = {
  register: "/api/organizations/register/",
  list: "/api/organizations/my/",
  detail: (id: string) => `/api/organizations/${id}/`,
  members: (id: string) => `/api/organizations/${id}/members/`,
  addMember: (id: string) => `/api/organizations/${id}/members/add/`,
  removeMember: (orgId: string, userId: string) =>
    `/api/organizations/${orgId}/members/${userId}/remove/`,
  publicDetail: (id: string) => `/api/organizations/business/${id}/`,
  verify: (id: string) => `/api/organizations/${id}/verify/`,
} as const;
