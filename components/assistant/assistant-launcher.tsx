"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  useCurrentConversation,
  useExplainAlert,
  useSendAssistantMessage,
  useStartAssistantConversation,
  useSuggestedQuestions,
} from "@/services/assistant/hooks";
import type {
  AssistantMessage,
  AssistantReply,
  PendingAction,
} from "@/services/assistant/types";
import { AssistantDrawer } from "./assistant-drawer";
import { AssistantInput } from "./assistant-input";
import { AssistantMessageBubble } from "./assistant-message";
import { PendingActionConfirm } from "./pending-action-confirm";
import { SuggestedQuestions } from "./suggested-questions";

export type AssistantLauncherProps = {
  branchId?: string;
  date: string;
  // Confirmed actions are executed server-side; this fires afterwards so the
  // host page can refetch the data the action changed.
  onActionApplied?: (action: PendingAction) => void;
  explainRequest?: { topic: string; nonce: number } | null;
  // A raw question from elsewhere on the page (e.g. the morning-brief drawer's
  // quick-chat field): opens the drawer and sends it through the normal flow.
  askRequest?: { question: string; nonce: number } | null;
  // Opens the drawer on mount, e.g. when arriving via a "continue chat" deep link.
  autoOpen?: boolean;
};

let TEMP_ID = 0;
const tempId = () => `temp-${TEMP_ID++}`;

