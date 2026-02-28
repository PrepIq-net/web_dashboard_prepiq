"use client";

import { formatDistanceToNow } from "date-fns";
import { User, Clock } from "iconoir-react";
import type { ChatThread } from "@/services/chat/types";
import type { UserProfile } from "@/services/users/types";

interface ChatThreadItemProps {
  thread: ChatThread;
  isSelected: boolean;
  onClick: () => void;
  user?: UserProfile | null;
}

export function ChatThreadItem({ thread, isSelected, onClick, user }: ChatThreadItemProps) {
  const isUnread = thread.unread_count > 0;
  const lastMessageTime = thread.last_message_at 
    ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })
    : null;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "open":
        return "text-status-success";
      case "assigned":
        return "text-brand-gold";
      case "closed":
      case "resolved":
        return "text-text-muted";
      case "archived":
        return "text-text-muted";
      default:
        return "text-text-secondary";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "open":
        return "bg-status-success";
      case "assigned":
        return "bg-brand-gold";
      case "closed":
      case "resolved":
        return "bg-text-muted";
      case "archived":
        return "bg-text-muted";
      default:
        return "bg-text-secondary";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "urgent":
        return "text-status-critical";
      case "high":
        return "text-status-warning";
      case "medium":
        return "text-text-secondary";
      case "low":
        return "text-text-muted";
      default:
        return "text-text-secondary";
    }
  };

  const currentUserId = user?.id ? String(user.id) : "";
  const otherParticipant = (thread.participants || []).find(
    (participant) => String(participant.user?.id || "") !== currentUserId,
  );
  const avatarUrl =
    otherParticipant?.user?.profile_picture ||
    thread.assigned_to?.profile_picture ||
    (thread.participants || []).find((participant) => participant.user?.profile_picture)?.user?.profile_picture ||
    "";
  const avatarName =
    otherParticipant?.user?.first_name ||
    thread.assigned_to?.first_name ||
    thread.display_title ||
    "User";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all duration-200 hover:bg-surface-3/50 ${
        isSelected 
          ? "bg-brand-gold/10 border border-brand-gold/40 shadow-sm" 
          : "hover:bg-surface-3"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar/Icon */}
        <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden bg-surface-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={avatarName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`h-full w-full flex items-center justify-center ${
                thread.thread_type === "INTERNAL"
                  ? "bg-brand-gold/20 text-brand-gold"
                  : "text-text-muted"
              }`}
            >
              <User className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`text-sm font-medium truncate ${
              isUnread ? "text-text-primary" : "text-text-secondary"
            }`}>
              {thread.display_title}
            </h3>
            {lastMessageTime && (
              <span className="text-xs text-text-muted flex-shrink-0 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastMessageTime}
              </span>
            )}
          </div>

          {/* Last Message Preview */}
          {thread.last_message && (
            <p className={`text-xs mb-2 line-clamp-2 ${
              isUnread ? "text-text-secondary" : "text-text-muted"
            }`}>
              {thread.last_message.is_me ? "You: " : `${thread.last_message.sender_name}: `}
              {thread.last_message.message_type === "FILE" 
                ? "📎 Sent a file" 
                : thread.last_message.content
              }
            </p>
          )}

          {/* Status and Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Status */}
              <div className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(thread.status)}`} />
                <span className={`text-xs font-medium ${getStatusColor(thread.status)}`}>
                  {thread.status}
                </span>
              </div>

              {/* Priority */}
              {thread.priority !== "MEDIUM" && (
                <span className={`text-xs font-medium ${getPriorityColor(thread.priority)}`}>
                  {thread.priority}
                </span>
              )}

              {/* Assigned indicator */}
              {thread.assigned_to && (
                <span className="text-xs text-brand-gold">
                  Assigned
                </span>
              )}
            </div>

            {/* Unread count */}
            {isUnread && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1.5 text-xs font-semibold text-surface-1">
                {thread.unread_count > 99 ? "99+" : thread.unread_count}
              </span>
            )}
          </div>

          {/* Tags */}
          {(thread.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(thread.tags || []).slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-surface-4 text-text-muted"
                >
                  {tag.name}
                </span>
              ))}
              {(thread.tags || []).length > 2 && (
                <span className="text-xs text-text-muted">
                  +{(thread.tags || []).length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
