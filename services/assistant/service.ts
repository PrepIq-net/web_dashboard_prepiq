import { apiClient } from "@/lib/api/client";
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantReply,
  CommandRequestPayload,
  CommandResponse,
  ConfirmActionPayload,
  ConfirmActionResponse,
  ConversationDetail,
  CurrentConversationResponse,
  EmptyConversationReply,
  ExplainPayload,
  SendMessagePayload,
  StartConversationPayload,
  SuggestedQuestionsResponse,
} from "./types";

const BASE = "/assistant";

export async function listAssistantConversations(params?: {
  branch_id?: string;
  date?: string;
}): Promise<AssistantConversation[]> {
  const search = new URLSearchParams();
  if (params?.branch_id) search.set("branch_id", params.branch_id);
  if (params?.date) search.set("date", params.date);
  const query = search.toString();
  return apiClient<AssistantConversation[]>(
    `${BASE}/conversations/${query ? `?${query}` : ""}`,
  );
}

export async function getCurrentConversation(params: {
  branch_id: string;
  date?: string;
}): Promise<CurrentConversationResponse> {
  const search = new URLSearchParams();
  search.set("branch_id", params.branch_id);
  if (params.date) search.set("date", params.date);
  return apiClient<CurrentConversationResponse>(
    `${BASE}/conversations/current/?${search.toString()}`,
  );
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
): Promise<ConfirmActionResponse> {
  return apiClient<ConfirmActionResponse>(
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

export async function runAssistantCommand(
  payload: CommandRequestPayload,
): Promise<CommandResponse> {
  return apiClient<CommandResponse>(`${BASE}/command/`, {
    method: "POST",
    body: payload,
  });
}
