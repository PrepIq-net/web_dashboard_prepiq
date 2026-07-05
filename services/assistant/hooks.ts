"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmAssistantAction,
  explainAlert,
  getAssistantConversation,
  getCurrentConversation,
  getSuggestedQuestions,
  listAssistantConversations,
  sendAssistantMessage,
  startAssistantConversation,
} from "./service";
import type {
  ConfirmActionPayload,
  ExplainPayload,
  SendMessagePayload,
  StartConversationPayload,
} from "./types";

export const assistantQueryKeys = {
  root: ["assistant"] as const,
  conversations: (branchId?: string, date?: string) =>
    [...assistantQueryKeys.root, "conversations", branchId, date] as const,
  conversationDetail: (id?: string) =>
    [...assistantQueryKeys.root, "conversation", id] as const,
  currentConversation: (branchId?: string, date?: string) =>
    [...assistantQueryKeys.root, "current-conversation", branchId, date] as const,
  suggestedQuestions: (branchId?: string, date?: string) =>
    [...assistantQueryKeys.root, "suggested-questions", branchId, date] as const,
};

export function useSuggestedQuestions(branchId?: string, date?: string) {
  return useQuery({
    queryKey: assistantQueryKeys.suggestedQuestions(branchId, date),
    queryFn: () => getSuggestedQuestions({ branch_id: branchId as string, date }),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });
}

// Prefix used to invalidate every conversation-list query regardless of scope.
const conversationsPrefix = [...assistantQueryKeys.root, "conversations"] as const;

export function useAssistantConversations(params?: { branchId?: string; date?: string }) {
  return useQuery({
    queryKey: assistantQueryKeys.conversations(params?.branchId, params?.date),
    queryFn: () =>
      listAssistantConversations({ branch_id: params?.branchId, date: params?.date }),
    staleTime: 30_000,
  });
}

export function useCurrentConversation(branchId?: string, date?: string) {
  return useQuery({
    queryKey: assistantQueryKeys.currentConversation(branchId, date),
    queryFn: () => getCurrentConversation({ branch_id: branchId as string, date }),
    enabled: Boolean(branchId),
    staleTime: 30_000,
  });
}

export function useConversationDetail(id?: string, enabled = true) {
  return useQuery({
    queryKey: assistantQueryKeys.conversationDetail(id),
    queryFn: () => getAssistantConversation(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
  });
}

export function useStartAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartConversationPayload) => startAssistantConversation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsPrefix });
    },
  });
}

export function useSendAssistantMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      payload,
    }: {
      conversationId: string;
      payload: SendMessagePayload;
    }) => sendAssistantMessage(conversationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsPrefix });
    },
  });
}

export function useConfirmAssistantAction() {
  return useMutation({
    mutationFn: ({
      conversationId,
      payload,
    }: {
      conversationId: string;
      payload: ConfirmActionPayload;
    }) => confirmAssistantAction(conversationId, payload),
  });
}

export function useExplainAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExplainPayload) => explainAlert(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsPrefix });
    },
  });
}
