"use client";

import type { AssistantMessage as AssistantMessageType } from "@/services/assistant/types";

export function AssistantMessageBubble({ message }: { message: AssistantMessageType }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-brand-gold text-surface-1"
            : "rounded-bl-md border border-surface-4 bg-surface-2 text-text-primary",
        ].join(" ")}
      >
        {message.content}
      </div>
    </div>
  );
}
