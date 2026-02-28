"use client";

import { useState, useRef, useEffect } from "react";
import { 
  X, 
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  const threadQuery = useChatThread(threadId);
  const messagesQuery = useChatThreadMessages(threadId);
  const createMessageMutation = useCreateChatThreadMessage();
  const markReadMutation = useMarkChatThreadAsRead();

  const thread = threadQuery.data;
  const messages = messagesQuery.data ?? [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isAtBottom]);

  // Mark thread as read when opened
  useEffect(() => {
    if (thread && thread.unread_count > 0) {
      markReadMutation.mutate(threadId);
    }
  }, [threadId, thread?.unread_count, markReadMutation]);

  const handleSendMessage = async (content: string, attachment?: File) => {
    if (!content.trim() && !attachment) return;

    try {
      await createMessageMutation.mutateAsync({
        threadId,
        payload: {
          content: content.trim(),
          message_type: attachment ? "FILE" : "TEXT",
        },
        attachment,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(isNearBottom);
  };

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
            <X className="h-6 w-6 text-status-critical" />
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
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {messagesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 mb-4">
                <User className="h-6 w-6 text-text-muted" />
              </div>
              <p className="text-sm text-text-secondary mb-2">No messages yet</p>
              <p className="text-xs text-text-muted">Start the conversation by sending a message below.</p>
            </div>
          </div>
        ) : (
          <>
            {(messages || []).map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showDateSeparator = prevMessage && 
                format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                format(new Date(prevMessage.created_at), 'yyyy-MM-dd');

              return (
                <div key={message.id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-surface-4 flex-1" />
                        <span className="text-xs text-text-muted bg-surface-2 px-3 py-1 rounded-full">
                          {format(new Date(message.created_at), 'MMMM d, yyyy')}
                        </span>
                        <div className="h-px bg-surface-4 flex-1" />
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
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <div className="absolute bottom-20 right-6">
          <button
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setIsAtBottom(true);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold text-surface-1 shadow-lg transition-all duration-200 hover:bg-brand-gold-hover active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t border-surface-4 p-4">
        <ChatMessageInput
          onSend={handleSendMessage}
          disabled={createMessageMutation.isPending}
          placeholder={`Message ${thread.display_title}...`}
        />
      </div>
    </div>
  );
}