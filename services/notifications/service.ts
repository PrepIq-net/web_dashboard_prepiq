import { z } from "zod";
import { apiClientWithSchema } from "@/lib/api/client";
import { notificationEndpoints } from "@/services/notifications/endpoints";
import {
  markNotificationsPayloadSchema,
  notificationsResponseSchema,
  type MarkNotificationsPayload,
} from "@/services/notifications/types";

export async function getNotifications(params?: {
  status?: string;
  domain?: string;
  urgency?: string;
  escalation?: string;
  is_today?: boolean;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.domain) search.set("domain", params.domain);
  if (params?.urgency) search.set("urgency", params.urgency);
  if (params?.escalation) search.set("escalation", params.escalation);
  if (params?.is_today) search.set("is_today", "true");
  if (params?.limit) search.set("limit", params.limit.toString());
  const query = search.toString();
  const endpoint = query
    ? `${notificationEndpoints.list()}?${query}`
    : notificationEndpoints.list();

  return apiClientWithSchema(endpoint, notificationsResponseSchema, {
    method: "GET",
  });
}

export async function markNotificationsAsRead(payload?: MarkNotificationsPayload) {
  const body = payload ? markNotificationsPayloadSchema.parse(payload) : {};
  return apiClientWithSchema(notificationEndpoints.markAsRead(), z.void(), {
    method: "POST",
    body,
  });
}

export async function markNotificationsAsResolved(
  payload?: MarkNotificationsPayload,
) {
  const body = payload ? markNotificationsPayloadSchema.parse(payload) : {};
  return apiClientWithSchema(notificationEndpoints.markAsResolved(), z.void(), {
    method: "POST",
    body,
  });
}
