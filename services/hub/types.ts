export type ConversationType = "DIRECT" | "GROUP" | "ASSISTANT";
export type SenderKind = "USER" | "ASSISTANT" | "SYSTEM";
export type HubMessageType = "TEXT" | "FILE" | "REFERENCE" | "EVENT" | "ACTION";
export type AttachmentKind =
  | "IMAGE" | "VIDEO" | "AUDIO" | "PDF" | "SPREADSHEET"
  | "CSV" | "DOC" | "TEXT" | "OTHER";
export type AttachmentStatus = "PENDING" | "READY" | "FAILED" | "UNSUPPORTED";
export type RefType =
  | "FORECAST" | "RECOMMENDATION" | "RISK" | "INGREDIENT" | "MENU_ITEM"
  | "PREP_BATCH" | "PREP_ITEM" | "WASTE_EVENT" | "CALENDAR_EVENT" | "NOTIFICATION"
  | "SCHEDULE" | "AVAILABILITY";

export interface HubUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface HubAttachment {
  id: string;
  file_url: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  kind: AttachmentKind;
  status: AttachmentStatus;
  preview: {
    table?: { columns: string[]; rows: string[][]; total_rows: number };
    page_count?: number;
    width?: number;
    height?: number;
    needs_ocr?: boolean;
    playable?: boolean;
  };
}

export interface ReferenceStat {
  label: string;
  value: string;
  tone: "neutral" | "ok" | "warning" | "danger";
}

export interface HubReference {
  id: string;
  ref_type: RefType;
  object_id: string;
  title: string;
  subtitle: string;
  stats: ReferenceStat[];
  deep_link: string;
  branch_id: string | null;
}

export interface MessageAction {
  id: string;
  label: string;
  style: "primary" | "secondary";
  action_type: "NOTIFY_TEAM" | "INCREASE_PREP" | "ACKNOWLEDGE" | "OPEN_LINK";
  params: Record<string, string>;
}

export interface HubMessage {
  id: string;
  conversation_id: string;
  sender: HubUser | null;
  sender_kind: SenderKind;
  message_type: HubMessageType;
  content: string;
  metadata: {
    event_type?: string;
    event_payload?: Record<string, unknown>;
    actions?: MessageAction[];
    actions_state?: Record<string, { executed_by_name: string; executed_at: string }>;
    ai?: { provider: string; model: string };
    [key: string]: unknown;
  };
  reply_to: { id: string; sender: HubUser | null; content: string } | null;
  client_id: string;
  attachments: HubAttachment[];
  references: HubReference[];
  is_me: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  /** Local-only flag while an optimistic send is in flight. */
  pending?: boolean;
}

export interface ConversationMemberInfo {
  user: HubUser;
  joined_at: string;
  last_read_at: string | null;
}

export interface HubConversation {
  id: string;
  organization_id: string;
  conversation_type: ConversationType;
  title: string;
  title_is_auto: boolean;
  display_title: string;
  includes_assistant: boolean;
  branch_id: string | null;
  branch_name: string | null;
  is_cross_branch: boolean;
  ops_events_enabled: boolean;
  members: ConversationMemberInfo[];
  last_message: {
    id: string;
    content: string;
    message_type: HubMessageType;
    sender_kind: SenderKind;
    sender_name: string;
    created_at: string;
    is_me: boolean;
  } | null;
  unread_count: number;
  last_message_at: string | null;
  archived_at: string | null;
  created_at: string;
  created?: boolean;
  branch_candidates?: string[];
}

export interface ConversationListResponse {
  results: HubConversation[];
  online: Record<string, string[]>;
}

export interface MessagesPage {
  results: HubMessage[];
  has_more: boolean;
}

export interface DirectoryEntry {
  user: HubUser;
  organization_id: string;
  organization_name: string;
  branches: string[];
  online: boolean;
}

export interface ShareableObject {
  ref_type: RefType;
  object_id: string;
  title: string;
  subtitle: string;
  deep_link: string;
}

export interface GlobalSearchResponse {
  query: string;
  messages: {
    message_id: string;
    conversation_id: string;
    conversation_title: string;
    sender_name: string;
    snippet: string;
    created_at: string;
  }[];
  attachments: {
    attachment_id: string;
    conversation_id: string;
    message_id: string;
    original_name: string;
    kind: AttachmentKind;
    snippet: string;
    created_at: string;
  }[];
  references: {
    reference_id: string;
    conversation_id: string;
    ref_type: RefType;
    title: string;
    subtitle: string;
    deep_link: string;
    created_at: string;
  }[];
  conversations: {
    conversation_id: string;
    conversation_type: ConversationType;
    display_title: string;
  }[];
  people: {
    user: HubUser;
    organization_id: string;
    organization_name: string;
  }[];
  objects: ShareableObject[];
}

export interface HubNotification {
  id: string;
  title: string;
  body: string;
  code: string;
  domain: string;
  escalation_level: string;
  status: string;
  recommended_action: string;
  organization_id: string | null;
  branch_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ResolveConversationPayload {
  participant_ids: string[];
  include_assistant?: boolean;
  branch_id?: string | null;
  title?: string;
  organization_id?: string;
}

/** Server → client WebSocket frames. */
export type HubSocketEvent =
  | { event: "connected"; payload: { user_id: string; online: Record<string, string[]> } }
  | { event: "message.new"; payload: HubMessage }
  | { event: "message.updated"; payload: HubMessage }
  | { event: "conversation.new"; payload: HubConversation }
  | { event: "conversation.updated"; payload: { conversation_id: string; title?: string } }
  | { event: "typing"; payload: { conversation_id: string; user_id: string; user_name: string; is_typing: boolean } }
  | { event: "presence"; payload: { organization_id: string; user_id: string; online: boolean } }
  | { event: "read"; payload: { conversation_id: string; user_id: string; last_read_at: string } }
  | { event: "notification.new"; payload: HubNotification }
  | { event: "ai.thinking"; payload: { conversation_id: string } }
  | { event: "subscribed"; payload: { conversation_id: string } }
  | { event: "pong"; payload: Record<string, never> }
  | { event: "error"; payload: { detail: string; conversation_id?: string } }
  // Task board signals (backend/execution/realtime.py). Identifier-only
  // payloads: listeners refetch the board via REST, where permissions live.
  | {
      event: "execution.board_changed";
      payload: {
        branch_id: string;
        date: string;
        action: string;
        task_id: string | null;
        actor_id: string | null;
      };
    }
  | {
      event: "execution.tasks_generated";
      payload: { branch_id: string; date: string; count: number; generated_by: string };
    };
