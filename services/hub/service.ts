import { apiClient } from "@/lib/api/client";
import type {
  ConversationListResponse,
  DirectoryEntry,
  GlobalSearchResponse,
  HubConversation,
  HubMessage,
  MessagesPage,
  ResolveConversationPayload,
  ShareableObject,
} from "./types";

export async function getWsInfo(): Promise<{ ws_url: string; media_origin: string }> {
  const response = await fetch("/api/realtime", { cache: "no-store" });
  if (!response.ok) throw new Error("Realtime endpoint unavailable");
  return response.json();
}

export async function getWsTicket(): Promise<string> {
  const payload = await apiClient<{ ticket: string }>("/chat/hub/ws-ticket/", {
    method: "POST",
  });
  return payload.ticket;
}

export async function getConversations(): Promise<ConversationListResponse> {
  return apiClient<ConversationListResponse>("/chat/hub/conversations/");
}

export async function resolveConversation(
  payload: ResolveConversationPayload,
): Promise<HubConversation> {
  return apiClient<HubConversation>("/chat/hub/conversations/resolve/", {
    method: "POST",
    body: payload,
  });
}

export async function getConversation(id: string): Promise<HubConversation> {
  return apiClient<HubConversation>(`/chat/hub/conversations/${id}/`);
}

export async function updateConversation(
  id: string,
  patch: Partial<{
    title: string;
    ops_events_enabled: boolean;
    branch_id: string | null;
    archived: boolean;
  }>,
): Promise<HubConversation> {
  return apiClient<HubConversation>(`/chat/hub/conversations/${id}/`, {
    method: "PATCH",
    body: patch,
  });
}

export async function getMessages(
  conversationId: string,
  before?: string,
): Promise<MessagesPage> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiClient<MessagesPage>(
    `/chat/hub/conversations/${conversationId}/messages/${qs}`,
  );
}

export interface SendMessageInput {
  content: string;
  clientId: string;
  replyTo?: string;
  attachments?: File[];
  references?: { ref_type: string; object_id: string }[];
}

export async function sendMessage(
  conversationId: string,
  input: SendMessageInput,
): Promise<HubMessage> {
  const form = new FormData();
  form.append("content", input.content);
  form.append("client_id", input.clientId);
  if (input.replyTo) form.append("reply_to", input.replyTo);
  if (input.references?.length) {
    form.append("references", JSON.stringify(input.references));
  }
  for (const file of input.attachments ?? []) {
    form.append("attachments", file);
  }
  return apiClient<HubMessage>(
    `/chat/hub/conversations/${conversationId}/messages/`,
    { method: "POST", body: form },
  );
}

export async function markRead(conversationId: string): Promise<void> {
  await apiClient(`/chat/hub/conversations/${conversationId}/read/`, {
    method: "POST",
  });
}

export async function executeMessageAction(
  messageId: string,
  actionId: string,
): Promise<{ action_id: string; result: string }> {
  return apiClient(`/chat/hub/messages/${messageId}/actions/`, {
    method: "POST",
    body: { action_id: actionId },
  });
}

export async function searchDirectory(query: string): Promise<DirectoryEntry[]> {
  const payload = await apiClient<{ results: DirectoryEntry[] }>(
    `/chat/hub/directory/?q=${encodeURIComponent(query)}`,
  );
  return payload.results;
}

export async function getShareables(query: string): Promise<ShareableObject[]> {
  const payload = await apiClient<{ results: ShareableObject[] }>(
    `/chat/hub/shareables/?q=${encodeURIComponent(query)}`,
  );
  return payload.results;
}

export async function globalSearch(query: string): Promise<GlobalSearchResponse> {
  return apiClient<GlobalSearchResponse>(
    `/chat/hub/search/?q=${encodeURIComponent(query)}`,
  );
}

export async function openNotificationConversation(
  notificationId: string,
): Promise<HubConversation> {
  return apiClient<HubConversation>(
    `/chat/hub/notifications/${notificationId}/open/`,
    { method: "POST" },
  );
}
