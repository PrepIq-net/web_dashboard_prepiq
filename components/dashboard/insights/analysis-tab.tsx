"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BinMinusIn,
  Calendar,
  EditPencil,
  Plus,
  SendDiagonal,
  Sparks,
} from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { Spinner } from "@/components/ui/spinner";
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
            onClick={handleOpenWeek}
            disabled={openWeek.isPending}
            className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-3 text-[13px] font-medium text-brand-gold transition-colors hover:bg-brand-gold/15 disabled:opacity-60"
          >
            {openWeek.isPending ? <Spinner /> : <Calendar width={15} height={15} />}
            {t("workspace.insights.analysis.openWeek")}
          </button>
          <button
            type="button"
            onClick={handleNewThread}
            disabled={createThread.isPending}
            className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-surface-4 px-3 text-[13px] text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60"
          >
            <Plus width={15} height={15} />
            {t("workspace.insights.analysis.newThread")}
          </button>
        </div>

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
            isSending={sendTurn.isPending}
            onSend={(message) =>
              sendTurn.mutate({ threadId: activeThreadId, message })
            }
          />
        ) : (
          <StartState onOpenWeek={handleOpenWeek} pending={openWeek.isPending} />
        )}
      </section>
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
      <p className="text-[13px] text-text-muted">
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
                  className="h-8 w-full rounded-md border border-brand-gold/40 bg-surface-2 px-2 text-[13px] text-text-primary outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(thread.id)}
                  className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 pr-14 text-left text-[13px] transition-colors ${
                    isActive
                      ? "bg-surface-3 text-text-primary"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <span className="truncate">
                    {thread.title || t("workspace.insights.analysis.untitled")}
                  </span>
                </button>
              )}

              {editingId === thread.id ? null : (
                <div className="absolute right-1 top-1 hidden items-center gap-0.5 group-hover:flex">
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
      className="inline-flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
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
                className="hidden shrink-0 text-text-muted transition-colors hover:text-text-primary group-hover:block"
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
  threadId,
  messages,
  summarizedTurns,
  isLoading,
  isSending,
  onSend,
}: {
  branchId: string;
  threadId: string;
  messages: AnalystMessage[];
  summarizedTurns: number;
  isLoading: boolean;
  isSending: boolean;
  onSend: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
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

  const submit = () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setInFlight(text);
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex h-[calc(100vh-22rem)] min-h-[26rem] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            {/*
              Said out loud rather than silently dropped: a thread that opens
              mid-conversation otherwise looks like it lost its own beginning.
            */}
            {summarizedTurns > 0 ? (
              <p className="mb-8 text-center text-[12px] text-text-muted">
                {t("workspace.insights.analysis.summarized", {
                  count: String(summarizedTurns),
                })}
              </p>
            ) : null}

            <div className="space-y-8">
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

      <div className="mt-6 flex items-end gap-2 border-t border-surface-4/60 pt-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={t("workspace.insights.analysis.placeholder")}
          className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-[14px] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-gold/50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isSending || !draft.trim()}
          aria-label={t("workspace.insights.analysis.send")}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand-gold/30 bg-brand-gold/10 text-brand-gold transition-colors hover:bg-brand-gold/15 disabled:opacity-40"
        >
          <SendDiagonal width={17} height={17} />
        </button>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: AnalystMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-xl rounded-br-sm bg-surface-3 px-3.5 py-2.5 text-[14px] leading-relaxed text-text-primary">
          {message.content}
        </p>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <Sparks
        width={16}
        height={16}
        className="mt-1 shrink-0 text-brand-gold"
        aria-hidden
      />
      {/*
        whitespace-pre-wrap, not a markdown renderer: the analyst answers in
        short prose and lists, and rendering untrusted model output as markup
        is a larger surface than the formatting is worth here.
      */}
      <p className="min-w-0 whitespace-pre-wrap text-[14px] leading-relaxed text-text-secondary">
        {message.content}
      </p>
    </div>
  );
}

function Thinking() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-[13px] text-text-muted">
      <Spinner />
      {t("workspace.insights.analysis.thinking")}
    </div>
  );
}

function StartState({
  onOpenWeek,
  pending,
}: {
  onOpenWeek: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="py-16 text-center">
      <Sparks
        width={22}
        height={22}
        className="mx-auto mb-4 text-brand-gold"
        aria-hidden
      />
      <p className="text-[15px] text-text-primary">
        {t("workspace.insights.analysis.startTitle")}
      </p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-text-muted">
        {t("workspace.insights.analysis.startBody")}
      </p>
      <button
        type="button"
        onClick={onOpenWeek}
        disabled={pending}
        className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 text-[13px] font-medium text-brand-gold transition-colors hover:bg-brand-gold/15 disabled:opacity-60"
      >
        {pending ? <Spinner /> : <Calendar width={15} height={15} />}
        {t("workspace.insights.analysis.openWeek")}
      </button>
    </div>
  );
}
