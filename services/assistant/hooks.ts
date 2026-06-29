"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmAssistantAction,
  explainAlert,
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
  conversations: () => [...assistantQueryKeys.root, "conversations"] as const,
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

export function useAssistantConversations() {
  return useQuery({
    queryKey: assistantQueryKeys.conversations(),
    queryFn: listAssistantConversations,
    staleTime: 30_000,
  });
}

export function useStartAssistantConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StartConversationPayload) => startAssistantConversation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantQueryKeys.conversations() });
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
      queryClient.invalidateQueries({ queryKey: assistantQueryKeys.conversations() });
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
      queryClient.invalidateQueries({ queryKey: assistantQueryKeys.conversations() });
    },
  });
}
