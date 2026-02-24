export const notificationEndpoints = {
  list: () => "/api/notifications/",
  markAsRead: () => "/api/notifications/mark-as-read/",
  markAsResolved: () => "/api/notifications/mark-as-resolved/",
  analyticsSummary: () => "/api/notifications/analytics/summary/",
} as const;
