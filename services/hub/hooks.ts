"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  executeMessageAction,
  getConversations,
  getMessages,
  getShareables,
  globalSearch,
  markRead,
  openNotificationConversation,
  resolveConversation,
  searchDirectory,
  sendMessage,
  updateConversation,
  type SendMessageInput,
} from "./service";
import type {
  HubConversation,
  HubMessage,
  MessagesPage,
  ResolveConversationPayload,
} from "./types";

export const hubQueryKeys = {
  root: ["hub"] as const,
  conversations: () => [...hubQueryKeys.root, "conversations"] as const,
  messages: (conversationId: string) =>
    [...hubQueryKeys.root, "messages", conversationId] as const,
  directory: (query: string) => [...hubQueryKeys.root, "directory", query] as const,
  shareables: (query: string) => [...hubQueryKeys.root, "shareables", query] as const,
  search: (query: string) => [...hubQueryKeys.root, "search", query] as const,
};

export function useHubConversations() {
  return useQuery({
    queryKey: hubQueryKeys.conversations(),
    queryFn: getConversations,
    staleTime: 15_000,
  });
}

export function useHubMessages(conversationId: string | null) {
  return useQuery({
    queryKey: hubQueryKeys.messages(conversationId ?? "none"),
    queryFn: () => getMessages(conversationId as string),
    enabled: Boolean(conversationId),
    staleTime: 60_000,
  });
}

export function useResolveConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ResolveConversationPayload) => resolveConversation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubQueryKeys.conversations() });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof updateConversation>[1];
    }) => updateConversation(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubQueryKeys.conversations() });
    },
  });
}

/** Insert/replace a message in the per-conversation cache (dedupes by id and client_id). */
export function upsertMessageInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  message: HubMessage,
) {
  queryClient.setQueryData<MessagesPage>(
    hubQueryKeys.messages(message.conversation_id),
    (page) => {
      if (!page) return page;
      const existingIndex = page.results.findIndex(
        (m) =>
          m.id === message.id ||
          (Boolean(message.client_id) && m.client_id === message.client_id),
      );
      if (existingIndex >= 0) {
        const results = [...page.results];
        results[existingIndex] = message;
        return { ...page, results };
      }
      return { ...page, results: [...page.results, message] };
    },
  );
}

export function useSendHubMessage(conversationId: string, senderIsMe: HubMessage["sender"]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMessageInput) => sendMessage(conversationId, input),
    onMutate: async (input) => {
      // Optimistic bubble; replaced when the server copy arrives (same client_id).
      const optimistic: HubMessage = {
        id: `optimistic-${input.clientId}`,
        conversation_id: conversationId,
        sender: senderIsMe,
        sender_kind: "USER",
        message_type: input.attachments?.length
          ? "FILE"
          : input.references?.length
            ? "REFERENCE"
            : "TEXT",
        content: input.content,
        metadata: {},
        reply_to: null,
        client_id: input.clientId,
        attachments: [],
        references: [],
        is_me: true,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        pending: true,
      };
      upsertMessageInCache(queryClient, optimistic);
      return { clientId: input.clientId };
    },
    onSuccess: (message) => {
      upsertMessageInCache(queryClient, { ...message, is_me: true });
      queryClient.invalidateQueries({ queryKey: hubQueryKeys.conversations() });
    },
    onError: (_error, input) => {
      queryClient.setQueryData<MessagesPage>(
        hubQueryKeys.messages(conversationId),
        (page) =>
          page
            ? {
                ...page,
                results: page.results.filter((m) => m.client_id !== input.clientId),
              }
            : page,
      );
    },
  });
}

export function useLoadOlderMessages(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (before: string) => getMessages(conversationId, before),
    onSuccess: (older) => {
      queryClient.setQueryData<MessagesPage>(
        hubQueryKeys.messages(conversationId),
        (page) =>
          page
            ? {
                has_more: older.has_more,
                results: [...older.results, ...page.results],
              }
            : older,
      );
    },
  });
}

export function useMarkHubRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markRead(conversationId),
    onSuccess: (_data, conversationId) => {
      queryClient.setQueryData(
        hubQueryKeys.conversations(),
        (
          data:
            | { results: HubConversation[]; online: Record<string, string[]> }
            | undefined,
        ) =>
          data
            ? {
                ...data,
                results: data.results.map((c) =>
                  c.id === conversationId ? { ...c, unread_count: 0 } : c,
                ),
              }
            : data,
      );
    },
  });
}

export function useExecuteMessageAction() {
  return useMutation({
    mutationFn: ({ messageId, actionId }: { messageId: string; actionId: string }) =>
      executeMessageAction(messageId, actionId),
  });
}

export function useHubDirectory(query: string, enabled = true) {
  return useQuery({
    queryKey: hubQueryKeys.directory(query),
    queryFn: () => searchDirectory(query),
    enabled,
    staleTime: 30_000,
  });
}

export function useHubShareables(query: string, enabled = true) {
  return useQuery({
    queryKey: hubQueryKeys.shareables(query),
    queryFn: () => getShareables(query),
    enabled,
    staleTime: 30_000,
  });
}

export function useHubGlobalSearch(query: string) {
  return useQuery({
    queryKey: hubQueryKeys.search(query),
    queryFn: () => globalSearch(query),
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
  });
}

export function useOpenNotificationConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => openNotificationConversation(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubQueryKeys.conversations() });
    },
  });
}
