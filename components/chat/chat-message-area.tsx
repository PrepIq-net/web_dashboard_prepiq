"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Xmark, 
  Send, 
  Attachment, 
  MoreHoriz, 
  User,
  Clock,
  CheckCircle 
} from "iconoir-react";
import { formatDistanceToNow, format } from "date-fns";
import { ChatMessage } from "./chat-message";
import { ChatMessageInput } from "./chat-message-input";
import { ChatThreadHeader } from "./chat-thread-header";
import { 
  useChatThread, 
  useChatThreadMessages, 
  useCreateChatThreadMessage,
  useMarkChatThreadAsRead 
} from "@/services";
import type { UserProfile } from "@/services/users/types";

interface ChatMessageAreaProps {
  threadId: string;
  user?: UserProfile | null;
  onClose: () => void;
}

export function ChatMessageArea({ threadId, user, onClose }: ChatMessageAreaProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const previousMessageCountRef = useRef(0);
  const readRequestSentForThreadRef = useRef<string | null>(null);
  
  const threadQuery = useChatThread(threadId);
  const messagesQuery = useChatThreadMessages(threadId);
  const createMessageMutation = useCreateChatThreadMessage();
  const markReadMutation = useMarkChatThreadAsRead();

  const thread = threadQuery.data;
  const messages = messagesQuery.data ?? [];
  const orderedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });
  }, [messages]);

  useEffect(() => {
    readRequestSentForThreadRef.current = null;
  }, [threadId]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (orderedMessages.length > 0 && !hasScrolledToBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      setHasScrolledToBottom(true);
      previousMessageCountRef.current = orderedMessages.length;
    }
  }, [orderedMessages.length, hasScrolledToBottom]);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (orderedMessages.length > previousMessageCountRef.current && isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    previousMessageCountRef.current = orderedMessages.length;
  }, [orderedMessages.length, isAtBottom]);

  // Mark thread as read when opened
  useEffect(() => {
    if (!thread || thread.unread_count <= 0) return;
    if (markReadMutation.isPending) return;
    if (readRequestSentForThreadRef.current === threadId) return;

    readRequestSentForThreadRef.current = threadId;
    markReadMutation.mutate(threadId, {
      onError: () => {
        // Allow one retry if the request failed.
        readRequestSentForThreadRef.current = null;
      },
    });
  }, [threadId, thread?.unread_count, markReadMutation.isPending]);

  const handleSendMessage = async (content: string, attachment?: File) => {
    if (!content.trim() && !attachment) return;

    setSendError(null);
    try {
      await createMessageMutation.mutateAsync({
        threadId,
        payload: {
          content: content.trim(),
          message_type: attachment ? "ATTACHMENT" : "TEXT",
        },
        attachment,
      });
      // Ensure we scroll to bottom after sending
      setIsAtBottom(true);
    } catch (error) {
      console.error("Failed to send message:", error);
      setSendError("Message failed to send. Please try again.");
      throw error;
    }
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(isNearBottom);

    // Infinite scroll: load more when scrolling to top
    const isNearTop = scrollTop < 100;
    if (isNearTop && !messagesQuery.isLoading && !messagesQuery.isFetching) {
      // TODO: Implement pagination when backend supports it
      // For now, all messages are loaded at once
      console.log("Near top - would load more messages here");
    }
  }, [messagesQuery.isLoading, messagesQuery.isFetching]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
  }, []);

  if (threadQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-brand-gold border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-text-muted">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-status-critical/20 mb-4">
            <Xmark className="h-6 w-6 text-status-critical" />
          </div>
          <p className="text-sm text-text-secondary mb-2">Conversation not found</p>
          <p className="text-xs text-text-muted">This conversation may have been deleted or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <ChatThreadHeader 
        thread={thread} 
        user={user} 
        onClose={onClose} 
      />

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-6 flex flex-col [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E] hover:[&::-webkit-scrollbar-thumb]:bg-[#3A3A40]"
        onScroll={handleScroll}
      >
        {messagesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          </div>
        ) : orderedMessages.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 mb-4">
                <User className="h-6 w-6 text-text-muted" />
              </div>
              <p className="text-sm text-text-secondary mb-2">No messages yet</p>
              <p className="text-xs text-text-muted">Start the conversation by sending a message below.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Load more indicator at top */}
            {messagesQuery.isFetching && (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
              </div>
            )}

            {orderedMessages.map((message, index) => {
              const prevMessage = index > 0 ? orderedMessages[index - 1] : null;
              const showDateSeparator = prevMessage && 
                format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                format(new Date(prevMessage.created_at), 'yyyy-MM-dd');

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center py-6">
                      <div className="flex items-center gap-4 w-full max-w-xs">
                        <div className="h-px bg-[#2A2A2E] flex-1" />
                        <span className="text-xs font-medium text-text-muted bg-[#1C1C1F] px-4 py-1.5 rounded-full border border-[#2A2A2E]">
                          {format(new Date(message.created_at), 'MMMM d, yyyy')}
                        </span>
                        <div className="h-px bg-[#2A2A2E] flex-1" />
                      </div>
                    </div>
                  )}
                  <ChatMessage 
                    message={message} 
                    user={user}
                    showAvatar={
                      !prevMessage || 
                      prevMessage.sender?.id !== message.sender?.id ||
                      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000 // 5 minutes
                    }
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && orderedMessages.length > 0 && (
        <div className="absolute bottom-24 right-8">
          <button
            onClick={scrollToBottom}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#A8821F] to-[#8F6F18] text-[#141416] shadow-[0_4px_12px_rgba(168,130,31,0.35)] transition-all duration-200 hover:shadow-[0_6px_16px_rgba(168,130,31,0.45)] hover:scale-105 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-surface-4 p-4">
        {sendError && (
          <div className="mb-3 rounded-lg border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-xs text-status-critical">
            {sendError}
          </div>
        )}
        <ChatMessageInput
          onSend={handleSendMessage}
          disabled={createMessageMutation.isPending}
          placeholder={`Message ${thread.display_title}...`}
        />
      </div>
    </div>
  );
}