export function AssistantLauncher({
  branchId,
  date,
  onActionApplied,
  explainRequest,
  askRequest,
  autoOpen,
}: AssistantLauncherProps) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [animatingMsgId, setAnimatingMsgId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const suggested = useSuggestedQuestions(branchId, date);
  const current = useCurrentConversation(branchId, date);
  const startConversation = useStartAssistantConversation();
  const sendMessage = useSendAssistantMessage();
  const explain = useExplainAlert();

  const sending = startConversation.isPending || sendMessage.isPending || explain.isPending;

  // Rehydrate the persisted day thread on load / branch or date change so a
  // reload restores the transcript instead of starting over. Only seed while the
  // local session is still empty so an in-flight send is never clobbered.
  const currentConv = current.data?.conversation ?? null;
  useEffect(() => {
    if (!currentConv) return;
    if (conversationId || messages.length > 0 || sending) return;
    setConversationId(currentConv.id);
    setMessages(current.data?.messages ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConv?.id]);

  // A branch/date switch belongs to a different day thread — drop the stale
  // session so the rehydration effect above can load the correct one.
  useEffect(() => {
    setConversationId(null);
    setMessages([]);
    setAnimatingMsgId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, date]);
  // Deep link from elsewhere (e.g. Planning's "continue chat") opens the drawer.
  useEffect(() => {
    if (autoOpen) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const greeting = suggested.data?.greeting ?? "I've prepared today's briefing.";
  const questions = suggested.data?.suggested_questions ?? [];

  const handleClose = () => {
    setOpen(false);
    setAnimatingMsgId(null);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Open + seed an explanation when the parent requests it.
  useEffect(() => {
    if (!explainRequest || !branchId) return;
    setOpen(true);
    const userMsg: AssistantMessage = {
      id: tempId(),
      role: "user",
      content: `Explain: ${explainRequest.topic}`,
      pending_action: null,
      created_at: new Date().toISOString(),
    };
    setMessages([userMsg]);
    explain.mutate(
      { branch_id: branchId, date, topic: explainRequest.topic },
      {
        onSuccess: (reply) => {
          setConversationId(reply.conversation.id);
          setMessages((prev) => [...prev, reply.message]);
          setAnimatingMsgId(reply.message.id);
        },
        onError: () => toast.error("Couldn't load that explanation."),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainRequest?.nonce]);

  // Open + send a raw question when another surface (brief drawer) asks one.
  useEffect(() => {
    if (!askRequest?.question || !branchId) return;
    setOpen(true);
    handleSend(askRequest.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askRequest?.nonce]);

  const appendReply = (reply: AssistantReply) => {
    setConversationId(reply.conversation.id);
    setMessages((prev) => [...prev, reply.message]);
    setAnimatingMsgId(reply.message.id);
  };

  const handleSend = (text: string) => {
    if (!branchId) {
      toast.error("Select a branch first.");
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: tempId(),
        role: "user",
        content: text,
        pending_action: null,
        created_at: new Date().toISOString(),
      },
    ]);

    if (!conversationId) {
      startConversation.mutate(
        { branch_id: branchId, date, message: text },
        {
          onSuccess: (reply) => {
            if ("message" in reply) appendReply(reply);
          },
          onError: () => toast.error("The assistant couldn't respond. Try again."),
        },
      );
      return;
    }

    sendMessage.mutate(
      { conversationId, payload: { message: text, date } },
      {
        onSuccess: appendReply,
        onError: () => toast.error("The assistant couldn't respond. Try again."),
      },
    );
  };

  const clearPendingAction = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, pending_action: null } : m)),
    );
  };

  // Confirm/decline resolves server-side: the backend executes the action and
  // replies with the outcome message for the transcript.
  const resolveAction = async (message: AssistantMessage, applied: boolean) => {
    const action = message.pending_action;
    if (!action || !conversationId) return;
    setActionBusyId(message.id);
    try {
      const { confirmAssistantAction } = await import("@/services/assistant/service");
      const result = await confirmAssistantAction(conversationId, {
        applied,
        message_id: message.id,
      });
      clearPendingAction(message.id);
      setMessages((prev) => [...prev, result.message]);
      setAnimatingMsgId(result.message.id);
      if (result.applied) {
        toast.success(result.summary || action.summary);
        onActionApplied?.(action);
      } else if (applied) {
        toast.error(result.summary || "That change couldn't be applied.");
      }
    } catch {
      toast.error("Couldn't resolve that action. Try again.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleConfirm = (message: AssistantMessage) => resolveAction(message, true);

  const handleDismiss = (message: AssistantMessage) => resolveAction(message, false);

  const subtitle =
    suggested.data?.phase === "LIVE"
      ? "Live service"
      : suggested.data?.phase === "CLOSED"
        ? "End of day"
        : "Morning planning";

  return (
    <>
      {/* Compact floating launcher — a small button that frees the page corner
          for clickable content. Opens the same slide-in drawer. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open PrepIQ Assistant"
          title="PrepIQ Assistant"
          className="fixed bottom-6 right-6 z-9990 flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold text-base font-bold text-surface-1 shadow-2xl transition-colors hover:bg-brand-gold-hover"
        >
          IQ
        </button>
      ) : null}

      <AssistantDrawer
        open={open}
        onClose={handleClose}
        title="PrepIQ Assistant"
        subtitle={subtitle}
      >
        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:#2A2A2E_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A2A2E]"
        >
          {messages.length === 0 ? (
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold">
                IQ
              </div>
              <p className="text-sm text-text-secondary">{greeting}</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <AssistantMessageBubble
                  message={message}
                  animateIn={message.id === animatingMsgId && message.role === "assistant"}
                  onAnimationDone={() =>
                    setAnimatingMsgId((current) => (current === message.id ? null : current))
                  }
                />
                {message.pending_action ? (
                  <PendingActionConfirm
                    action={message.pending_action}
                    busy={actionBusyId === message.id}
                    onConfirm={() => handleConfirm(message)}
                    onDismiss={() => handleDismiss(message)}
                  />
                ) : null}
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 px-1">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold">
                IQ
              </div>
              <span className="text-xs text-text-muted">Thinking…</span>
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-text-muted"
                    style={{ animation: `thinking-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </span>
            </div>
          ) : null}
        </div>

        <SuggestedQuestions questions={questions} onPick={handleSend} disabled={sending} />
        <AssistantInput onSend={handleSend} disabled={sending} />

        {/* Disclaimer */}
        <p className="border-t border-surface-4 px-4 py-2 text-center text-[11px] text-text-disabled">
          AI can make mistakes · The more you use PrepIQ, the smarter it learns your kitchen
        </p>
      </AssistantDrawer>
    </>
  );
}
