"use client";

import { useEffect, useState } from "react";
import type { AssistantMessage as AssistantMessageType } from "@/services/assistant/types";
import { AssistantMarkdown } from "./assistant-markdown";

/**
 * Receipt for writes the assistant applied on its own during a turn.
 *
 * Deliberately not a card and deliberately not interactive: the change is
 * already saved, so anything resembling the confirm affordance below it would
 * invite a second look at a decision that is closed. It reads as a log line
 * under the reply — enough for the manager to see exactly what moved, and to
 * find it in the audit trail if it was wrong.
 */
function AppliedActions({ message }: { message: AssistantMessageType }) {
  const applied = message.applied_actions ?? [];
  if (applied.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {applied.map((action) => (
        <li
          key={action.action_log_id}
          className="flex items-start gap-1.5 text-xs leading-snug text-text-secondary"
        >
          <span aria-hidden className="mt-px shrink-0 text-status-success">
            ✓
          </span>
          <span className="min-w-0 break-words">
            <span className="sr-only">Applied: </span>
            {action.summary}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AssistantMessageBubble({
  message,
  animateIn,
  onAnimationDone,
}: {
  message: AssistantMessageType;
  animateIn?: boolean;
  onAnimationDone?: () => void;
}) {
  const isUser = message.role === "user";
  const fullText = message.content ?? "";

  const [displayed, setDisplayed] = useState(animateIn && !isUser ? "" : fullText);

  useEffect(() => {
    if (!animateIn || isUser) {
      setDisplayed(fullText);
      return;
    }
    setDisplayed("");
    if (!fullText.length) {
      onAnimationDone?.();
      return;
    }
    let i = 0;
    // ~14ms per char ≈ 70 chars/sec — feels like ChatGPT
    const id = setInterval(() => {
      i++;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(id);
        onAnimationDone?.();
      }
    }, 14);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, animateIn]);

  // Phase-change markers: a centered, muted "system info" chip, deliberately
  // unlike the user (gold) and assistant (IQ) bubbles.
  if (message.role === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full border border-surface-4 bg-surface-2 px-3 py-1 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
          {fullText}
        </span>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-xl rounded-br-md bg-brand-gold px-3.5 py-2.5 text-sm leading-relaxed text-surface-1">
          {fullText}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold">
        IQ
      </div>
      <div className="max-w-[82%] min-w-0">
        <div className="rounded-xl rounded-bl-md border border-surface-4 bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-text-primary">
          {displayed.length >= fullText.length ? (
            // Full text is in — render real markdown (links, nested lists,
            // code, etc.) instead of the raw, still-typing string.
            <AssistantMarkdown content={fullText} />
          ) : (
            <div className="whitespace-pre-wrap break-words">{displayed}</div>
          )}
        </div>
        <AppliedActions message={message} />
      </div>
    </div>
  );
}
