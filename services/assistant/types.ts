export type AssistantPhase = "MORNING" | "LIVE" | "CLOSED";

export type AssistantActionType =
  | "set_planned_quantity"
  | "mark_unavailable"
  | "prepare_extra"
  | "log_waste"
  | "record_sale"
  | "lock_plan"
  | "start_service"
  | "close_day"
  | "update_day_notes";

export type PendingAction = {
  type: AssistantActionType;
  branch_id: string;
  date: string;
  item_id: string | null;
  item_title: string | null;
  quantity: number | null;
  summary: string;
  destructive?: boolean;
  waste_reason?: string | null;
  notes?: string;
};

export type AssistantRole = "user" | "assistant" | "tool" | "system";

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  pending_action: PendingAction | null;
  created_at: string;
};

export type AssistantConversation = {
  id: string;
  title: string;
  phase: AssistantPhase;
  branch: string | null;
  branch_name: string | null;
  service_date: string | null;
  last_message: string;
  created_at: string;
  updated_at: string;
};

export type StartConversationPayload = {
  branch_id: string;
  date?: string;
  message?: string;
};

export type SendMessagePayload = {
  message: string;
  date?: string;
};

export type ExplainPayload = {
  branch_id: string;
  date?: string;
  topic: string;
};

export type ConfirmActionPayload = {
  applied: boolean;
  message_id?: string;
};

// Confirmed actions are executed server-side; this reports what happened.
export type ConfirmActionResponse = {
  applied: boolean;
  status: "APPLIED" | "DECLINED" | "FAILED" | "NOT_FOUND";
  summary: string;
  message: AssistantMessage;
};

export type AssistantReply = {
  conversation: AssistantConversation;
  message: AssistantMessage;
};

export type EmptyConversationReply = {
  conversation: AssistantConversation;
  greeting: string;
  suggested_questions: string[];
};

export type SuggestedQuestionsResponse = {
  phase: AssistantPhase;
  greeting: string;
  suggested_questions: string[];
};

export type ConversationDetail = {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
};

// Resolves the current day's thread for rehydration. When no thread exists yet,
// `conversation` is null and greeting/suggested_questions seed a fresh session.
export type CurrentConversationResponse = {
  conversation: AssistantConversation | null;
  messages: AssistantMessage[];
  greeting?: string;
  suggested_questions?: string[];
};
