"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, EditPencil, Group, MapPin, Sparks } from "iconoir-react";
import type {
  HubConversation,
  HubMessage,
  MessageAction,
} from "@/services/hub";
import { HubMessageRow } from "./hub-message";
import { buildHubMentionTargets } from "./hub-mentions";
import { MessageComposer } from "./message-composer";
import { dayKey, formatDayLabel, fullName } from "./hub-utils";

export function ThreadView({
  conversation,
  messages,
  hasMore,
  onLoadOlder,
  loadingOlder,
  typingUsers,
  aiThinking,
  onSend,
  onTyping,
  sending,
  onExecuteAction,
  executingAction,
  onRename,
  onToggleOpsEvents,
  mediaOrigin,
  currentUserId,
  onlineUserIds,
}: {
  conversation: HubConversation;
  messages: HubMessage[];
  hasMore: boolean;
  onLoadOlder: () => void;
  loadingOlder: boolean;
  typingUsers: string[];
  aiThinking: boolean;
  onSend: (input: {
    content: string;
    attachments: File[];
    references: { ref_type: string; object_id: string }[];
  }) => void;
  onTyping: (isTyping: boolean) => void;
  sending: boolean;
  onExecuteAction: (messageId: string, action: MessageAction) => void;
  executingAction: string | null;
  onRename: (title: string) => void;
  onToggleOpsEvents: (enabled: boolean) => void;
  mediaOrigin: string;
  currentUserId: string;
  onlineUserIds: Set<string>;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conversation.display_title);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId, aiThinking]);

  useEffect(() => {
    setTitleDraft(conversation.display_title);
    setEditingTitle(false);
  }, [conversation.id, conversation.display_title]);

  const others = conversation.members.filter((m) => m.user.id !== currentUserId);
  // The assistant is omnipresent: chat/services.py fires it on an @PrepIQ
  // mention in ANY conversation, not only ones it was added to. Gating the
  // autocomplete on includes_assistant hid a mention that worked perfectly
  // well if you typed it out by hand.
  const mentionTargets = useMemo(
    () =>
      buildHubMentionTargets({
        members: conversation.members,
        currentUserId,
      }),
    [conversation.members, currentUserId],
  );

  // "Seen" for my latest message: every other member's read horizon passed it.
  const lastMineSeen = useMemo(() => {
    const mine = [...messages].reverse().find((m) => m.is_me && !m.pending);
    if (!mine || others.length === 0) return false;
    return others.every(
      (m) => m.last_read_at && m.last_read_at >= mine.created_at,
    );
  }, [messages, others]);

  const grouped = useMemo(() => {
    const out: { day: string; items: HubMessage[] }[] = [];
    for (const message of messages) {
      const key = dayKey(message.created_at);
      const last = out[out.length - 1];
      if (last && last.day === key) last.items.push(message);
      else out.push({ day: key, items: [message] });
    }
    return out;
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-surface-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onRename(titleDraft.trim());
                setEditingTitle(false);
              }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                className="rounded-lg border border-border-default bg-surface-3 px-2.5 py-1 text-sm text-text-primary focus:border-brand-gold focus:outline-none"
              />
              <button type="submit" className="text-brand-gold">
                <Check className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              {conversation.conversation_type === "ASSISTANT" ? (
                <Sparks className="h-4 w-4 flex-shrink-0 text-brand-gold" />
              ) : conversation.conversation_type === "GROUP" ? (
                <Group className="h-4 w-4 flex-shrink-0 text-text-muted" />
              ) : null}
              <h2 className="truncate text-base font-semibold text-text-primary">
                {conversation.display_title}
              </h2>
              {conversation.conversation_type !== "DIRECT" ? (
                <button
                  type="button"
                  title="Rename"
                  onClick={() => setEditingTitle(true)}
                  className="text-text-muted transition-colors hover:text-brand-gold"
                >
                  <EditPencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          )}
          <div className="mt-0.5 flex items-center gap-3 text-xs text-text-muted">
            {conversation.branch_name ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {conversation.branch_name}
              </span>
            ) : conversation.is_cross_branch ? (
              <span>Cross-branch</span>
            ) : null}
            {conversation.conversation_type === "DIRECT" && others[0] ? (
              <span>
                {onlineUserIds.has(others[0].user.id) ? (
                  <span className="text-status-success">Online</span>
                ) : (
                  "Offline"
                )}
              </span>
            ) : (
              <span>{conversation.members.length} members</span>
            )}
          </div>
        </div>

        {conversation.conversation_type !== "DIRECT" && conversation.branch_id ? (
          <label className="flex flex-shrink-0 cursor-pointer items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={conversation.ops_events_enabled}
              onChange={(event) => onToggleOpsEvents(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#A8821F]"
            />
            Live ops events
          </label>
        ) : null}

        <div className="flex flex-shrink-0 -space-x-1.5">
          {others.slice(0, 4).map((member) => (
            <span
              key={member.user.id}
              title={fullName(member.user)}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-2 bg-surface-4 text-[10px] font-medium text-text-secondary"
            >
              {member.user.first_name?.[0]}
              {member.user.last_name?.[0]}
            </span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3">
        {hasMore ? (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={onLoadOlder}
              className="rounded-lg border border-border-default px-3 py-1 text-xs text-text-muted transition-colors hover:border-brand-gold hover:text-brand-gold disabled:opacity-50"
            >
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        ) : null}

        {grouped.map((group) => (
          <div key={group.day}>
            <div className="my-3 flex items-center gap-3 px-4">
              <span className="h-px flex-1 bg-surface-4" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                {formatDayLabel(group.items[0].created_at)}
              </span>
              <span className="h-px flex-1 bg-surface-4" />
            </div>
            {group.items.map((message, index) => {
              const previous = group.items[index - 1];
              const showSender =
                !previous ||
                previous.sender_kind === "SYSTEM" ||
                previous.sender?.id !== message.sender?.id ||
                previous.sender_kind !== message.sender_kind;
              return (
                <HubMessageRow
                  key={message.id}
                  message={message}
                  showSender={showSender}
                  mediaOrigin={mediaOrigin}
                  mentionTargets={mentionTargets}
                  onExecuteAction={onExecuteAction}
                  executingAction={executingAction}
                />
              );
            })}
          </div>
        ))}

        {aiThinking ? (
          <div className="flex items-center gap-2.5 px-4 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
              <Sparks className="h-4 w-4" />
            </span>
            <span className="flex gap-1">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-gold"
                  style={{ animationDelay: `${dot * 150}ms` }}
                />
              ))}
            </span>
          </div>
        ) : null}

        {typingUsers.length > 0 ? (
          <p className="px-4 py-1 text-xs italic text-text-muted">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
          </p>
        ) : null}

        {lastMineSeen ? (
          <p className="px-4 pb-1 text-right text-[11px] text-text-disabled">Seen</p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <MessageComposer
        onSend={onSend}
        onTyping={onTyping}
        sending={sending}
        assistantAvailable
        mentionTargets={mentionTargets}
      />
    </div>
  );
}
