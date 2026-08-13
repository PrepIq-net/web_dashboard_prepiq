"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmAssistantAction,
  explainAlert,
  generateMorningBriefVoice,
  getAssistantConversation,
  getCurrentConversation,
  getMorningBriefVoice,
  getSuggestedQuestions,
  listAssistantConversations,
  runAssistantCommand,
  runRecipeReview,
  sendAssistantMessage,
  startAssistantConversation,
} from "./service";
import type {
  CommandRequestPayload,
  ConfirmActionPayload,
  ExplainPayload,
  MorningBriefVoicePayload,
  RecipeReviewPayload,
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
      queryClient.invalidateQueries({ queryKey: assistantQueryKeys.root });
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
      queryClient.invalidateQueries({ queryKey: assistantQueryKeys.root });
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

// One-shot command-palette router. Reads/navigation touch nothing cached;
// mutations only propose (the confirm step invalidates what it changes).
export function useRunAssistantCommand() {
  return useMutation({
    mutationFn: (payload: CommandRequestPayload) => runAssistantCommand(payload),
  });
}

// Diagnoses one recipe/image and returns proposals — nothing is applied
// here, same "only the confirm step changes anything" contract as the
// command palette above.
export function useRunRecipeReview() {
  return useMutation({
    mutationFn: (payload: RecipeReviewPayload) => runRecipeReview(payload),
  });
}

/**
 * Fetch the spoken brief for a branch-day.
 *
 * A mutation rather than a query because it is an action with side effects:
 * it can trigger synthesis, and it records the brief in the day's chat thread.
 * Firing it on render would put a brief in the transcript nobody asked for.
 */
export function useMorningBriefVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MorningBriefVoicePayload) => generateMorningBriefVoice(payload),
    onSuccess: (data) => {
      // The thread now holds a message it did not a moment ago.
      if (data.conversation_id) {
        queryClient.invalidateQueries({ queryKey: conversationsPrefix });
        queryClient.invalidateQueries({
          queryKey: assistantQueryKeys.conversationDetail(data.conversation_id),
        });
      }
    },
  });
}

/** Replay a specific brief by id, as linked from a chat message. */
export function useReplayMorningBriefVoice() {
  return useMutation({
    mutationFn: (id: string) => getMorningBriefVoice(id),
  });
}
