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
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.domain) search.set("domain", params.domain);
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
