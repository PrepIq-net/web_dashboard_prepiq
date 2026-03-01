"use client";

import { useState } from "react";
import { ChatBubble, User, Plus } from "iconoir-react";
import { CreateThreadModal } from "./create-thread-modal";
import type { UserProfile } from "@/services/users/types";

interface ChatEmptyStateProps {
  user?: UserProfile | null;
}

export function ChatEmptyState({ user }: ChatEmptyStateProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const canCreateThread = user?.organization_role && [
    "STAFF_OPERATOR",
    "BRANCH_MANAGER", 
    "GM", 
    "OPS_DIRECTOR", 
    "ORG_OWNER", 
    "ORG_ADMIN"
  ].includes(user.organization_role);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 mb-6">
          <ChatBubble className="h-10 w-10 text-brand-gold" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-text-primary mb-3">
          Welcome to Team Chat
        </h3>

        {/* Description */}
        <p className="text-text-secondary mb-6 leading-relaxed">
          Stay connected with your team through organized conversations. 
          Select a conversation from the sidebar to start messaging, or create a new one to get started.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-3/50 border border-surface-4">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/20 flex-shrink-0">
              <User className="h-4 w-4 text-brand-gold" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-medium text-text-primary mb-1">Team Collaboration</h4>
              <p className="text-xs text-text-muted">
                Organize conversations by topic, project, or team to keep discussions focused and searchable.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-3/50 border border-surface-4">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-status-success/20 flex-shrink-0">
              <ChatBubble className="h-4 w-4 text-status-success" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-medium text-text-primary mb-1">Real-time Messaging</h4>
              <p className="text-xs text-text-muted">
                Send messages, share files, and get instant notifications when team members respond.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        {canCreateThread ? (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Ready to start collaborating?
            </p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-2 text-sm font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/20 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Create New Conversation
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              Select a conversation from the sidebar to start messaging.
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-surface-3 px-4 py-2 text-sm text-text-secondary">
              <ChatBubble className="h-4 w-4" />
              Choose a conversation to begin
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 pt-6 border-t border-surface-4">
          <p className="text-xs text-text-muted mb-3">💡 Pro Tips:</p>
          <div className="text-left space-y-2">
            <p className="text-xs text-text-muted">
              • Use @mentions to notify specific team members
            </p>
            <p className="text-xs text-text-muted">
              • Drag and drop files to share them instantly
            </p>
            <p className="text-xs text-text-muted">
              • Use tags to organize conversations by topic
            </p>
          </div>
        </div>
      </div>

      {/* Create Thread Modal */}
      {showCreateModal && (
        <CreateThreadModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            // The thread list will automatically refresh via React Query
          }}
        />
      )}
    </div>
  );
}