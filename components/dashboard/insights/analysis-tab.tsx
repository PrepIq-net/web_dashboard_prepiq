"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BinMinusIn,
  Calendar,
  EditPencil,
  Plus,
  WarningTriangle,
} from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { Spinner } from "@/components/ui/spinner";
import { AssistantInput } from "@/components/assistant/assistant-input";
import {
  useAnalystThread,
  useAnalystThreads,
  useCreateAnalystThread,
  useDeleteAnalystThread,
  useOpenAnalystWeek,
  useRenameAnalystThread,
  useRetireAnalystMemory,
  useSendAnalystTurn,
} from "@/services/insights/hooks";
import type {
  AnalystMemory,
  AnalystMessage,
  AnalystThread,
} from "@/services/insights/types";

export function AnalysisTab({ branchId }: { branchId: string }) {
  const { t } = useTranslation();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const threadsQuery = useAnalystThreads(branchId);
  const threadQuery = useAnalystThread(branchId, activeThreadId ?? undefined);

  const createThread = useCreateAnalystThread(branchId);
  const openWeek = useOpenAnalystWeek(branchId);
  const sendTurn = useSendAnalystTurn(branchId);

  const threads = threadsQuery.data?.threads ?? [];
  const memories = threadsQuery.data?.memories ?? [];

  // Land on the most recent thread rather than an empty pane, but never
  // override a thread the manager picked — hence the "only when nothing is
  // selected" guard rather than syncing on every list change.
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) setActiveThreadId(threads[0].id);
  }, [threads, activeThreadId]);

  /*
   * mutateAsync rejects on failure even though the hook's onError has already
   * shown the toast, so both of these swallow it deliberately. Letting it
   * escape would surface as an unhandled rejection for an error the manager
   * has already been told about.
   */
  const handleNewThread = async () => {
    try {
      const thread = await createThread.mutateAsync(undefined);
      setActiveThreadId(thread.id);
    } catch {
      /* reported by the mutation's onError */
    }
  };

  const handleOpenWeek = async () => {
    try {
      const result = await openWeek.mutateAsync();
      setActiveThreadId(result.thread.id);
    } catch {
      /* reported by the mutation's onError */
    }
  };

  if (threadsQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-8">
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleNewThread}
            disabled={createThread.isPending}
            className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-surface-4 px-3 text-sm text-text-secondary transition-colors hover:border-surface-4 hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 disabled:opacity-60"
          >
            {createThread.isPending ? <Spinner /> : <Plus width={15} height={15} />}
            {t("workspace.insights.analysis.newThread")}
          </button>

          {/*
            The one gold element in this rail: not a second peer to "New
            conversation" but a standing shortcut, always visible rather than
            buried in the empty state, so a manager reaches for it every
            Monday rather than only on their very first visit.
          */}
          <button
            type="button"
            onClick={handleOpenWeek}
            disabled={openWeek.isPending}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-brand-gold/25 bg-brand-gold/[0.06] px-3 py-2 text-left transition-colors hover:bg-brand-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-gold">
              {openWeek.isPending ? (
                <Spinner />
              ) : (
                <Calendar width={14} height={14} />
              )}
              {t("workspace.insights.analysis.openWeek")}
            </span>
            <span className="text-xs leading-snug text-text-muted">
              {t("workspace.insights.analysis.openWeekHint")}
            </span>
          </button>
        </div>

        {threadsQuery.isError ? (
          <ErrorNotice
            message={t("workspace.insights.analysis.loadError")}
            onRetry={() => threadsQuery.refetch()}
          />
        ) : (
          <>
            <ThreadList
              threads={threads}
              activeId={activeThreadId}
              branchId={branchId}
              onSelect={setActiveThreadId}
              onDeleted={(id) => {
                if (id === activeThreadId) setActiveThreadId(null);
              }}
            />

            <MemoryList memories={memories} branchId={branchId} />
          </>
        )}
      </aside>

      <section className="min-w-0">
        {activeThreadId ? (
          <Transcript
            key={activeThreadId}
            branchId={branchId}
            threadId={activeThreadId}
            messages={threadQuery.data?.messages ?? []}
            summarizedTurns={threadQuery.data?.summarized_turns ?? 0}
            isLoading={threadQuery.isLoading}
            isError={threadQuery.isError}
            onRetry={() => threadQuery.refetch()}
            isSending={sendTurn.isPending}
            onSend={(message) =>
              sendTurn.mutate({ threadId: activeThreadId, message })
            }
          />
        ) : (
          <StartState />
        )}
      </section>
    </div>
  );
}

