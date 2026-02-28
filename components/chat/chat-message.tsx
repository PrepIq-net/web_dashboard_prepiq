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
      case "ORG_OWNER":
      case "ORG_ADMIN":
        return "bg-brand-gold/20 text-brand-gold border-brand-gold/30";
      case "BUSINESS_ADMIN":
      case "OPS_DIRECTOR":
        return "bg-status-warning/20 text-status-warning border-status-warning/30";
      case "BUSINESS_MANAGER":
      case "BRANCH_MANAGER":
      case "GM":
        return "bg-status-success/20 text-status-success border-status-success/30";
      case "BUSINESS_STAFF":
      case "STAFF_OPERATOR":
        return "bg-surface-4 text-text-secondary border-surface-4";
      default:
        return "bg-surface-4 text-text-muted border-surface-4";
    }
  };

  return (
    <div className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse justify-start" : "flex-row justify-start"} group`}>
      {/* Avatar */}
      {showAvatar ? (
        <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold border transition-all duration-200 ${
          getSenderRoleColor(message.sender_role)
        }`}>
          {message.sender?.profile_picture ? (
            <img
              src={message.sender.profile_picture}
              alt={`${message.sender.first_name} ${message.sender.last_name}`}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            getSenderInitials(message.sender)
          )}
        </div>
      ) : (
        <div className="w-9 flex-shrink-0" /> // Spacer for alignment
      )}

      {/* Message Content */}
      <div className={`flex flex-col max-w-[55%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        {/* Sender Info */}
        {showAvatar && !isOwnMessage && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="text-sm font-medium text-text-primary">
              {message.sender ? `${message.sender.first_name} ${message.sender.last_name}` : "Unknown User"}
            </span>
            <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {messageTime}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        <div className={`rounded-xl px-4 py-3 transition-all duration-200 ${
          isOwnMessage
            ? "bg-gradient-to-br from-[#A8821F] to-[#8F6F18] text-[#141416] shadow-[0_2px_8px_rgba(168,130,31,0.25)] rounded-br-md"
            : "bg-[#1C1C1F] text-text-primary border border-[#2A2A2E] shadow-[0_1px_2px_rgba(0,0,0,0.3)] rounded-bl-md hover:border-[#3A3A40]"
        }`}>
          {/* File Message */}
          {message.message_type === "ATTACHMENT" && message.file ? (
            <div className="flex items-center gap-3">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isOwnMessage ? "bg-[#141416]/20" : "bg-[#232327]"
              }`}>
                <Attachment className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  isOwnMessage ? "text-[#141416]" : "text-text-primary"
                }`}>
                  {message.file.split('/').pop() || "File"}
                </p>
                <p className={`text-xs ${
                  isOwnMessage ? "text-[#141416]/70" : "text-text-muted"
                }`}>
                  Click to download
                </p>
              </div>
              <a
                href={message.file}
                download
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                  isOwnMessage 
                    ? "hover:bg-[#141416]/20 text-[#141416] active:scale-95" 
                    : "hover:bg-[#232327] text-text-muted active:scale-95"
                }`}
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          ) : (
            /* Text Message */
            <div className="space-y-2">
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                isOwnMessage ? "text-[#141416] font-medium" : "text-text-primary"
              }`}>
                {message.content}
              </p>
            </div>
          )}
        </div>

        {/* Own Message Time */}
        {showAvatar && isOwnMessage && (
          <div className="flex items-center justify-end gap-2 mt-1.5 px-1">
            <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {messageTime}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}