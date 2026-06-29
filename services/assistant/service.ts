import { apiClient } from "@/lib/api/client";
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantReply,
  ConfirmActionPayload,
  ConversationDetail,
  EmptyConversationReply,
  ExplainPayload,
  SendMessagePayload,
  StartConversationPayload,
  SuggestedQuestionsResponse,
} from "./types";

const BASE = "/assistant";

export async function listAssistantConversations(): Promise<AssistantConversation[]> {
  return apiClient<AssistantConversation[]>(`${BASE}/conversations/`);
}

export async function getAssistantConversation(
  conversationId: string,
): Promise<ConversationDetail> {
  return apiClient<ConversationDetail>(`${BASE}/conversations/${conversationId}/`);
}

export async function startAssistantConversation(
  payload: StartConversationPayload,
): Promise<AssistantReply | EmptyConversationReply> {
  return apiClient<AssistantReply | EmptyConversationReply>(`${BASE}/conversations/`, {
    method: "POST",
    body: payload,
  });
}

export async function sendAssistantMessage(
  conversationId: string,
  payload: SendMessagePayload,
): Promise<AssistantReply> {
  return apiClient<AssistantReply>(`${BASE}/conversations/${conversationId}/messages/`, {
    method: "POST",
    body: payload,
  });
}

export async function confirmAssistantAction(
  conversationId: string,
  payload: ConfirmActionPayload,
): Promise<AssistantMessage> {
  return apiClient<AssistantMessage>(
    `${BASE}/conversations/${conversationId}/actions/confirm/`,
    { method: "POST", body: payload },
  );
}

export async function getSuggestedQuestions(params: {
  branch_id: string;
  date?: string;
}): Promise<SuggestedQuestionsResponse> {
  const search = new URLSearchParams();
  search.set("branch_id", params.branch_id);
  if (params.date) search.set("date", params.date);
  return apiClient<SuggestedQuestionsResponse>(
    `${BASE}/suggested-questions/?${search.toString()}`,
  );
}

export async function explainAlert(payload: ExplainPayload): Promise<AssistantReply> {
  return apiClient<AssistantReply>(`${BASE}/explain/`, {
    method: "POST",
    body: payload,
  });
}
