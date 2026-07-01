import { z } from "zod";

export const notificationSchema = z.object({
  id: z.string().uuid(),
  recipient: z.string().optional(),
  code: z.string().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  channel: z.string().optional(),
  notification_type: z.string().optional(),
  status: z.string().optional(),
  domain: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  notification_category: z.string().nullable().optional(),
  lifecycle_state: z.string().nullable().optional(),
  escalation_level: z.string().nullable().optional(),
  urgency: z.string().nullable().optional(),
  role_scope: z.string().nullable().optional(),
  branch: z.string().uuid().nullable().optional(),
  organization: z.string().uuid().nullable().optional(),
  recommended_action: z.string().nullable().optional(),
  recommended_action_type: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  acknowledged_at: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  viewed_at: z.string().nullable().optional(),
  acted_on: z.boolean().optional(),
  acted_on_at: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  related_id: z.string().nullable().optional(),
  related_model: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationsResponseSchema = z
  .union([
    z.array(notificationSchema),
    z.object({ results: z.array(notificationSchema) }),
  ])
  .transform((payload) => ("results" in payload ? payload.results : payload));
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

export const markNotificationsPayloadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).optional(),
});
export type MarkNotificationsPayload = z.infer<
  typeof markNotificationsPayloadSchema
>;

export const notificationPreferenceSchema = z.object({
  id: z.string().uuid().optional(),
  domain: z.string().optional(),
  notification_category: z.string().optional(),
  email_enabled: z.boolean(),
  sms_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  push_enabled: z.boolean(),
  updated_at: z.string().optional(),
});
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const notificationPreferencesResponseSchema = z.union([
  z.array(notificationPreferenceSchema),
  z.object({ results: z.array(notificationPreferenceSchema) }),
]).transform((payload) => ("results" in payload ? payload.results : payload));

export const NOTIFICATION_CATEGORIES = [
  "OPERATIONAL",
  "PLANNING",
  "LIVE_SERVICE",
  "LEARNING",
  "EXECUTIVE",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_COLORS: Record<NotificationCategory, string> = {
  OPERATIONAL: "#8E8E93",
  PLANNING: "#3A6EA5",
  LIVE_SERVICE: "#D97F3D",
  LEARNING: "#3F8F68",
  EXECUTIVE: "#8B5FBF",
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  OPERATIONAL: "Operational",
  PLANNING: "Planning",
  LIVE_SERVICE: "Live Service",
  LEARNING: "Learning",
  EXECUTIVE: "Executive",
};
