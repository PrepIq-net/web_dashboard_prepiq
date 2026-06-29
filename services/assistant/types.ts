export type AssistantPhase = "MORNING" | "LIVE" | "CLOSED";

export type AssistantActionType =
  | "set_planned_quantity"
  | "mark_unavailable"
  | "prepare_extra";

export type PendingAction = {
  type: AssistantActionType;
  branch_id: string;
  date: string;
  item_id: string;
  item_title: string;
  quantity: number | null;
  summary: string;
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
  summary: string;
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
