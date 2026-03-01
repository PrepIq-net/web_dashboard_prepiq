"use client";

import { useState } from "react";
import { 
  Xmark, 
  MoreHoriz, 
  User, 
  Settings,
  Archive,
  UserPlus,
  Bookmark
} from "iconoir-react";
import { format } from "date-fns";
import type { ChatThread } from "@/services/chat/types";
import type { UserProfile } from "@/services/users/types";

interface ChatThreadHeaderProps {
  thread: ChatThread;
  user?: UserProfile | null;
  onClose: () => void;
}

export function ChatThreadHeader({ thread, user, onClose }: ChatThreadHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

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

  const canManageThread = user?.organization_role && [
    "BRANCH_MANAGER", 
    "GM", 
    "OPS_DIRECTOR", 
    "ORG_OWNER", 
    "ORG_ADMIN"
  ].includes(user.organization_role);

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
    <div className="border-b border-surface-4 p-4">
      <div className="flex items-center justify-between">
        {/* Thread Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
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

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-text-primary truncate">
                {thread.display_title}
              </h2>
              
              {/* Status */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`h-2 w-2 rounded-full ${getStatusDot(thread.status)}`} />
                <span className={`text-xs font-medium ${getStatusColor(thread.status)}`}>
                  {thread.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-text-muted">
              {/* Participants */}
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {thread.participants.length} member{thread.participants.length !== 1 ? "s" : ""}
              </span>

              {/* Last Activity */}
              {thread.last_message_at && (
                <span>
                  Last active {format(new Date(thread.last_message_at), 'MMM d, h:mm a')}
                </span>
              )}

              {/* Assigned */}
              {thread.assigned_to && (
                <span className="text-brand-gold">
                  Assigned to {thread.assigned_to.first_name}
                </span>
              )}
            </div>

            {/* Tags */}
            {(thread.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(thread.tags || []).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-surface-4 text-text-muted"
                  >
                    <Bookmark className="h-3 w-3 mr-1" />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Menu */}
          {canManageThread && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
              >
                <MoreHoriz className="h-4 w-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-surface-4 bg-surface-2 p-1 shadow-lg z-10">
                  <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                    <UserPlus className="h-4 w-4" />
                    Add Members
                  </button>
                  <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                    <Settings className="h-4 w-4" />
                    Thread Settings
                  </button>
                  <div className="h-px bg-surface-4 my-1" />
                  <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-status-warning hover:bg-surface-3">
                    <Archive className="h-4 w-4" />
                    Archive Thread
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
