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
  list: (params?: { status?: string; domain?: string }) =>
    [
      ...notificationQueryKeys.root,
      "list",
      params?.status ?? "",
      params?.domain ?? "",
    ] as const,
};

export function useNotifications(params?: { status?: string; domain?: string }) {
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
