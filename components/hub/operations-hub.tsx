"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatBubble } from "iconoir-react";
import { useNotifications } from "@/services/notifications/hooks";
import {
  hubQueryKeys,
  upsertMessageInCache,
  useExecuteMessageAction,
  useHubConversations,
  useHubMessages,
  useHubSocket,
  useLoadOlderMessages,
  useMarkHubRead,
  useOpenNotificationConversation,
  useResolveConversation,
  useSendHubMessage,
  useUpdateConversation,
  type ConversationListResponse,
  type HubConversation,
  type HubNotification,
  type HubSocketEvent,
  type MessageAction,
} from "@/services/hub";
import { ConversationRail } from "./conversation-rail";
import { GlobalSearchOverlay } from "./global-search-overlay";
import { NewChatPopover } from "./new-chat-popover";
import { ThreadView } from "./thread-view";

interface CurrentUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

type TypingState = Record<string, Record<string, { name: string; until: number }>>;

export function OperationsHub({ user }: { user: CurrentUser }) {
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [railTab, setRailTab] = useState<"conversations" | "alerts">("conversations");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<TypingState>({});
  const [aiThinking, setAiThinking] = useState<Record<string, boolean>>({});
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [resolvedFallback, setResolvedFallback] = useState<HubConversation | null>(null);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeConversationId;

  const conversationsQuery = useHubConversations();
  const messagesQuery = useHubMessages(activeConversationId);
  const resolveMutation = useResolveConversation();
  const updateMutation = useUpdateConversation();
  const markReadMutation = useMarkHubRead();
  const actionMutation = useExecuteMessageAction();
  const openAlertMutation = useOpenNotificationConversation();
  const notificationsQuery = useNotifications({ limit: 30 });

  const invalidateConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: hubQueryKeys.conversations() });
  }, [queryClient]);

  const handleSocketEvent = useCallback(
    (event: HubSocketEvent) => {
      switch (event.event) {
        case "connected": {
          const all = new Set<string>();
          for (const ids of Object.values(event.payload.online)) {
            for (const id of ids) all.add(id);
          }
          setOnlineUserIds(all);
          break;
        }
        case "presence": {
          setOnlineUserIds((current) => {
            const next = new Set(current);
            if (event.payload.online) next.add(event.payload.user_id);
            else next.delete(event.payload.user_id);
            return next;
          });
          break;
        }
        case "message.new":
        case "message.updated": {
          upsertMessageInCache(queryClient, {
            ...event.payload,
            is_me: event.payload.sender?.id === user.id,
          });
          invalidateConversations();
          if (
            event.event === "message.new" &&
            event.payload.conversation_id === activeIdRef.current &&
            event.payload.sender?.id !== user.id
          ) {
            markReadMutation.mutate(event.payload.conversation_id);
          }
          if (event.payload.sender_kind !== "USER") {
            setAiThinking((state) => ({
              ...state,
              [event.payload.conversation_id]: false,
            }));
          }
          break;
        }
        case "conversation.new":
        case "conversation.updated":
          invalidateConversations();
          break;
        case "typing": {
          if (event.payload.user_id === user.id) break;
          setTyping((state) => {
            const conversation = { ...(state[event.payload.conversation_id] ?? {}) };
            if (event.payload.is_typing) {
              conversation[event.payload.user_id] = {
                name: event.payload.user_name,
                until: Date.now() + 5000,
              };
            } else {
              delete conversation[event.payload.user_id];
            }
            return { ...state, [event.payload.conversation_id]: conversation };
          });
          break;
        }
        case "read": {
          queryClient.setQueryData<ConversationListResponse>(
            hubQueryKeys.conversations(),
            (data) =>
              data
                ? {
                    ...data,
                    results: data.results.map((conversation) =>
                      conversation.id === event.payload.conversation_id
                        ? {
                            ...conversation,
                            members: conversation.members.map((member) =>
                              member.user.id === event.payload.user_id
                                ? { ...member, last_read_at: event.payload.last_read_at }
                                : member,
                            ),
                          }
                        : conversation,
                    ),
                  }
                : data,
          );
          break;
        }
        case "notification.new":
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          break;
        case "ai.thinking":
          setAiThinking((state) => ({ ...state, [event.payload.conversation_id]: true }));
          break;
        default:
          break;
      }
    },
    [invalidateConversations, markReadMutation, queryClient, user.id],
  );

  const socket = useHubSocket(handleSocketEvent);

  // Purge stale typing entries.
  useEffect(() => {
    const timer = setInterval(() => {
      setTyping((state) => {
        const now = Date.now();
        let changed = false;
        const next: TypingState = {};
        for (const [conversationId, users] of Object.entries(state)) {
          const kept = Object.fromEntries(
            Object.entries(users).filter(([, info]) => info.until > now),
          );
          if (Object.keys(kept).length !== Object.keys(users).length) changed = true;
          next[conversationId] = kept;
        }
        return changed ? next : state;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const conversations = useMemo(
    () => conversationsQuery.data?.results ?? [],
    [conversationsQuery.data],
  );

  const activeConversation = useMemo(() => {
    const fromList = conversations.find((c) => c.id === activeConversationId);
    if (fromList) return fromList;
    if (resolvedFallback && resolvedFallback.id === activeConversationId) {
      return resolvedFallback;
    }
    return null;
  }, [conversations, activeConversationId, resolvedFallback]);

  const openConversation = useCallback(
    (conversation: HubConversation) => {
      setActiveConversationId(conversation.id);
      setResolvedFallback(conversation);
      setRailTab("conversations");
      setNewChatOpen(false);
      setSearchOpen(false);
      socket.subscribe(conversation.id);
      if (conversation.unread_count > 0) {
        markReadMutation.mutate(conversation.id);
      }
    },
    [markReadMutation, socket],
  );

  const openConversationById = useCallback(
    (conversationId: string) => {
      const found = conversations.find((c) => c.id === conversationId);
      if (found) openConversation(found);
      else {
        setActiveConversationId(conversationId);
        setSearchOpen(false);
        socket.subscribe(conversationId);
      }
    },
    [conversations, openConversation, socket],
  );

  const resolveAndOpen = useCallback(
    (input: { participantIds: string[]; includeAssistant: boolean }) => {
      resolveMutation.mutate(
        {
          participant_ids: input.participantIds,
          include_assistant: input.includeAssistant,
        },
        { onSuccess: openConversation },
      );
    },
    [openConversation, resolveMutation],
  );

  const sendMutation = useSendHubMessage(activeConversationId ?? "", {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
  });

  const loadOlderMutation = useLoadOlderMessages(activeConversationId ?? "");

  const handleSend = useCallback(
    (input: {
      content: string;
      attachments: File[];
      references: { ref_type: string; object_id: string }[];
    }) => {
      if (!activeConversationId) return;
      sendMutation.mutate({
        content: input.content,
        clientId: crypto.randomUUID(),
        attachments: input.attachments,
        references: input.references,
      });
    },
    [activeConversationId, sendMutation],
  );

  const handleExecuteAction = useCallback(
    (messageId: string, action: MessageAction) => {
      setExecutingAction(action.id);
      actionMutation.mutate(
        { messageId, actionId: action.id },
        {
          onSettled: () => {
            setExecutingAction(null);
            if (activeIdRef.current) {
              queryClient.invalidateQueries({
                queryKey: hubQueryKeys.messages(activeIdRef.current),
              });
            }
          },
        },
      );
    },
    [actionMutation, queryClient],
  );

  const handleOpenAlert = useCallback(
    (alert: HubNotification) => {
      openAlertMutation.mutate(alert.id, { onSuccess: openConversation });
    },
    [openAlertMutation, openConversation],
  );

  const alerts: HubNotification[] = useMemo(() => {
    const raw = notificationsQuery.data as
      | Record<string, unknown>[]
      | { results?: Record<string, unknown>[] }
      | undefined;
    const list = Array.isArray(raw) ? raw : (raw?.results ?? []);
    return list.map((n: Record<string, unknown>) => ({
      id: String(n.id),
      title: (n.title as string) || (n.code as string) || "Alert",
      body: (n.body as string) || (n.message as string) || "",
      code: (n.code as string) ?? "",
      domain: (n.domain as string) ?? "",
      escalation_level: (n.escalation_level as string) ?? "",
      status: (n.status as string) ?? "",
      recommended_action: (n.recommended_action as string) ?? "",
      organization_id: null,
      branch_id: null,
      metadata: {},
      created_at: (n.created_at as string) ?? new Date().toISOString(),
    }));
  }, [notificationsQuery.data]);

  const activeTyping = activeConversationId
    ? Object.values(typing[activeConversationId] ?? {}).map((info) => info.name)
    : [];

  return (
    <div className="relative flex h-[calc(100vh-200px)] overflow-hidden rounded-xl border border-surface-4 bg-surface-2 shadow-lg">
      <div className="relative flex w-80 flex-shrink-0 flex-col border-r border-surface-4">
        <ConversationRail
          conversations={conversations}
          alerts={alerts}
          activeTab={railTab}
          onTabChange={setRailTab}
          activeConversationId={activeConversationId}
          onSelectConversation={openConversation}
          onOpenAlert={handleOpenAlert}
          onNewChat={() => setNewChatOpen((open) => !open)}
          onOpenSearch={() => setSearchOpen(true)}
          onlineUserIds={onlineUserIds}
          currentUserId={user.id}
          isLoading={conversationsQuery.isLoading}
        />
        {newChatOpen ? (
          <NewChatPopover
            onResolve={resolveAndOpen}
            onClose={() => setNewChatOpen(false)}
            resolving={resolveMutation.isPending}
          />
        ) : null}
        {socket.status !== "open" ? (
          <div className="border-t border-surface-4 px-3 py-1.5 text-center text-[11px] text-text-muted">
            {socket.status === "connecting" ? "Connecting live updates…" : "Live updates offline — retrying"}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? (
          <ThreadView
            conversation={activeConversation}
            messages={messagesQuery.data?.results ?? []}
            hasMore={messagesQuery.data?.has_more ?? false}
            onLoadOlder={() => {
              const first = messagesQuery.data?.results[0];
              if (first) loadOlderMutation.mutate(first.created_at);
            }}
            loadingOlder={loadOlderMutation.isPending}
            typingUsers={activeTyping}
            aiThinking={Boolean(aiThinking[activeConversation.id])}
            onSend={handleSend}
            onTyping={(isTyping) =>
              activeConversationId && socket.sendTyping(activeConversationId, isTyping)
            }
            sending={sendMutation.isPending}
            onExecuteAction={handleExecuteAction}
            executingAction={executingAction}
            onRename={(title) =>
              updateMutation.mutate({ id: activeConversation.id, patch: { title } })
            }
            onToggleOpsEvents={(enabled) =>
              updateMutation.mutate({
                id: activeConversation.id,
                patch: { ops_events_enabled: enabled },
              })
            }
            mediaOrigin={socket.mediaOrigin}
            currentUserId={user.id}
            onlineUserIds={onlineUserIds}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-3 text-text-muted">
              <ChatBubble className="h-6 w-6" />
            </span>
            <div>
              <p className="text-base font-medium text-text-primary">Operations Hub</p>
              <p className="mt-1 max-w-sm text-sm text-text-muted">
                Conversations, live kitchen events and alerts in one stream. Pick a
                conversation or start one with a teammate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-surface-1 transition-colors hover:bg-brand-gold-hover"
            >
              New conversation
            </button>
          </div>
        )}
      </div>

      {searchOpen ? (
        <GlobalSearchOverlay
          onClose={() => setSearchOpen(false)}
          onOpenConversation={openConversationById}
          onStartDirect={(userId) =>
            resolveAndOpen({ participantIds: [userId], includeAssistant: false })
          }
        />
      ) : null}
    </div>
  );
}
