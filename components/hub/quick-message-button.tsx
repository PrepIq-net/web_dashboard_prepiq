"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Box, Check, ChatBubble, SendDiagonal } from "iconoir-react";
import {
  resolveConversation,
  sendMessage,
  useHubDirectory,
  type HubUser,
  type RefType,
} from "@/services/hub";
import { fullName, initials } from "./hub-utils";

const POPOVER_WIDTH = 320;
const POPOVER_EST_HEIGHT = 430;

/**
 * "Message this" entry point for operational pages: pick teammates (one =
 * direct, several = group), add a note, and the object rides along as a
 * reference card in the Operations Hub conversation.
 */
export function QuickMessageButton({
  refType,
  objectId,
  title,
  label,
  className = "",
}: {
  refType: RefType;
  objectId: string;
  title: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({
    left: 0,
  });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Map<string, HubUser>>(new Map());
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sentConversationId, setSentConversationId] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const directory = useHubDirectory(query, open);
  const entries = directory.data ?? [];

  function openPopover() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(
      Math.max(8, rect.right - POPOVER_WIDTH),
      Math.max(8, window.innerWidth - POPOVER_WIDTH - 8),
    );
    if (
      window.innerHeight - rect.bottom > POPOVER_EST_HEIGHT ||
      rect.top < POPOVER_EST_HEIGHT
    ) {
      setPos({ top: rect.bottom + 8, left });
    } else {
      setPos({ bottom: window.innerHeight - rect.top + 8, left });
    }
    setQuery("");
    setSelected(new Map());
    setNote("");
    setStatus("idle");
    setSentConversationId(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Sent: leave the confirmation up briefly, then close on its own.
  useEffect(() => {
    if (status !== "sent") return;
    const timer = setTimeout(() => setOpen(false), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  function toggleRecipient(user: HubUser) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(user.id)) next.delete(user.id);
      else next.set(user.id, user);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0 || status === "sending") return;
    setStatus("sending");
    try {
      const conversation = await resolveConversation({
        participant_ids: Array.from(selected.keys()),
        include_assistant: false,
      });
      await sendMessage(conversation.id, {
        content: note.trim(),
        clientId: crypto.randomUUID(),
        references: [{ ref_type: refType, object_id: objectId }],
      });
      setSentConversationId(conversation.id);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={`Message a teammate about ${title}`}
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={
          className ||
          "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-text-muted transition-colors hover:bg-brand-gold/10 hover:text-brand-gold"
        }
      >
        <ChatBubble className="h-3.5 w-3.5" />
        {label ?? null}
      </button>

      {open
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-[100] w-80 rounded-xl border border-border-default bg-surface-2 p-3 shadow-[var(--shadow-level-2)]"
              style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
            >
              {status === "sent" ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-status-ok/15 text-status-ok">
                    <Check className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-text-primary">
                    Sent to {selected.size} {selected.size === 1 ? "person" : "people"}
                  </p>
                  <Link
                    href={
                      sentConversationId
                        ? `/workspace/chat?conversation=${sentConversationId}`
                        : "/workspace/chat"
                    }
                    className="text-xs font-medium text-brand-gold hover:underline"
                  >
                    Open in Operations Hub →
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                    Message a teammate
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-gold/10 px-2.5 py-1.5">
                    <Box className="h-3.5 w-3.5 flex-shrink-0 text-brand-gold" />
                    <span className="truncate text-xs font-medium text-brand-gold">{title}</span>
                  </div>

                  {selected.size > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Array.from(selected.values()).map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleRecipient(user)}
                          title="Remove"
                          className="flex items-center gap-1 rounded-full bg-surface-4 px-2 py-0.5 text-[11px] text-text-secondary hover:text-status-critical"
                        >
                          {fullName(user)} ×
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search teammates…"
                    className="mt-2 w-full rounded-lg border border-border-default bg-surface-3 px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand-gold focus:outline-none"
                  />
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {entries.map((entry) => {
                      const active = selected.has(entry.user.id);
                      return (
                        <button
                          key={entry.user.id}
                          type="button"
                          onClick={() => toggleRecipient(entry.user)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                            active ? "bg-brand-gold/10" : "hover:bg-surface-3"
                          }`}
                        >
                          <span className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-4 text-[10px] font-medium text-text-secondary">
                            {initials(entry.user)}
                            {entry.online ? (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface-2 bg-status-ok" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-text-primary">
                              {fullName(entry.user)}
                            </span>
                            <span className="block truncate text-[11px] text-text-muted">
                              {entry.user.email}
                            </span>
                          </span>
                          {active ? <Check className="h-4 w-4 text-brand-gold" /> : null}
                        </button>
                      );
                    })}
                    {directory.isFetching && entries.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-text-muted">Searching…</p>
                    ) : entries.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-text-muted">No teammates found.</p>
                    ) : null}
                  </div>

                  {selected.size > 1 ? (
                    <p className="mt-1 text-[11px] text-text-muted">
                      Sends as a group conversation.
                    </p>
                  ) : null}

                  <div className="mt-2 flex items-end gap-2">
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={2}
                      placeholder="Add a note… (optional)"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          send();
                        }
                      }}
                      className="min-h-9 flex-1 resize-none rounded-lg border border-border-default bg-surface-3 px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand-gold focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={selected.size === 0 || status === "sending"}
                      onClick={send}
                      title="Send"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gold text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-40"
                    >
                      <SendDiagonal className="h-4 w-4" />
                    </button>
                  </div>
                  {status === "error" ? (
                    <p className="mt-1.5 text-[11px] text-status-critical">
                      Could not send — try again.
                    </p>
                  ) : null}
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
