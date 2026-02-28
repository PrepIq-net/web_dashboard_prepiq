"use client";

import { format } from "date-fns";
import { Download, Attachment } from "iconoir-react";
import type { ChatThreadMessage } from "@/services/chat/types";
import type { UserProfile } from "@/services/users/types";

interface ChatMessageProps {
  message: ChatThreadMessage;
  user?: UserProfile | null;
  showAvatar?: boolean;
}

export function ChatMessage({ message, user, showAvatar = true }: ChatMessageProps) {
  const isOwnMessage = message.is_me;
  const messageTime = format(new Date(message.created_at), 'h:mm a');

  const getSenderInitials = (sender: typeof message.sender) => {
    if (!sender) return "S";
    return `${sender.first_name?.[0] || ""}${sender.last_name?.[0] || ""}`.toUpperCase() || "U";
  };

  const getSenderRoleColor = (role: string) => {
    switch (role) {
      case "BUSINESS_OWNER":
        return "bg-brand-gold/20 text-brand-gold";
      case "BUSINESS_ADMIN":
        return "bg-status-warning/20 text-status-warning";
      case "BUSINESS_MANAGER":
        return "bg-status-success/20 text-status-success";
      case "BUSINESS_STAFF":
        return "bg-surface-4 text-text-secondary";
      default:
        return "bg-surface-4 text-text-muted";
    }
  };

  return (
    <div className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {showAvatar ? (
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
          getSenderRoleColor(message.sender_role)
        }`}>
          {message.sender?.profile_picture ? (
            <img
              src={message.sender.profile_picture}
              alt={`${message.sender.first_name} ${message.sender.last_name}`}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            getSenderInitials(message.sender)
          )}
        </div>
      ) : (
        <div className="w-8" /> // Spacer for alignment
      )}

      {/* Message Content */}
      <div className={`flex-1 max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        {/* Sender Info */}
        {showAvatar && !isOwnMessage && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text-primary">
              {message.sender ? `${message.sender.first_name} ${message.sender.last_name}` : "Unknown User"}
            </span>
            <span className="text-xs text-text-muted">
              {messageTime}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        <div className={`rounded-lg px-4 py-2 ${
          isOwnMessage
            ? "bg-brand-gold text-surface-1 rounded-br-sm"
            : "bg-surface-3 text-text-primary rounded-bl-sm"
        }`}>
          {/* File Message */}
          {message.message_type === "FILE" && message.file ? (
            <div className="flex items-center gap-3">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${
                isOwnMessage ? "bg-surface-1/20" : "bg-surface-4"
              }`}>
                <Attachment className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  isOwnMessage ? "text-surface-1" : "text-text-primary"
                }`}>
                  {message.file.split('/').pop() || "File"}
                </p>
                <p className={`text-xs ${
                  isOwnMessage ? "text-surface-1/70" : "text-text-muted"
                }`}>
                  Click to download
                </p>
              </div>
              <a
                href={message.file}
                download
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isOwnMessage 
                    ? "hover:bg-surface-1/20 text-surface-1" 
                    : "hover:bg-surface-4 text-text-muted"
                }`}
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          ) : (
            /* Text Message */
            <div className="space-y-2">
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                isOwnMessage ? "text-surface-1" : "text-text-primary"
              }`}>
                {message.content}
              </p>
            </div>
          )}
        </div>

        {/* Own Message Time */}
        {showAvatar && isOwnMessage && (
          <div className="flex items-center justify-end gap-2 mt-1">
            <span className="text-xs text-text-muted">
              {messageTime}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}