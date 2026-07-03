"use client";

import { useState } from "react";
import { Search, Plus, Filter } from "iconoir-react";
import { ChatThreadItem } from "./chat-thread-item";
import { CreateThreadModal } from "./create-thread-modal";
import { Select } from "@/components/ui/select";
import type { ChatThread } from "@/services/chat/types";
import type { UserProfile } from "@/services/users/types";

interface ChatThreadListProps {
  threads: ChatThread[];
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  isLoading: boolean;
  user?: UserProfile | null;
}

export function ChatThreadList({
  threads,
  selectedThreadId,
  onThreadSelect,
  isLoading,
  user,
}: ChatThreadListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const handleThreadCreated = (threadId: string) => {
    setShowCreateModal(false);
    onThreadSelect(threadId);
  };

  // Filter threads based on search and status
  // Handle different possible data structures from the API
  let threadsArray: ChatThread[] = [];
  
  if (Array.isArray(threads)) {
    threadsArray = threads;
  } else if (threads && typeof threads === 'object' && 'results' in threads) {
    // Handle paginated response
    threadsArray = Array.isArray((threads as any).results) ? (threads as any).results : [];
  } else if (threads && typeof threads === 'object' && 'data' in threads) {
    // Handle wrapped response
    threadsArray = Array.isArray((threads as any).data) ? (threads as any).data : [];
  }

  const filteredThreads = threadsArray
    .filter((thread) => {
      const matchesSearch =
        thread.display_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        thread.status.toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aTimestamp = new Date(a.last_message_at || a.updated_at).getTime();
      const bTimestamp = new Date(b.last_message_at || b.updated_at).getTime();
      return bTimestamp - aTimestamp;
    });

  const canCreateThread = Boolean(user?.organization_id);

  return (
    <>
      <div className="p-4 border-b border-surface-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Conversations</h2>
          {canCreateThread && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-gold/40 bg-brand-gold/10 text-brand-gold transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/20 active:scale-95"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-surface-4 bg-surface-3 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
          />
        </div>

        {/* Filter */}
        <div className="flex items-end gap-2">
          <div className="w-full">
            <Select
              label="Status"
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "closed", label: "Closed" },
                { value: "archived", label: "Archived" },
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              leadingIcon={<Filter className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E]">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-3">
                  <div className="h-10 w-10 rounded-full bg-surface-4" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-4 rounded w-3/4" />
                    <div className="h-3 bg-surface-4 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 mb-4">
              <Search className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary mb-2">
              {searchQuery || filterStatus !== "all" ? "No conversations found" : "No conversations yet"}
            </p>
            <p className="text-xs text-text-muted">
              {searchQuery || filterStatus !== "all" 
                ? "Try adjusting your search or filter criteria"
                : "Start a new conversation to get started"
              }
            </p>
          </div>
        ) : (
          <div className="p-2">
            {filteredThreads.map((thread) => (
              <ChatThreadItem
                key={thread.id}
                thread={thread}
                isSelected={selectedThreadId === thread.id}
                onClick={() => onThreadSelect(thread.id)}
                user={user}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Thread Modal */}
      {showCreateModal && (
        <CreateThreadModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleThreadCreated}
        />
      )}
    </>
  );
}
