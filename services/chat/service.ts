import { apiClient } from "@/lib/api/client";
import type {
  ChatThread,
  ChatThreadMessage,
  ThreadTag,
  ThreadUserBlock,
  ChatAnalyticsResponse,
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

// Thread Management
export async function getChatThreads(params?: ThreadListParams): Promise<ChatThread[]> {
  const searchParams = new URLSearchParams();
  if (params?.thread_type) searchParams.set("thread_type", params.thread_type);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.tags) searchParams.set("tags", params.tags);
  if (params?.tag_ids) searchParams.set("tag_ids", params.tag_ids);

  const url = `/chat/threads/${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return apiClient<ChatThread[]>(url);
}

export async function getChatThread(threadId: string): Promise<ChatThread> {
  return apiClient<ChatThread>(`/chat/threads/${threadId}/`);
}

export async function createChatThread(payload: CreateThreadPayload): Promise<ChatThread> {
  return apiClient<ChatThread>("/chat/threads/", {
    method: "POST",
    body: payload,
  });
}

// Message Management
export async function getChatThreadMessages(threadId: string): Promise<ChatThreadMessage[]> {
  return apiClient<ChatThreadMessage[]>(`/chat/threads/${threadId}/messages/`);
}

export async function createChatThreadMessage(
  threadId: string,
  payload: CreateMessagePayload,
  attachment?: File
): Promise<ChatThreadMessage> {
  const formData = new FormData();
  formData.append("content", payload.content);
  if (payload.message_type) {
    formData.append("message_type", payload.message_type);
  }
  if (attachment) {
    formData.append("attachment", attachment);
  }

  return apiClient<ChatThreadMessage>(`/chat/threads/${threadId}/messages/`, {
    method: "POST",
    body: formData,
  });
}

// Thread Actions
export async function assignChatThread(
  threadId: string,
  payload: AssignThreadPayload
): Promise<ChatThread> {
  return apiClient<ChatThread>(`/chat/threads/${threadId}/assign/`, {
    method: "POST",
    body: payload,
  });
}

export async function updateChatThreadStatus(
  threadId: string,
  payload: UpdateThreadStatusPayload
): Promise<ChatThread> {
  return apiClient<ChatThread>(`/chat/threads/${threadId}/status/`, {
    method: "POST",
    body: payload,
  });
}

export async function markChatThreadAsRead(threadId: string): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/chat/threads/${threadId}/read/`, {
    method: "POST",
  });
}

export async function reportChatThread(
  threadId: string,
  payload: ReportThreadPayload
): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(`/chat/threads/${threadId}/report/`, {
    method: "POST",
    body: payload,
  });
}

// Tag Management
export async function getThreadTags(params?: TagListParams): Promise<ThreadTag[]> {
  const searchParams = new URLSearchParams();
  if (params?.business) searchParams.set("business", params.business);

  const url = `/chat/thread-tags/${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return apiClient<ThreadTag[]>(url);
}

export async function createThreadTag(payload: CreateTagPayload): Promise<ThreadTag> {
  return apiClient<ThreadTag>("/chat/thread-tags/", {
    method: "POST",
    body: payload,
  });
}

// User Block Management
export async function getThreadUserBlocks(): Promise<ThreadUserBlock[]> {
  return apiClient<ThreadUserBlock[]>("/chat/threads/blocks/");
}

export async function createThreadUserBlock(payload: CreateUserBlockPayload): Promise<ThreadUserBlock> {
  return apiClient<ThreadUserBlock>("/chat/threads/blocks/", {
    method: "POST",
    body: payload,
  });
}

export async function deleteThreadUserBlock(blockId: string): Promise<void> {
  return apiClient<void>(`/chat/threads/blocks/${blockId}/`, {
    method: "DELETE",
  });
}

// Analytics
export async function getChatAnalytics(params?: AnalyticsParams): Promise<ChatAnalyticsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.days) searchParams.set("days", params.days.toString());

  const url = `/chat/analytics/kpis/${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return apiClient<ChatAnalyticsResponse>(url);
}

// Admin Actions
export async function runChatThreadAutomation(): Promise<{
  archived_retention: number;
  escalated: number;
}> {
  return apiClient<{
    archived_retention: number;
    escalated: number;
  }>("/chat/threads/automation/run/", {
    method: "POST",
  });
}