// ── Error notice ────────────────────────────────────────────────────────────
//
// The standard alert pattern from DESIGN.md §8: a 4px left border in the
// status color, message in text-primary. Used wherever a read query fails —
// which used to fail silently into the same copy as a legitimate empty list.

function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border-l-4 border-status-critical bg-surface-2 py-2.5 pl-3 pr-2.5">
      <p className="flex items-start gap-2 text-sm text-text-primary">
        <WarningTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" />
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 whitespace-nowrap rounded text-xs font-medium text-brand-gold transition-colors hover:text-brand-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
      >
        {t("workspace.insights.analysis.retry")}
      </button>
    </div>
  );
}

// ── Thread list ─────────────────────────────────────────────────────────────

function ThreadList({
  threads,
  activeId,
  branchId,
  onSelect,
  onDeleted,
}: {
  threads: AnalystThread[];
  activeId: string | null;
  branchId: string;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const rename = useRenameAnalystThread(branchId);
  const remove = useDeleteAnalystThread(branchId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (threads.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        {t("workspace.insights.analysis.noThreads")}
      </p>
    );
  }

  const commitRename = (threadId: string) => {
    const title = draft.trim();
    if (title) rename.mutate({ threadId, title });
    setEditingId(null);
  };

  return (
    <div>
      <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-text-muted">
        {t("workspace.insights.analysis.threads")}
      </p>
      <ul className="space-y-1">
        {threads.map((thread) => {
          const isActive = thread.id === activeId;
          return (
            <li key={thread.id} className="group relative">
              {editingId === thread.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commitRename(thread.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename(thread.id);
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  className="h-8 w-full rounded-md border border-brand-gold/40 bg-surface-2 px-2 text-sm text-text-primary outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(thread.id)}
                  className={`flex w-full items-baseline gap-2 rounded-md border-l-2 py-2 pl-2.5 pr-14 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 ${
                    isActive
                      ? "border-brand-gold bg-surface-3/70 text-text-primary"
                      : "border-transparent text-text-secondary hover:bg-surface-3/40 hover:text-text-primary"
                  }`}
                >
                  <span className="truncate">
                    {thread.title || t("workspace.insights.analysis.untitled")}
                  </span>
                </button>
              )}

              {editingId === thread.id ? null : (
                <div className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex group-focus-within:flex">
                  <IconAction
                    label={t("workspace.insights.analysis.rename")}
                    onClick={() => {
                      setDraft(thread.title);
                      setEditingId(thread.id);
                    }}
                  >
                    <EditPencil width={13} height={13} />
                  </IconAction>
                  <IconAction
                    label={t("workspace.insights.analysis.delete")}
                    onClick={() => {
                      remove.mutate(thread.id);
                      onDeleted(thread.id);
                    }}
                  >
                    <BinMinusIn width={13} height={13} />
                  </IconAction>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
    >
      {children}
    </button>
  );
}

// ── Standing instructions ───────────────────────────────────────────────────

function MemoryList({
  memories,
  branchId,
}: {
  memories: AnalystMemory[];
  branchId: string;
}) {
  const { t } = useTranslation();
  const retire = useRetireAnalystMemory(branchId);

  if (memories.length === 0) return null;

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-text-muted">
        <Bell width={12} height={12} />
        {t("workspace.insights.analysis.watching")}
      </p>
      <ul className="space-y-4">
        {memories.map((memory) => (
          <li key={memory.id} className="group">
            <div className="flex items-start justify-between gap-2">
              {/*
                The restatement, not the raw sentence: this is how the
                instruction was actually parsed, and a misread memory is only
                discoverable by seeing it.
              */}
              <p className="text-[13px] leading-snug text-text-secondary">
                {memory.restatement || memory.user_instruction}
              </p>
              <button
                type="button"
                onClick={() => retire.mutate(memory.id)}
                aria-label={t("workspace.insights.analysis.stopWatching")}
                title={t("workspace.insights.analysis.stopWatching")}
                className="hidden shrink-0 text-text-muted transition-colors hover:text-text-primary group-hover:block group-focus-within:block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              >
                <BinMinusIn width={13} height={13} />
              </button>
            </div>
            {memory.latest_update ? (
              <p
                className={`mt-1 border-l-2 pl-2 text-[12px] leading-snug ${
                  memory.last_triggered_on
                    ? "border-status-warning text-text-secondary"
                    : "border-surface-4 text-text-muted"
                }`}
              >
                {memory.latest_update}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Transcript ──────────────────────────────────────────────────────────────

function Transcript({
  messages,
  summarizedTurns,
  isLoading,
  isError,
  onRetry,
  isSending,
  onSend,
}: {
  branchId: string;
  threadId: string;
  messages: AnalystMessage[];
  summarizedTurns: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isSending: boolean;
  onSend: (message: string) => void;
}) {
  const { t } = useTranslation();
  /*
   * The turn in flight, held locally.
   *
   * The transcript only refetches once the model has answered, which takes
   * seconds. Without this the manager's own message disappears the instant
   * they send it and reappears with the reply — it reads as though the send
   * failed, and they send again.
   */
  const [inFlight, setInFlight] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isSending]);

  // Cleared only once the refetched transcript actually contains the turn, so
  // the message never blinks out between the reply landing and the list
  // catching up.
  useEffect(() => {
    if (!isSending) setInFlight(null);
  }, [isSending, messages.length]);

  const handleSend = (text: string) => {
    if (isSending) return;
    setInFlight(text);
    onSend(text);
  };

  return (
    <div className="flex h-[calc(100vh-22rem)] min-h-[26rem] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <ErrorNotice
            message={t("workspace.insights.analysis.loadThreadError")}
            onRetry={onRetry}
          />
        ) : (
          <>
            {/*
              Said out loud rather than silently dropped: a thread that opens
              mid-conversation otherwise looks like it lost its own beginning.
            */}
            {summarizedTurns > 0 ? (
              <p className="mb-8 text-center text-xs text-text-muted">
                {t("workspace.insights.analysis.summarized", {
                  count: String(summarizedTurns),
                })}
              </p>
            ) : null}

            <div className="space-y-6">
              {messages.map((message) => (
                <Bubble key={message.id} message={message} />
              ))}
              {inFlight ? (
                <Bubble
                  message={{
                    id: "in-flight",
                    role: "user",
                    content: inFlight,
                    created_at: "",
                  }}
                />
              ) : null}
              {isSending ? <Thinking /> : null}
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-2 border-t border-surface-4/60">
        <AssistantInput
          onSend={handleSend}
          disabled={isSending || isLoading || isError}
          placeholder={t("workspace.insights.analysis.placeholder")}
        />
      </div>
    </div>
  );
}

// Visual language matches the Today assistant drawer (components/assistant) —
// same gold "IQ" avatar, same bubble shapes and colors — so the analyst reads
// as one product wearing two hats, not two different chat widgets. Content
// rendering deliberately does not: this stays whitespace-pre-wrap rather than
// picking up assistant-message.tsx's bold/bullet/table parser, since model
// output here is untrusted and plain text is the smaller surface.
function Bubble({ message }: { message: AnalystMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-xl rounded-br-md bg-brand-gold px-3.5 py-2.5 text-sm leading-relaxed text-surface-1">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5">
      <IQAvatar />
      <div className="min-w-0 max-w-[82%] rounded-xl rounded-bl-md border border-surface-4 bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed text-text-primary">
        <p className="min-w-0 whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function Thinking() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 px-1">
      <IQAvatar />
      <span className="text-xs text-text-muted">
        {t("workspace.insights.analysis.thinking")}
      </span>
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
  );
}

function IQAvatar() {
  return (
    <div
      aria-hidden
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-[11px] font-bold text-brand-gold"
    >
      IQ
    </div>
  );
}

function StartState() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2.5 py-8">
      <IQAvatar />
      <div>
        <p className="text-base font-medium text-text-primary">
          {t("workspace.insights.analysis.startTitle")}
        </p>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">
          {t("workspace.insights.analysis.startBody")}
        </p>
      </div>
    </div>
  );
}
