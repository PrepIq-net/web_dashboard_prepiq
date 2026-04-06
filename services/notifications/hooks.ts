"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  markNotificationsAsRead,
  markNotificationsAsResolved,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/notifications/service";
import type {
  MarkNotificationsPayload,
  NotificationPreference,
} from "@/services/notifications/types";
import { toast } from "react-hot-toast";

export const notificationQueryKeys = {
  root: ["notifications"] as const,
  preferences: () => [...notificationQueryKeys.root, "preferences"] as const,
  list: (params?: {
    status?: string;
    domain?: string;
    urgency?: string;
    escalation?: string;
    is_today?: boolean;
    limit?: number;
  }) =>
    [
      ...notificationQueryKeys.root,
      "list",
      params?.status ?? "",
      params?.domain ?? "",
      params?.urgency ?? "",
      params?.escalation ?? "",
      params?.is_today ? "today" : "",
      params?.limit?.toString() ?? "",
    ] as const,
};

export function useNotifications(params?: {
  status?: string;
  domain?: string;
  urgency?: string;
  escalation?: string;
  is_today?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: notificationQueryKeys.list(params),
    queryFn: () => getNotifications(params),
  });
}

export function useMarkNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: MarkNotificationsPayload) =>
      markNotificationsAsRead(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.root });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationQueryKeys.preferences(),
    queryFn: getNotificationPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: Partial<NotificationPreference>[]) =>
      updateNotificationPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.preferences(),
      });
      toast.success("Notification preferences updated.");
    },
    onError: (error: any) => {
      toast.error(
        error.message || "Failed to update notification preferences.",
      );
    },
  });
}

export function useMarkNotificationsAsResolved() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: MarkNotificationsPayload) =>
      markNotificationsAsResolved(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.root });
    },
  });
}
