export const supportEndpoints = {
  tickets: "/support/tickets",
  ticket: (id: string) => `/support/tickets/${id}`,
  bugReports: "/support/bug-reports",
  featureRequests: "/support/feature-requests",
  featureRequest: (id: string) => `/support/feature-requests/${id}`,
  featureRequestVote: (id: string) => `/support/feature-requests/${id}/vote`,
  systemStatus: "/support/system-status",
  helpArticles: "/support/help-articles",
  helpArticle: (slug: string) => `/support/help-articles/${slug}`,
  searchHelp: "/support/help-articles/search",
  stats: "/support/stats",
} as const;