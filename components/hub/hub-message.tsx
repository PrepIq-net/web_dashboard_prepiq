"use client";

import Link from "next/link";
import { Sparks } from "iconoir-react";
import type { HubMessage, MessageAction } from "@/services/hub";
import { AttachmentView } from "./attachment-view";
import { MentionedText, type HubMentionTarget } from "./hub-mentions";
import { ReferenceCard } from "./reference-card";
import { formatTime, fullName, initials } from "./hub-utils";

/** Centered chip for injected operational timeline events. */
function EventChip({ message }: { message: HubMessage }) {
  return (
    <div className="my-3 flex justify-center px-4">
      <div className="max-w-lg rounded-full bg-surface-3 px-4 py-1.5 text-center text-xs text-text-muted">
        <span className="mr-2 text-text-disabled">{formatTime(message.created_at)}</span>
        {message.content}
      </div>
    </div>
  );
}

function ActionButtons({
  message,
  onExecuteAction,
  executing,
}: {
  message: HubMessage;
  onExecuteAction: (messageId: string, action: MessageAction) => void;
  executing: string | null;
}) {
  const actions = message.metadata.actions ?? [];
  const state = message.metadata.actions_state ?? {};
  if (actions.length === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {actions.map((action) => {
        const executed = state[action.id];
        if (executed) {
          return (
            <span
              key={action.id}
              className="rounded-lg bg-surface-4 px-3 py-1.5 text-xs text-text-muted"
            >
              ✓ {action.label} — {executed.executed_by_name}
            </span>
          );
        }
        if (action.action_type === "OPEN_LINK") {
          return (
            <Link
              key={action.id}
              href={action.params.href ?? "#"}
              className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold"
            >
              {action.label}
            </Link>
          );
        }
        const isPrimary = action.style === "primary";
        return (
          <button
            key={action.id}
            type="button"
            disabled={executing === action.id}
            onClick={() => onExecuteAction(message.id, action)}
            className={
              isPrimary
                ? "rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-medium text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-60"
                : "rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-gold hover:text-brand-gold disabled:opacity-60"
            }
          >
            {executing === action.id ? "…" : action.label}
          </button>
        );
      })}
    </div>
  );
}

export function HubMessageRow({
  message,
  showSender,
  mediaOrigin,
  mentionTargets,
  onExecuteAction,
  executingAction,
}: {
  message: HubMessage;
  showSender: boolean;
  mediaOrigin: string;
  mentionTargets: HubMentionTarget[];
  onExecuteAction: (messageId: string, action: MessageAction) => void;
  executingAction: string | null;
}) {
  // System timeline entries render as centered chips, not bubbles — unless
  // they carry actions, in which case they get an alert-style block.
  if (message.sender_kind === "SYSTEM" && message.message_type === "EVENT") {
    return <EventChip message={message} />;
  }

  if (message.sender_kind === "SYSTEM" && message.message_type === "ACTION") {
    return (
      <div className="my-3 px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-status-warning/40 bg-surface-3 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-status-warning">
            System alert · {formatTime(message.created_at)}
          </p>
          <p className="mt-1 text-sm text-text-primary">
            <MentionedText
              text={message.content}
              targets={mentionTargets}
              className="whitespace-pre-wrap break-words"
              mentionClassName="rounded-md bg-brand-gold/15 px-1.5 py-0.5 text-brand-gold"
            />
          </p>
          {message.references.map((reference) => (
            <ReferenceCard key={reference.id} reference={reference} />
          ))}
          <ActionButtons
            message={message}
            onExecuteAction={onExecuteAction}
            executing={executingAction}
          />
        </div>
      </div>
    );
  }

  const isAssistant = message.sender_kind === "ASSISTANT";
  const alignRight = message.is_me && !isAssistant;

  return (
    <div className={`flex gap-2.5 px-4 py-1 ${alignRight ? "flex-row-reverse" : ""}`}>
      <div className="w-8 flex-shrink-0">
        {showSender ? (
          isAssistant ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
              <Sparks className="h-4 w-4" />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-4 text-xs font-medium text-text-secondary">
              {initials(message.sender)}
            </span>
          )
        ) : null}
      </div>
      <div className={`min-w-0 max-w-[75%] ${alignRight ? "items-end text-right" : ""}`}>
        {showSender ? (
          <p className={`mb-0.5 text-xs text-text-muted ${alignRight ? "text-right" : ""}`}>
            {isAssistant ? "PrepIQ Assistant" : fullName(message.sender)}
            <span className="ml-2 text-text-disabled">{formatTime(message.created_at)}</span>
          </p>
        ) : null}
        {message.reply_to ? (
          <div className="mb-1 rounded-lg border-l-2 border-brand-gold bg-surface-3 px-2.5 py-1 text-left">
            <p className="text-[11px] text-text-muted">{fullName(message.reply_to.sender)}</p>
            <p className="truncate text-xs text-text-secondary">
              <MentionedText
                text={message.reply_to.content}
                targets={mentionTargets}
                className="inline"
                mentionClassName="rounded-md bg-brand-gold/15 px-1.5 py-0.5 text-brand-gold"
              />
            </p>
          </div>
        ) : null}
        {message.content ? (
          <div
            className={`inline-block rounded-xl px-3.5 py-2 text-left text-sm leading-relaxed whitespace-pre-wrap break-words ${
              alignRight
                ? "bg-brand-gold/15 text-text-primary"
                : isAssistant
                  ? "border border-brand-gold/30 bg-surface-3 text-text-primary"
                : "bg-surface-3 text-text-primary"
            } ${message.pending ? "opacity-60" : ""}`}
          >
            <MentionedText
              text={message.content}
              targets={mentionTargets}
              className="whitespace-pre-wrap break-words"
              mentionClassName="rounded-md bg-brand-gold/15 px-1.5 py-0.5 text-brand-gold"
            />
          </div>
        ) : null}
        <div className={alignRight ? "flex flex-col items-end" : ""}>
          {message.attachments.map((attachment) => (
            <AttachmentView
              key={attachment.id}
              attachment={attachment}
              mediaOrigin={mediaOrigin}
            />
          ))}
          {message.references.map((reference) => (
            <ReferenceCard key={reference.id} reference={reference} />
          ))}
        </div>
        <ActionButtons
          message={message}
          onExecuteAction={onExecuteAction}
          executing={executingAction}
        />
      </div>
    </div>
  );
}
