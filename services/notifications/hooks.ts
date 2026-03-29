"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  markNotificationsAsRead,
  markNotificationsAsResolved,
} from "@/services/notifications/service";
import type { MarkNotificationsPayload } from "@/services/notifications/types";

export const notificationQueryKeys = {
  root: ["notifications"] as const,
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
