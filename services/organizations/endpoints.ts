export const organizationsEndpoints = {
  register: "/api/organizations/register/",
  list: "/api/organizations/me/",
  detail: (id: string) => `/api/organizations/${id}/`,
  members: (id: string) => `/api/organizations/${id}/members/`,
  addMember: (id: string) => `/api/organizations/${id}/members/add/`,
  removeMember: (id: string, userId: string) =>
    `/api/organizations/${id}/members/${userId}/`,
  publicDetail: (id: string) => `/api/organizations/business/${id}/`,
} as const;
