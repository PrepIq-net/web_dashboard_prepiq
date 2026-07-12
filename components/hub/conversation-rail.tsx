"use client";

import { Bell, ChatBubble, Group, Plus, Search, Sparks } from "iconoir-react";
import type { HubConversation, HubNotification } from "@/services/hub";
import { formatTime, initials } from "./hub-utils";

function typeIcon(conversation: HubConversation) {
  if (conversation.conversation_type === "ASSISTANT")
    return <Sparks className="h-4 w-4 text-brand-gold" />;
  if (conversation.conversation_type === "GROUP")
    return <Group className="h-4 w-4 text-text-muted" />;
  return null;
}

export function ConversationRail({
  conversations,
  alerts,
  activeTab,
  onTabChange,
  activeConversationId,
  onSelectConversation,
  onOpenAlert,
  onNewChat,
  onOpenSearch,
  onlineUserIds,
  currentUserId,
  isLoading,
}: {
  conversations: HubConversation[];
  alerts: HubNotification[];
  activeTab: "conversations" | "alerts";
  onTabChange: (tab: "conversations" | "alerts") => void;
  activeConversationId: string | null;
  onSelectConversation: (conversation: HubConversation) => void;
  onOpenAlert: (alert: HubNotification) => void;
  onNewChat: () => void;
  onOpenSearch: () => void;
  onlineUserIds: Set<string>;
  currentUserId: string;
  isLoading: boolean;
}) {
  const unreadAlerts = alerts.filter((a) => a.status === "UNREAD").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border-default bg-surface-3 px-3 text-sm text-text-disabled transition-colors hover:border-brand-gold"
        >
          <Search className="h-4 w-4" />
          Search everything…
        </button>
        <button
          type="button"
          title="New conversation"
          onClick={onNewChat}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gold text-surface-1 transition-colors hover:bg-brand-gold-hover"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="flex gap-1 px-3 pb-2">
        <button
          type="button"
          onClick={() => onTabChange("conversations")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "conversations"
              ? "bg-surface-4 text-text-primary"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <ChatBubble className="h-3.5 w-3.5" />
          Conversations
        </button>
        <button
          type="button"
          onClick={() => onTabChange("alerts")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === "alerts"
              ? "bg-surface-4 text-text-primary"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
          Alerts
          {unreadAlerts > 0 ? (
            <span className="rounded-full bg-status-critical px-1.5 text-[10px] font-semibold text-white">
              {unreadAlerts}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "conversations" ? (
          isLoading ? (
            <div className="space-y-2 p-3">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-lg bg-surface-3" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              No conversations yet. Start one with{" "}
              <span className="text-brand-gold">+</span>.
            </p>
          ) : (
            conversations.map((conversation) => {
              const others = conversation.members.filter(
                (m) => m.user.id !== currentUserId,
              );
              const other = others[0]?.user ?? null;
              const otherOnline =
                conversation.conversation_type === "DIRECT" && other
                  ? onlineUserIds.has(other.id)
                  : false;
              const active = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-surface-3" : "hover:bg-surface-3/60"
                  }`}
                >
                  <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-4 text-xs font-medium text-text-secondary">
                    {conversation.conversation_type === "ASSISTANT" ? (
                      <Sparks className="h-4 w-4 text-brand-gold" />
                    ) : conversation.conversation_type === "GROUP" ? (
                      <Group className="h-4 w-4" />
                    ) : (
                      initials(other)
                    )}
                    {otherOnline ? (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-2 bg-status-success" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {conversation.display_title}
                        </span>
                        {conversation.conversation_type !== "DIRECT"
                          ? typeIcon(conversation)
                          : null}
                      </span>
                      {conversation.last_message ? (
                        <span className="flex-shrink-0 text-[11px] text-text-disabled">
                          {formatTime(conversation.last_message.created_at)}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-text-muted">
                        {conversation.last_message
                          ? `${
                              conversation.last_message.is_me
                                ? "You"
                                : conversation.last_message.sender_name.split(" ")[0]
                            }: ${conversation.last_message.content}`
                          : conversation.branch_name ?? "No messages yet"}
                      </span>
                      {conversation.unread_count > 0 ? (
                        <span className="flex-shrink-0 rounded-full bg-brand-gold px-1.5 text-[10px] font-semibold text-surface-1">
                          {conversation.unread_count}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )
        ) : alerts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            No alerts right now.
          </p>
        ) : (
          alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => onOpenAlert(alert)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-3/60"
            >
              <span
                className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${
                  alert.status === "UNREAD" ? "bg-status-critical" : "bg-surface-4"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text-primary">
                  {alert.title}
                </span>
                <span className="line-clamp-2 text-xs text-text-muted">{alert.body}</span>
                <span className="text-[11px] text-text-disabled">
                  {formatTime(alert.created_at)}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
