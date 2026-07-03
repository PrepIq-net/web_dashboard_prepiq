"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ChatThreadList } from "@/components/chat/chat-thread-list";
import { ChatMessageArea } from "@/components/chat/chat-message-area";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile, useChatThreads } from "@/services";

export default function ChatPage() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUserProfile();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const threadsQuery = useChatThreads();

  if (isLoading) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.chat.eyebrow")}
        title={t("workspace.chat.title")}
        description={t("workspace.chat.description")}
        insight={t("workspace.chat.insight")}
      >
        <div className="flex h-[calc(100vh-200px)] bg-surface-2 rounded-xl border border-surface-4">
          <div className="w-80 border-r border-surface-4 p-4">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-surface-3 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t("workspace.chat.eyebrow")}
      title={t("workspace.chat.title")}
      description={t("workspace.chat.description")}
      insight={t("workspace.chat.insight")}
    >
      <div className="flex h-[calc(100vh-200px)] bg-surface-2 rounded-xl border border-surface-4 shadow-lg overflow-hidden">
        {/* Thread List Sidebar */}
        <div className="w-80 border-r border-surface-4 flex flex-col [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E] hover:[&::-webkit-scrollbar-thumb]:bg-[#3A3A40]">
          <ChatThreadList
            threads={Array.isArray(threadsQuery.data) ? threadsQuery.data : []}
            selectedThreadId={selectedThreadId}
            onThreadSelect={setSelectedThreadId}
            isLoading={threadsQuery.isLoading}
            user={user}
          />
        </div>

        {/* Message Area */}
        <div className="flex-1 flex flex-col">
          {selectedThreadId ? (
            <ChatMessageArea
              threadId={selectedThreadId}
              user={user}
              onClose={() => setSelectedThreadId(null)}
            />
          ) : (
            <ChatEmptyState user={user} onThreadSelect={setSelectedThreadId} />
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
