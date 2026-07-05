"use client";

import { useConversationDetail } from "@/services/assistant/hooks";
import type { AssistantConversation } from "@/services/assistant/types";
import { AssistantDrawer } from "./assistant-drawer";
import { AssistantMessageBubble } from "./assistant-message";

const PHASE_LABEL: Record<string, string> = {
  MORNING: "Morning planning",
  LIVE: "Live service",
  CLOSED: "End of day",
};

// Read-only transcript of a past conversation, opened from the planning-day
// archive. No input and no pending-action controls — the thread cannot be
// continued or changed, only reviewed.
export function ConversationReadonly({
  conversation,
  onClose,
}: {
  conversation: AssistantConversation | null;
  onClose: () => void;
}) {
  const detail = useConversationDetail(conversation?.id, Boolean(conversation));
  const messages = detail.data?.messages ?? [];

  return (
    <AssistantDrawer
      open={Boolean(conversation)}
      onClose={onClose}
      title="Conversation"
      subtitle={conversation ? PHASE_LABEL[conversation.phase] ?? "" : ""}
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
        {detail.isLoading ? (
          <p className="text-sm text-text-muted">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-text-muted">This conversation has no messages.</p>
        ) : (
          messages.map((message) => (
            <AssistantMessageBubble key={message.id} message={message} />
          ))
        )}
      </div>
      <p className="border-t border-surface-4 px-4 py-2 text-center text-[11px] text-text-disabled">
        Read-only · past conversations can be reviewed but not continued
      </p>
    </AssistantDrawer>
  );
}
