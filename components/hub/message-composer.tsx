"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Attachment, Box, SendDiagonal, Sparks, Xmark } from "iconoir-react";
import { useHubShareables, type ShareableObject } from "@/services/hub";
import {
  filterMentionTargets,
  getActiveMentionContext,
  getMentionGhost,
  insertMentionToken,
  MentionedText,
  type HubMentionTarget,
} from "./hub-mentions";

const TYPING_IDLE_MS = 2500;

export function MessageComposer({
  onSend,
  onTyping,
  sending,
  assistantAvailable,
  mentionTargets,
}: {
  onSend: (input: {
    content: string;
    attachments: File[];
    references: { ref_type: string; object_id: string }[];
  }) => void;
  onTyping: (isTyping: boolean) => void;
  sending: boolean;
  assistantAvailable: boolean;
  mentionTargets: HubMentionTarget[];
}) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [references, setReferences] = useState<ShareableObject[]>([]);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [shareQuery, setShareQuery] = useState("");
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [cursor, setCursor] = useState({ start: 0, end: 0 });
  const [mirrorScrollTop, setMirrorScrollTop] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef<{ active: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    active: false,
    timer: null,
  });

  const shareables = useHubShareables(shareQuery, sharePickerOpen);

  useEffect(() => {
    return () => {
      if (typingRef.current.timer) clearTimeout(typingRef.current.timer);
    };
  }, []);

  const activeMention = useMemo(
    () => getActiveMentionContext(content, cursor.end),
    [content, cursor.end],
  );

  const mentionSuggestions = useMemo(
    () => filterMentionTargets(mentionTargets, activeMention?.query ?? ""),
    [activeMention?.query, mentionTargets],
  );

  const mentionGhost = useMemo(
    () => getMentionGhost(activeMention, mentionSuggestions, activeMentionIndex),
    [activeMention, activeMentionIndex, mentionSuggestions],
  );

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [activeMention?.query]);

  function signalTyping() {
    if (!typingRef.current.active) {
      typingRef.current.active = true;
      onTyping(true);
    }
    if (typingRef.current.timer) clearTimeout(typingRef.current.timer);
    typingRef.current.timer = setTimeout(() => {
      typingRef.current.active = false;
      onTyping(false);
    }, TYPING_IDLE_MS);
  }

  function stopTyping() {
    if (typingRef.current.timer) clearTimeout(typingRef.current.timer);
    if (typingRef.current.active) {
      typingRef.current.active = false;
      onTyping(false);
    }
  }

  function submit() {
    const trimmed = content.trim();
    if (!trimmed && files.length === 0 && references.length === 0) return;
    stopTyping();
    onSend({
      content: trimmed,
      attachments: files,
      references: references.map((r) => ({
        ref_type: r.ref_type,
        object_id: r.object_id,
      })),
    });
    setContent("");
    setFiles([]);
    setReferences([]);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.focus();
    });
  }

  function updateCursor(target: HTMLTextAreaElement) {
    setCursor({
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    });
  }

  function syncTextareaHeight(target?: HTMLTextAreaElement | null) {
    const textarea = target ?? textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }

  function pickMention(target: HubMentionTarget) {
    if (!activeMention) return;
    const suffix = content.slice(activeMention.end);
    // Land the caret after the space that follows the token (inserted or pre-existing).
    const advance = /^\s/.test(suffix) ? (suffix.startsWith(" ") ? 1 : 0) : 1;
    const next = insertMentionToken(content, activeMention.start, activeMention.end, target.token);
    setContent(next);
    setActiveMentionIndex(0);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const nextCursor = activeMention.start + target.token.length + advance;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
      updateCursor(textarea);
      syncTextareaHeight(textarea);
    });
  }

  function mentionAssistant() {
    const shouldInsert = !content.toLowerCase().includes("@prepiq");
    if (shouldInsert) {
      setContent((value) => `@PrepIQ ${value}`);
    }
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const nextValue = textarea.value;
      const insertionIndex = nextValue.toLowerCase().indexOf("@prepiq");
      const nextCursor =
        insertionIndex >= 0 ? insertionIndex + "@PrepIQ ".length : nextValue.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
      updateCursor(textarea);
      syncTextareaHeight(textarea);
    });
  }

  return (
    <div className="border-t border-surface-4 p-3">
      {(files.length > 0 || references.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="flex items-center gap-1.5 rounded-lg bg-surface-3 px-2.5 py-1 text-xs text-text-secondary"
            >
              <Attachment className="h-3.5 w-3.5" />
              {file.name}
              <button
                type="button"
                onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                className="text-text-muted hover:text-status-critical"
              >
                <Xmark className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {references.map((reference) => (
            <span
              key={`${reference.ref_type}-${reference.object_id}`}
              className="flex items-center gap-1.5 rounded-lg bg-brand-gold/10 px-2.5 py-1 text-xs text-brand-gold"
            >
              <Box className="h-3.5 w-3.5" />
              {reference.title}
              <button
                type="button"
                onClick={() =>
                  setReferences((list) =>
                    list.filter((r) => r.object_id !== reference.object_id),
                  )
                }
                className="hover:text-status-critical"
              >
                <Xmark className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            if (selected.length) setFiles((list) => [...list, ...selected]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          title="Attach files"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
        >
          <Attachment className="h-4.5 w-4.5" />
        </button>

        <div className="relative">
          <button
            type="button"
            title="Share an operational item"
            onClick={() => setSharePickerOpen((open) => !open)}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-3 ${
              sharePickerOpen ? "text-brand-gold" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Box className="h-4.5 w-4.5" />
          </button>
          {sharePickerOpen ? (
            <div className="absolute bottom-11 left-0 z-20 w-80 rounded-xl border border-border-default bg-surface-2 p-2 shadow-[var(--shadow-level-2)]">
              <input
                autoFocus
                value={shareQuery}
                onChange={(event) => setShareQuery(event.target.value)}
                placeholder="Search forecasts, inventory, batches…"
                className="w-full rounded-lg border border-border-default bg-surface-3 px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand-gold focus:outline-none"
              />
              <div className="mt-1 max-h-56 overflow-y-auto">
                {(shareables.data ?? []).map((item) => (
                  <button
                    key={`${item.ref_type}-${item.object_id}`}
                    type="button"
                    onClick={() => {
                      setReferences((list) =>
                        list.some((r) => r.object_id === item.object_id)
                          ? list
                          : [...list, item],
                      );
                      setSharePickerOpen(false);
                      setShareQuery("");
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                ))}
                {shareables.isFetching ? (
                  <p className="px-2.5 py-2 text-xs text-text-muted">Searching…</p>
                ) : (shareables.data ?? []).length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-text-muted">
                    {shareQuery
                      ? "Nothing found."
                      : "Type to search operational items to share."}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {assistantAvailable ? (
          <button
            type="button"
            title="Ask PrepIQ"
            onClick={mentionAssistant}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-brand-gold"
          >
            <Sparks className="h-4.5 w-4.5" />
          </button>
        ) : null}

        <div className="relative flex-1 overflow-hidden rounded-lg border border-border-default bg-surface-3">
          {content ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2 text-sm leading-relaxed text-text-primary"
              style={{ transform: `translateY(-${mirrorScrollTop}px)` }}
            >
              {mentionGhost ? (
                <>
                  <MentionedText
                    text={content.slice(0, mentionGhost.at)}
                    targets={mentionTargets}
                    className="text-text-primary"
                    mentionClassName="rounded bg-brand-gold/15 text-brand-gold box-decoration-clone"
                  />
                  <span className="text-text-disabled">{mentionGhost.remainder}</span>
                  <MentionedText
                    text={content.slice(mentionGhost.at)}
                    targets={mentionTargets}
                    className="text-text-primary"
                    mentionClassName="rounded bg-brand-gold/15 text-brand-gold box-decoration-clone"
                  />
                </>
              ) : (
                <MentionedText
                  text={content}
                  targets={mentionTargets}
                  className="text-text-primary"
                  mentionClassName="rounded bg-brand-gold/15 text-brand-gold box-decoration-clone"
                />
              )}
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={content}
            rows={1}
            placeholder="Message… (@PrepIQ to ask the assistant)"
            onChange={(event) => {
              setContent(event.target.value);
              signalTyping();
              updateCursor(event.currentTarget);
              syncTextareaHeight(event.currentTarget);
            }}
            onSelect={(event) => updateCursor(event.currentTarget)}
            onClick={(event) => updateCursor(event.currentTarget)}
            onKeyUp={(event) => updateCursor(event.currentTarget)}
            onScroll={(event) => setMirrorScrollTop(event.currentTarget.scrollTop)}
            onKeyDown={(event) => {
              if (mentionSuggestions.length > 0 && activeMention) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveMentionIndex((index) => (index + 1) % mentionSuggestions.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveMentionIndex(
                    (index) => (index - 1 + mentionSuggestions.length) % mentionSuggestions.length,
                  );
                  return;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  pickMention(mentionSuggestions[activeMentionIndex] ?? mentionSuggestions[0]);
                  return;
                }
                if (event.key === "Escape") {
                  setActiveMentionIndex(0);
                  return;
                }
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            onBlur={stopTyping}
            className="relative z-10 max-h-36 min-h-9 w-full resize-none border-0 bg-transparent px-3 py-2 text-sm leading-relaxed text-transparent caret-brand-gold placeholder:text-text-disabled focus:outline-none"
            style={{ caretColor: "#A8821F" }}
          />

          {mentionSuggestions.length > 0 && activeMention ? (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-80 rounded-xl border border-border-default bg-surface-2 p-2 shadow-[var(--shadow-level-2)]">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-disabled">
                Mention
              </p>
              <div className="max-h-56 overflow-y-auto">
                {mentionSuggestions.map((target, index) => {
                  const active = index === activeMentionIndex;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pickMention(target)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        active ? "bg-brand-gold/10" : "hover:bg-surface-3"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                          target.kind === "assistant"
                            ? "bg-brand-gold/15 text-brand-gold"
                            : "bg-surface-4 text-text-secondary"
                        }`}
                      >
                        {target.kind === "assistant" ? "AI" : target.label[0]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-primary">
                          {target.label}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {target.kind === "assistant" ? "PrepIQ assistant" : target.subtitle}
                        </span>
                      </span>
                      {active ? (
                        <span className="rounded border border-border-default px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                          Tab
                        </span>
                      ) : (
                        <span className="text-xs text-text-disabled">{target.token}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          disabled={sending}
          onClick={submit}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gold text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
        >
          <SendDiagonal className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}
