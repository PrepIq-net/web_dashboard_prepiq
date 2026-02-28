"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import React from "react";
import { ChatThreadList } from "@/components/chat/chat-thread-list";
import { ChatMessageArea } from "@/components/chat/chat-message-area";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile, useChatThreads } from "@/services";

export default function ChatPage() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserProfile();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  
  const role = user?.organization_role ?? "";
  const canAccess = [
    "STAFF_OPERATOR", 
    "BRANCH_MANAGER", 
    "GM", 
    "OPS_DIRECTOR", 
    "ORG_OWNER", 
    "ORG_ADMIN"
  ].includes(role);

  // Fetch threads based on user role
  const threadsQuery = useChatThreads();

  // Debug logging - check what's happening
  React.useEffect(() => {
    console.log('Chat page threadsQuery state:', {
      data: threadsQuery.data,
      isLoading: threadsQuery.isLoading,
      error: threadsQuery.error,
      isError: threadsQuery.isError,
      status: threadsQuery.status,
      fetchStatus: threadsQuery.fetchStatus
    });
    
    if (threadsQuery.error) {
      console.error('Thread query error details:', threadsQuery.error);
    }
    
    // Test direct API call
    if (threadsQuery.status === 'pending' && !threadsQuery.isFetching) {
      console.warn('Query is pending but not fetching - this might indicate a configuration issue');
    }
  }, [threadsQuery.data, threadsQuery.isLoading, threadsQuery.error, threadsQuery.status, threadsQuery.fetchStatus, threadsQuery.isFetching]);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, canAccess]);

  if (isLoading) {
    return (
      <WorkspaceShell
        eyebrow="Communication"
        title="Chat"
        description="Internal team communication and collaboration."
        insight="Structured communication improves team coordination and reduces information silos."
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

  if (!canAccess) {
    return null;
  }

  return (
    <WorkspaceShell
      eyebrow="Communication"
      title="Chat"
      description="Internal team communication and collaboration."
      insight="Structured communication improves team coordination and reduces information silos."
    >
      <div className="flex h-[calc(100vh-200px)] bg-surface-2 rounded-xl border border-surface-4 shadow-lg overflow-hidden">
        {/* Thread List Sidebar */}
        <div className="w-80 border-r border-surface-4 flex flex-col">
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
            <ChatEmptyState user={user} />
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
