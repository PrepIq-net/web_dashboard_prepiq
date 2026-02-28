export type ThreadType = "INTERNAL" | "ORG_OPS";

export type ThreadStatus = 
  | "ACTIVE" | "ARCHIVED" | "CLOSED";

export type MessageType = "TEXT" | "ATTACHMENT" | "SYSTEM";

export type ParticipantType = "BUSINESS_MEMBER" | "END_USER";

export type ParticipantRole = 
  | "BUSINESS_OWNER" | "BUSINESS_ADMIN" | "BUSINESS_MANAGER" 
  | "BUSINESS_STAFF" | "END_USER";

export type ThreadPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type AIRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type EventType = 
  | "ASSIGNED" | "STATUS_CHANGED" | "READ" | "ESCALATED" 
  | "AUTO_ARCHIVED" | "REPORTED";

export interface SimpleUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture?: string;
  organization_name?: string;
}

export interface ChatParticipant {
  id: string;
  user: SimpleUser;
  participant_type: ParticipantType;
  role: ParticipantRole;
  joined_at: string;
}

export interface ChatThreadMessage {
  id: string;
  thread: string;
  sender: SimpleUser;
  sender_role: ParticipantRole;
  message_type: MessageType;
  content: string;
  metadata: Record<string, any>;
  file?: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  is_me: boolean;
}

export interface ThreadAssignment {
  id: string;
  assigned_to: SimpleUser;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThreadEventLog {
  id: string;
  event_type: EventType;
  actor: SimpleUser;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ThreadTag {
  id: string;
  name: string;
  slug: string;
}

export interface BusinessInfo {
  id: string;
  name: string;
  logo?: string;
}

export interface LastMessage {
  content: string;
  created_at: string;
  sender_name: string;
  message_type: MessageType;
  file?: string;
  is_me: boolean;
  is_encrypted: boolean;
}

export interface ChatThread {
  id: string;
  thread_type: ThreadType;
  business: BusinessInfo;
  related_claim_reference_id?: string;
  related_batch_id?: string;
  branch?: string;
  department?: string;
  created_by?: string;
  status: ThreadStatus;
  assigned_to?: SimpleUser;
  priority: ThreadPriority;
  category: string;
  tags: ThreadTag[];
  visibility_scope: Record<string, any>;
  archived_at?: string;
  last_message_at?: string;
  escalation_level: number;
  escalated_at?: string;
  first_response_at?: string;
  resolved_at?: string;
  sla_breached_at?: string;
  ai_summary: string;
  ai_risk_level: AIRiskLevel;
  ai_action_items: string[];
  ai_summary_updated_at?: string;
  created_at: string;
  updated_at: string;
  messages: ChatThreadMessage[];
  assignments: ThreadAssignment[];
  events: ThreadEventLog[];
  participants: ChatParticipant[];
  unread_count: number;
  display_title: string;
  last_message?: LastMessage;
  customer_name: string;
}

export interface ThreadUserBlock {
  id: string;
  user: string;
  user_details: SimpleUser;
  reason: string;
  created_at: string;
}

// Request/Response Types
export interface CreateThreadPayload {
  thread_type: ThreadType;
  business: string;
  related_claim_reference_id?: string;
  related_batch_id?: string;
  branch?: string;
  department?: string;
  status?: ThreadStatus;
  priority?: ThreadPriority;
  category?: string;
  tag_ids?: string[];
  visibility_scope?: Record<string, any>;
  initial_message?: string;
  participant_ids?: string[];
}

export interface CreateMessagePayload {
  content: string;
  message_type?: MessageType;
}

export interface AssignThreadPayload {
  assignee_id: string;
}

export interface UpdateThreadStatusPayload {
  status: ThreadStatus;
}

export interface CreateTagPayload {
  business: string;
  name: string;
}

export interface CreateUserBlockPayload {
  business: string;
  user: string;
  reason?: string;
}

export interface ReportThreadPayload {
  reason: string;
  report_type: "ABUSE" | "SPAM" | "HARASSMENT" | "OTHER";
}

export interface ChatAnalyticsKPIs {
  total_threads: number;
  active_threads: number;
  avg_response_time_hours: number;
  resolution_rate_pct: number;
  escalation_rate_pct: number;
  customer_satisfaction_score?: number;
}

export interface ChatAnalyticsImpact {
  completion_rate_improvement_pct: number;
  avg_resolution_time_reduction_hours: number;
}

export interface ChatAnalyticsResponse {
  kpis: ChatAnalyticsKPIs;
  impact: ChatAnalyticsImpact;
  period: {
    start: string;
    end: string;
  };
}

// Query Parameters
export interface ThreadListParams {
  thread_type?: ThreadType;
  status?: ThreadStatus;
  tags?: string;
  tag_ids?: string;
}

export interface TagListParams {
  business?: string;
}

export interface AnalyticsParams {
  days?: number;
}
