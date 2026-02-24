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
