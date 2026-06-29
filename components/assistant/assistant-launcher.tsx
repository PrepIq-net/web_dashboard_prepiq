"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Xmark } from "iconoir-react";

import {
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

export type ApplyActionResult = { applied: boolean; summary: string };

export type AssistantLauncherProps = {
  branchId?: string;
  date: string;
  /** Optional executor that applies a confirmed action via existing mutations. */
  onApplyAction?: (action: PendingAction) => Promise<ApplyActionResult>;
  /** Set by the parent to open the drawer seeded with an explanation. */
  explainRequest?: { topic: string; nonce: number } | null;
};

let TEMP_ID = 0;
const tempId = () => `temp-${TEMP_ID++}`;

export function AssistantLauncher({
  branchId,
  date,
  onApplyAction,
  explainRequest,
}: AssistantLauncherProps) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const suggested = useSuggestedQuestions(branchId, date);
  const startConversation = useStartAssistantConversation();
  const sendMessage = useSendAssistantMessage();
  const explain = useExplainAlert();

  const sending = startConversation.isPending || sendMessage.isPending || explain.isPending;
  const greeting = suggested.data?.greeting ?? "I've prepared today's briefing.";
  const questions = suggested.data?.suggested_questions ?? [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Open + seed an explanation when the parent requests it (notification "Explain").
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
        },
        onError: () => toast.error("Couldn't load that explanation."),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainRequest?.nonce]);

  const appendReply = (reply: AssistantReply) => {
    setConversationId(reply.conversation.id);
    setMessages((prev) => [...prev, reply.message]);
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

  const resolveOutcome = async (action: PendingAction): Promise<ApplyActionResult> => {
    if (onApplyAction) {
      try {
        return await onApplyAction(action);
      } catch {
        return { applied: false, summary: action.summary };
      }
    }
    return { applied: false, summary: action.summary };
  };

  const finishAction = (messageId: string, applied: boolean, summary: string) => {
    clearPendingAction(messageId);
    if (!conversationId) return;
    sendMessage.reset();
    import("@/services/assistant/service").then(({ confirmAssistantAction }) => {
      confirmAssistantAction(conversationId, { applied, summary })
        .then((ack) => setMessages((prev) => [...prev, ack]))
        .catch(() => undefined);
    });
  };

  const handleConfirm = async (message: AssistantMessage) => {
    const action = message.pending_action;
    if (!action) return;
    setActionBusyId(message.id);
    const outcome = await resolveOutcome(action);
    setActionBusyId(null);
    if (outcome.applied) {
      toast.success(outcome.summary);
    } else {
      toast("Recorded — apply it from the prep plan when ready.");
    }
    finishAction(message.id, outcome.applied, outcome.summary);
  };

  const handleDismiss = (message: AssistantMessage) => {
    const action = message.pending_action;
    finishAction(message.id, false, action?.summary ?? "the proposed change");
  };

  const subtitle =
    suggested.data?.phase === "LIVE"
      ? "Live service"
      : suggested.data?.phase === "CLOSED"
        ? "End of day"
        : "Morning planning";

  return (
    <>
      {!open && !dismissed ? (
        <div className="fixed bottom-6 right-6 z-9990 w-80 max-w-[calc(100vw-3rem)]">
          <div className="rounded-xl border border-surface-4 bg-surface-2 p-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-text-primary">PrepIQ Assistant</p>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="text-text-muted transition-colors hover:text-text-primary"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-text-secondary">{greeting}</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 w-full rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover"
            >
              Open
            </button>
          </div>
        </div>
      ) : null}

      <AssistantDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="PrepIQ Assistant"
        subtitle={subtitle}
      >
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-sm text-text-secondary">{greeting}</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <AssistantMessageBubble message={message} />
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
            <p className="px-1 text-xs text-text-muted">PrepIQ is thinking…</p>
          ) : null}
        </div>

        <SuggestedQuestions questions={questions} onPick={handleSend} disabled={sending} />
        <AssistantInput onSend={handleSend} disabled={sending} />
      </AssistantDrawer>
    </>
  );
}
