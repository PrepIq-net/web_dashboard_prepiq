export const notificationEndpoints = {
  list: () => "/api/notifications/",
  preferences: () => "/api/notifications/preferences/",
  quietHours: () => "/api/notifications/quiet-hours/",
  markAsRead: () => "/api/notifications/mark-as-read/",
  markAsResolved: () => "/api/notifications/mark-as-resolved/",
  analyticsSummary: () => "/api/notifications/analytics/summary/",
  webPushPublicKey: () => "/api/notifications/web-push/public-key/",
  webPushSubscribe: () => "/api/notifications/web-push/subscribe/",
  webPushUnsubscribe: () => "/api/notifications/web-push/unsubscribe/",
} as const;
