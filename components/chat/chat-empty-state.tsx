"use client";

import { useState } from "react";
import { ChatBubble, User, Plus } from "iconoir-react";
import { CreateThreadModal } from "./create-thread-modal";
import type { UserProfile } from "@/services/users/types";
import { useTranslation } from "@/lib/i18n";

interface ChatEmptyStateProps {
  user?: UserProfile | null;
}

export function ChatEmptyState({ user }: ChatEmptyStateProps) {
  const { t } = useTranslation();
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
          {t("workspace.chat.empty.title")}
        </h3>

        {/* Description */}
        <p className="text-text-secondary mb-6 leading-relaxed">
          {t("workspace.chat.empty.description")}
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-3/50 border border-surface-4">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/20 flex-shrink-0">
              <User className="h-4 w-4 text-brand-gold" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-medium text-text-primary mb-1">{t("workspace.chat.empty.feature1Title")}</h4>
              <p className="text-xs text-text-muted">
                {t("workspace.chat.empty.feature1Desc")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-3/50 border border-surface-4">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-status-success/20 flex-shrink-0">
              <ChatBubble className="h-4 w-4 text-status-success" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-medium text-text-primary mb-1">{t("workspace.chat.empty.feature2Title")}</h4>
              <p className="text-xs text-text-muted">
                {t("workspace.chat.empty.feature2Desc")}
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        {canCreateThread ? (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              {t("workspace.chat.empty.ready")}
            </p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-2 text-sm font-medium text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/20 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {t("workspace.chat.empty.create")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              {t("workspace.chat.empty.select")}
            </p>
            <div className="inline-flex items-center gap-2 rounded-lg bg-surface-3 px-4 py-2 text-sm text-text-secondary">
              <ChatBubble className="h-4 w-4" />
              {t("workspace.chat.empty.choose")}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 pt-6 border-t border-surface-4">
          <p className="text-xs text-text-muted mb-3">💡 {t("workspace.chat.empty.proTips")}</p>
          <div className="text-left space-y-2">
            <p className="text-xs text-text-muted">
              • {t("workspace.chat.empty.tip1")}
            </p>
            <p className="text-xs text-text-muted">
              • {t("workspace.chat.empty.tip2")}
            </p>
            <p className="text-xs text-text-muted">
              • {t("workspace.chat.empty.tip3")}
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