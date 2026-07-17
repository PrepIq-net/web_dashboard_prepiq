"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getChatThreads,
  getChatThread,
  createChatThread,
  getChatThreadMessages,
  createChatThreadMessage,
  assignChatThread,
  updateChatThreadStatus,
  markChatThreadAsRead,
  reportChatThread,
  getThreadTags,
  createThreadTag,
  getThreadUserBlocks,
  createThreadUserBlock,
  deleteThreadUserBlock,
  getChatAnalytics,
  runChatThreadAutomation,
} from "./service";
import type {
  ChatThreadMessage,
  CreateThreadPayload,
  CreateMessagePayload,
  AssignThreadPayload,
  UpdateThreadStatusPayload,
  CreateTagPayload,
  CreateUserBlockPayload,
  ReportThreadPayload,
  ThreadListParams,
  TagListParams,
  AnalyticsParams,
} from "./types";

export const chatQueryKeys = {
  root: ["chat"] as const,
  threads: () => [...chatQueryKeys.root, "threads"] as const,
  threadsList: (params?: ThreadListParams) => [...chatQueryKeys.threads(), "list", params] as const,
  thread: (threadId: string) => [...chatQueryKeys.threads(), "detail", threadId] as const,
  threadMessages: (threadId: string) => [...chatQueryKeys.thread(threadId), "messages"] as const,
  tags: () => [...chatQueryKeys.root, "tags"] as const,
  tagsList: (params?: TagListParams) => [...chatQueryKeys.tags(), "list", params] as const,
  blocks: () => [...chatQueryKeys.root, "blocks"] as const,
  analytics: () => [...chatQueryKeys.root, "analytics"] as const,
  analyticsKpis: (params?: AnalyticsParams) => [...chatQueryKeys.analytics(), "kpis", params] as const,
};

function invalidateChatData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads() });
  queryClient.invalidateQueries({ queryKey: chatQueryKeys.analytics() });
}

// Thread Queries
export function useChatThreads(params?: ThreadListParams) {
  return useQuery({
    queryKey: chatQueryKeys.threadsList(params),
    queryFn: () => getChatThreads(params),
    retry: 1,
    staleTime: 30_000,
  });
}

export function useChatThread(threadId: string) {
  return useQuery({
    queryKey: chatQueryKeys.thread(threadId),
    queryFn: () => getChatThread(threadId),
    enabled: Boolean(threadId),
  });
}

export function useChatThreadMessages(threadId: string) {
  return useQuery({
    queryKey: chatQueryKeys.threadMessages(threadId),
    queryFn: () => getChatThreadMessages(threadId),
    enabled: Boolean(threadId),
  });
}

// Thread Mutations
export function useCreateChatThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateThreadPayload) => createChatThread(payload),
    onSuccess: () => {
      // Aggressive cache invalidation to ensure new threads appear
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads() });
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.analytics() });

      // Also refetch currently active list variants
      queryClient.refetchQueries({
        queryKey: chatQueryKeys.threads(),
      });
    },
  });
}

export function useCreateChatThreadMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      threadId, 
      payload, 
      attachment 
    }: { 
      threadId: string; 
      payload: CreateMessagePayload; 
      attachment?: File;
    }) => createChatThreadMessage(threadId, payload, attachment),
    onSuccess: (message, variables) => {
      // Write the sent message straight into the cache so it renders immediately,
      // instead of relying on the invalidated query's refetch to land in time.
      queryClient.setQueryData<ChatThreadMessage[]>(
        chatQueryKeys.threadMessages(variables.threadId),
        (previous) => {
          const list = Array.isArray(previous) ? previous : [];
          if (list.some((existing) => existing.id === message.id)) return list;
          return [...list, message];
        },
      );
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.threadMessages(variables.threadId) });
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.thread(variables.threadId) });
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads() });
    },
  });
}

export function useAssignChatThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, payload }: { threadId: string; payload: AssignThreadPayload }) =>
      assignChatThread(threadId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.thread(variables.threadId) });
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads() });
    },
  });
}

export function useUpdateChatThreadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, payload }: { threadId: string; payload: UpdateThreadStatusPayload }) =>
      updateChatThreadStatus(threadId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.thread(variables.threadId) });
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.threads() });
    },
  });
}

export function useMarkChatThreadAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => markChatThreadAsRead(threadId),
    onSuccess: (_, threadId) => {
      // Optimistically clear unread count locally to prevent repeated /read calls
      // when server state propagation is slightly delayed.
      queryClient.setQueryData(chatQueryKeys.thread(threadId), (previous: any) => {
        if (!previous || typeof previous !== "object") return previous;
        return {
          ...previous,
          unread_count: 0,
        };
      });
      queryClient.setQueriesData({ queryKey: chatQueryKeys.threads() }, (previous: any) => {
        if (Array.isArray(previous)) {
          return previous.map((item) =>
            item?.id === threadId ? { ...item, unread_count: 0 } : item,
          );
        }
        if (previous && Array.isArray(previous.results)) {
          return {
            ...previous,
            results: previous.results.map((item: any) =>
              item?.id === threadId ? { ...item, unread_count: 0 } : item,
            ),
          };
        }
        if (previous && Array.isArray(previous.data)) {
          return {
            ...previous,
            data: previous.data.map((item: any) =>
              item?.id === threadId ? { ...item, unread_count: 0 } : item,
            ),
          };
        }
        return previous;
      });

      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.threads(),
        refetchType: "inactive",
      });
    },
  });
}

export function useReportChatThread() {
  return useMutation({
    mutationFn: ({ threadId, payload }: { threadId: string; payload: ReportThreadPayload }) =>
      reportChatThread(threadId, payload),
  });
}

// Tag Queries and Mutations
export function useThreadTags(params?: TagListParams) {
  return useQuery({
    queryKey: chatQueryKeys.tagsList(params),
    queryFn: () => getThreadTags(params),
  });
}

export function useCreateThreadTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTagPayload) => createThreadTag(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.tags() });
    },
  });
}

// User Block Queries and Mutations
export function useThreadUserBlocks() {
  return useQuery({
    queryKey: chatQueryKeys.blocks(),
    queryFn: getThreadUserBlocks,
  });
}

export function useCreateThreadUserBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateUserBlockPayload) => createThreadUserBlock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.blocks() });
    },
  });
}

export function useDeleteThreadUserBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (blockId: string) => deleteThreadUserBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatQueryKeys.blocks() });
    },
  });
}

// Analytics
export function useChatAnalytics(params?: AnalyticsParams) {
  return useQuery({
    queryKey: chatQueryKeys.analyticsKpis(params),
    queryFn: () => getChatAnalytics(params),
  });
}

// Admin Actions
export function useRunChatThreadAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runChatThreadAutomation,
    onSuccess: () => {
      invalidateChatData(queryClient);
    },
  });
}
