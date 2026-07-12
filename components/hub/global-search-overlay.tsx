"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Attachment,
  Box,
  ChatBubble,
  Search,
  User,
  Xmark,
} from "iconoir-react";
import { useHubGlobalSearch } from "@/services/hub";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-text-disabled">
      {children}
    </p>
  );
}

export function GlobalSearchOverlay({
  onClose,
  onOpenConversation,
  onStartDirect,
}: {
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
  onStartDirect: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useHubGlobalSearch(query);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = results.data;
  const empty =
    data &&
    data.messages.length === 0 &&
    data.attachments.length === 0 &&
    data.references.length === 0 &&
    data.conversations.length === 0 &&
    data.people.length === 0 &&
    data.objects.length === 0;

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border-default bg-surface-2 shadow-[var(--shadow-level-2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
          <Search className="h-4.5 w-4.5 text-text-muted" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages, files, forecasts, inventory, people…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none"
          />
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary">
            <Xmark className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pb-2">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              Search across conversations, document contents, operational data and
              your team.
            </p>
          ) : results.isFetching && !data ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Searching…</p>
          ) : empty ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">
              Nothing found for “{query}”.
            </p>
          ) : data ? (
            <>
              {data.conversations.length > 0 && (
                <>
                  <SectionLabel>Conversations</SectionLabel>
                  {data.conversations.map((hit) => (
                    <button
                      key={hit.conversation_id}
                      type="button"
                      onClick={() => onOpenConversation(hit.conversation_id)}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-3"
                    >
                      <ChatBubble className="h-4 w-4 flex-shrink-0 text-text-muted" />
                      <span className="truncate text-sm text-text-primary">
                        {hit.display_title}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {data.messages.length > 0 && (
                <>
                  <SectionLabel>Messages</SectionLabel>
                  {data.messages.map((hit) => (
                    <button
                      key={hit.message_id}
                      type="button"
                      onClick={() => onOpenConversation(hit.conversation_id)}
                      className="flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-3"
                    >
                      <ChatBubble className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">
                          {hit.snippet}
                        </span>
                        <span className="text-xs text-text-muted">{hit.sender_name}</span>
                      </span>
                    </button>
                  ))}
                </>
              )}

              {data.attachments.length > 0 && (
                <>
                  <SectionLabel>Files</SectionLabel>
                  {data.attachments.map((hit) => (
                    <button
                      key={hit.attachment_id}
                      type="button"
                      onClick={() => onOpenConversation(hit.conversation_id)}
                      className="flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-3"
                    >
                      <Attachment className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">
                          {hit.original_name}
                        </span>
                        {hit.snippet ? (
                          <span className="block truncate text-xs text-text-muted">
                            {hit.snippet}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {(data.references.length > 0 || data.objects.length > 0) && (
                <>
                  <SectionLabel>Operational data</SectionLabel>
                  {data.references.map((hit) => (
                    <button
                      key={hit.reference_id}
                      type="button"
                      onClick={() => onOpenConversation(hit.conversation_id)}
                      className="flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-3"
                    >
                      <Box className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-gold" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">
                          {hit.title}
                        </span>
                        <span className="text-xs text-text-muted">
                          Shared in a conversation · {hit.subtitle}
                        </span>
                      </span>
                    </button>
                  ))}
                  {data.objects.map((hit) => (
                    <Link
                      key={`${hit.ref_type}-${hit.object_id}`}
                      href={hit.deep_link || "#"}
                      onClick={onClose}
                      className="flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-3"
                    >
                      <Box className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">
                          {hit.title}
                        </span>
                        <span className="text-xs text-text-muted">{hit.subtitle}</span>
                      </span>
                    </Link>
                  ))}
                </>
              )}

              {data.people.length > 0 && (
                <>
                  <SectionLabel>People</SectionLabel>
                  {data.people.map((hit) => (
                    <button
                      key={hit.user.id}
                      type="button"
                      onClick={() => onStartDirect(hit.user.id)}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-surface-3"
                    >
                      <User className="h-4 w-4 flex-shrink-0 text-text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">
                          {hit.user.first_name} {hit.user.last_name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {hit.organization_name}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
