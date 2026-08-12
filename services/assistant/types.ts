export type AssistantPhase = "MORNING" | "LIVE" | "CLOSED";

// Mirrors ai_assistant/actions.py ALL_ACTIONS.
export type AssistantActionType =
  | "set_planned_quantity"
  | "mark_unavailable"
  | "prepare_extra"
  | "log_waste"
  | "record_sale"
  | "lock_plan"
  | "start_service"
  | "close_day"
  | "update_day_notes"
  | "attribute_remaining"
  | "assign_kitchen_task"
  | "publish_task_list"
  | "publish_schedule"
  | "generate_schedule"
  | "adjust_recipe_line"
  | "generate_recipe"
  | "resolve_recipe_image"
  | "copy_recipe_to_branches"
  | "update_prep_steps"
  | "update_menu_item"
  | "create_menu_item"
  | "set_menu_item_image_url"
  | "log_ingredient_waste"
  | "record_stock_count"
  | "set_dish_yield";

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

/**
 * A write the assistant already applied on its own during a turn. Routine
 * changes (prep quantities, waste, sales, notes, tasks, recipes generation)
 * execute server-side the moment the assistant decides on them; only the
 * irreversible ones listed in actions.CONFIRM_REQUIRED_ACTIONS still arrive as
 * a `pending_action`.
 *
 * This is a record of what happened, not a question — never render it with
 * confirm/dismiss affordances. Its job is to tell the host page that data it is
 * showing just changed underneath it.
 */
export type AppliedAction = {
  type: AssistantActionType;
  item_title: string | null;
  quantity: number | null;
  summary: string;
  action_log_id: string;
};

export type AssistantRole = "user" | "assistant" | "tool" | "system";

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  pending_action: PendingAction | null;
  applied_actions: AppliedAction[] | null;
  /**
   * Open-ended annotations on a turn, discriminated by `kind`. Currently only
   * `morning_brief_audio`, which marks a turn as a spoken brief the player can
   * reopen and replay. Unknown kinds must render as a plain message.
   */
  metadata: AssistantMessageMetadata | null;
  created_at: string;
};

export type AssistantMessageMetadata =
  | {
      kind: "morning_brief_audio";
      audio_id: string;
      target_date: string;
      duration_ms: number | null;
    }
  | { kind: string; [key: string]: unknown };

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
  action_log_id?: string | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Command palette (POST /assistant/command/) — mirrors
// backend/ai_assistant/command/schemas.py. Exactly one payload field is
// populated per response `type`.
// ─────────────────────────────────────────────────────────────────────────────

export type CommandRequestPayload = {
  text: string;
  branch_id?: string;
  date?: string;
};

export type CommandResponseType =
  | "NAVIGATION"
  | "QUERY"
  | "MUTATION_PROPOSAL"
  | "ANSWER"
  | "ERROR";

export type CommandErrorCode =
  | "no_branch"
  | "forbidden"
  | "llm_unavailable"
  | "disabled"
  | "invalid";

// Aligned with the Hub's ReferenceStat tone union for later renderer sharing.
export type CommandCardTone = "neutral" | "ok" | "warning" | "danger";

export type CommandCardStat = {
  label: string;
  value: string;
  tone: CommandCardTone;
};

export type CommandCard = {
  ref_type: string;
  title: string;
  subtitle: string;
  stats: CommandCardStat[];
  rows: CommandCardStat[];
  deep_link: string;
  footnote: string;
};

export type CommandNavigation = {
  page_id: string;
  path: string;
  params: Record<string, string>;
};

export type CommandProposal = {
  conversation_id: string;
  message_id: string;
  action_log_id: string | null;
  pending_action: PendingAction;
  summary: string;
  destructive: boolean;
};

export type CommandResponse = {
  type: CommandResponseType;
  query: string;
  navigation?: CommandNavigation;
  card?: CommandCard;
  source_tool?: string;
  proposal?: CommandProposal;
  answer?: string;
  error?: { code: CommandErrorCode; detail: string };
};

/* ── Recipe review ("Ask AI to review this recipe") ───────────────────────── */

/** "image" skips the recipe-quantity checks — the standalone "regenerate
 * photo" shortcut on the recipe editor. */
export type RecipeReviewScope = "full" | "image";

export type RecipeReviewPayload = {
  branch_id: string;
  menu_item_id: string;
  scope?: RecipeReviewScope;
};

export type RecipeReviewResponse = {
  conversation_id: string;
  /** One card per finding — each independently confirmable, same
   * PendingAction/confirm-endpoint shape a chat or command proposal uses. */
  proposals: CommandProposal[];
  /** Present (with no proposals) when the recipe looked sound. */
  message?: string;
  message_id?: string;
};

/* ── Spoken morning brief ("Today's Brief") ───────────────────────────────── */

export type BriefSectionKey =
  | "greeting"
  | "context"
  | "prep"
  | "supply"
  | "signoff";

export type BriefScriptSection = {
  /** Backend may add sections; treat unknown keys as renderable prose. */
  key: BriefSectionKey | (string & {});
  text: string;
  start_ms: number;
  end_ms: number;
};

export type BriefAudioTrack = {
  url: string;
  mime_type: string;
  duration_ms: number | null;
  voice: string;
  provider: string;
  expires_at: string | null;
};

export type MorningBriefVoiceStatus = "PENDING" | "READY" | "FAILED" | "PURGED";

export type MorningBriefVoice = {
  id: string;
  branch_id: string;
  target_date: string;
  status: MorningBriefVoiceStatus;
  locale: string;
  generated_by: string;
  script: {
    text: string;
    sections: BriefScriptSection[];
    /**
     * True when section offsets were apportioned by character count rather
     * than reported by the speech engine. The player rescales them against the
     * real audio duration before using them to highlight.
     */
    timings_estimated: boolean;
  };
  /** Null whenever synthesis was unavailable — the transcript still renders. */
  audio: BriefAudioTrack | null;
  unavailable_reason: string;
  conversation_id: string | null;
  message_id: string | null;
  created_at: string;
};

export type MorningBriefVoicePayload = {
  branch_id: string;
  date?: string;
};
