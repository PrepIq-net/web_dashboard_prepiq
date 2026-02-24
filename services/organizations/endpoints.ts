export const organizationsEndpoints = {
  register: "/api/organizations/register/",
  list: "/api/organizations/my/",
  detail: (id: string) => `/api/organizations/${id}/`,
  members: (id: string) => `/api/organizations/${id}/members/`,
  publicDetail: (id: string) => `/api/organizations/business/${id}/`,
} as const;
