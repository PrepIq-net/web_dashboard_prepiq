"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Box, ChatBubble, Search, Sparks, Xmark } from "iconoir-react";
import {
  filterNavPages,
  getNavPage,
  type NavPage,
} from "@/lib/command/navigation";
import { resolvePermissions } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUserProfile } from "@/services";
import { useHubGlobalSearch } from "@/services/hub";
import {
  useConfirmAssistantAction,
  useRunAssistantCommand,
} from "@/services/assistant/hooks";
import type {
  CommandResponse,
  ConfirmActionResponse,
} from "@/services/assistant/types";
import { useActiveBranchId } from "@/services/context/branch-store";
import { PendingActionConfirm } from "@/components/assistant/pending-action-confirm";
import { CommandResultCard } from "@/components/command/command-result-card";
import { useRecentCommands } from "@/components/command/use-recent-commands";

const MAX_NAV_ROWS = 6;
const MAX_SEARCH_ROWS = 4;

type PaletteRow =
  | { kind: "nav"; page: NavPage }
  | { kind: "search"; label: string; href: string; icon: "object" | "conversation" }
  | { kind: "ask" };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-text-disabled">
      {children}
    </p>
  );
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: user } = useCurrentUserProfile();
  const activeBranchId = useActiveBranchId();
  const { recents, addRecent } = useRecentCommands();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [confirmOutcome, setConfirmOutcome] = useState<ConfirmActionResponse | null>(null);

  const commandMutation = useRunAssistantCommand();
  const confirmMutation = useConfirmAssistantAction();

  const permissions = useMemo(() => resolvePermissions(user), [user]);
  const trimmed = query.trim();

  const navMatches = useMemo(() => {
    if (!trimmed) {
      const recentPages = recents
        .map((entry) => getNavPage(entry.pageId))
        .filter((page): page is NavPage => Boolean(page))
        .filter((page) => !page.permission || permissions.has(page.permission));
      if (recentPages.length) return recentPages;
    }
    return filterNavPages(trimmed, permissions, t).slice(0, MAX_NAV_ROWS);
  }, [trimmed, permissions, recents, t]);
  const showingRecents = !trimmed && recents.length > 0 && navMatches.length > 0;

  const hubSearch = useHubGlobalSearch(trimmed.length >= 2 ? trimmed : "");
  const searchRows = useMemo((): PaletteRow[] => {
    if (hubSearch.isError || !hubSearch.data) return [];
    const objects: PaletteRow[] = hubSearch.data.objects.map((object) => ({
      kind: "search",
      label: object.title,
      href: object.deep_link,
      icon: "object",
    }));
    const conversations: PaletteRow[] = hubSearch.data.conversations.map((hit) => ({
      kind: "search",
      label: hit.display_title,
      href: `/workspace/chat?conversation=${hit.conversation_id}`,
      icon: "conversation",
    }));
    return [...objects, ...conversations].slice(0, MAX_SEARCH_ROWS);
  }, [hubSearch.data, hubSearch.isError]);

  const rows = useMemo((): PaletteRow[] => {
    const navRows: PaletteRow[] = navMatches.map((page) => ({ kind: "nav", page }));
    const askRow: PaletteRow[] = trimmed ? [{ kind: "ask" }] : [];
    return [...navRows, ...searchRows, ...askRow];
  }, [navMatches, searchRows, trimmed]);

  useEffect(() => {
    setActiveIndex(0);
    setInlineError(null);
  }, [trimmed]);

  // Body scroll lock while the palette is open (same as ModalShell).
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const navigateTo = useCallback(
    (href: string, pageId?: string) => {
      if (pageId) {
        const page = getNavPage(pageId);
        if (page) addRecent(page.id);
      }
      onClose();
      router.push(href);
    },
    [addRecent, onClose, router],
  );

  const handleCommandResponse = useCallback(
    (response: CommandResponse) => {
      if (response.type === "NAVIGATION" && response.navigation) {
        const { page_id, path, params } = response.navigation;
        const page = getNavPage(page_id);
        // Resolve against the local registry; only trust a server path that
        // stays inside the workspace (defense in depth for the mirrored lists).
        const base = page?.href ?? (path.startsWith("/workspace/") ? path : null);
        if (base) {
          const search = new URLSearchParams(
            Object.entries(params ?? {}).map(([key, value]) => [key, String(value)]),
          ).toString();
          navigateTo(search ? `${base}?${search}` : base, page?.id);
          return;
        }
        setInlineError(t("command.errorGeneric"));
        return;
      }
      if (response.type === "ERROR") {
        const code = response.error?.code;
        setInlineError(
          code === "no_branch"
            ? t("command.errorNoBranch")
            : code === "llm_unavailable"
              ? t("command.errorUnavailable")
              : response.error?.detail || t("command.errorGeneric"),
        );
        return;
      }
      setResult(response);
    },
    [navigateTo, t],
  );

  const submitAsk = useCallback(() => {
    if (!trimmed || commandMutation.isPending) return;
    if (!activeBranchId) {
      setInlineError(t("command.errorNoBranch"));
      return;
    }
    setInlineError(null);
    commandMutation.mutate(
      { text: trimmed, branch_id: activeBranchId },
      {
        onSuccess: handleCommandResponse,
        onError: () => setInlineError(t("command.errorGeneric")),
      },
    );
  }, [trimmed, commandMutation, activeBranchId, handleCommandResponse, t]);

  const executeRow = useCallback(
    (row: PaletteRow) => {
      if (row.kind === "nav") {
        navigateTo(row.page.href, row.page.id);
      } else if (row.kind === "search") {
        onClose();
        router.push(row.href);
      } else {
        submitAsk();
      }
    },
    [navigateTo, onClose, router, submitAsk],
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setConfirmOutcome(null);
    confirmMutation.reset();
  }, [confirmMutation]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (result) clearResult();
        else onClose();
        return;
      }
      if (result) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, rows.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const row = rows[activeIndex];
        if (row) executeRow(row);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, activeIndex, result, executeRow, clearResult, onClose]);

  const handleConfirm = useCallback(
    (applied: boolean) => {
      const proposal = result?.proposal;
      if (!proposal || confirmMutation.isPending) return;
      confirmMutation.mutate(
        {
          conversationId: proposal.conversation_id,
          payload: { applied, message_id: proposal.message_id },
        },
        {
          onSuccess: (outcome) => {
            setConfirmOutcome(outcome);
            if (outcome.applied) {
              // A confirmed write changed operational data — refresh
              // whatever the underlying page is showing.
              queryClient.invalidateQueries();
            }
          },
          onError: () => setInlineError(t("command.errorGeneric")),
        },
      );
    },
    [result, confirmMutation, queryClient, t],
  );

  const thinking = commandMutation.isPending;

  const body = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-6 pt-[15vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border-default bg-surface-2 shadow-[var(--shadow-level-3)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
          <Search className="h-4.5 w-4.5 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (result) clearResult();
            }}
            placeholder={t("command.placeholder")}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled focus:outline-none"
          />
          <button
            type="button"
            aria-label={t("command.close")}
            onClick={onClose}
            className="text-text-muted transition-colors hover:text-text-primary"
          >
            <Xmark className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto pb-2">
          {inlineError ? (
            <p className="px-4 pt-3 text-xs text-status-critical">{inlineError}</p>
          ) : null}

          {result ? (
            <div className="space-y-3 px-4 py-3">
              {result.type === "QUERY" && result.card ? (
                <CommandResultCard card={result.card} onNavigate={onClose} />
              ) : null}

              {result.type === "ANSWER" && result.answer ? (
                <div className="rounded-xl border border-border-default bg-surface-3 p-3.5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                    {result.answer}
                  </p>
                </div>
              ) : null}

              {result.type === "MUTATION_PROPOSAL" && result.proposal ? (
                confirmOutcome ? (
                  <div className="rounded-xl border border-border-default bg-surface-3 p-3.5">
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        confirmOutcome.applied
                          ? "text-status-success"
                          : confirmOutcome.status === "DECLINED"
                            ? "text-text-muted"
                            : "text-status-critical"
                      }`}
                    >
                      {confirmOutcome.applied
                        ? t("command.applied")
                        : confirmOutcome.status === "DECLINED"
                          ? t("command.declined")
                          : t("command.failed")}
                    </p>
                    <p className="mt-1 text-sm text-text-primary">{confirmOutcome.summary}</p>
                    {confirmOutcome.action_log_id ? (
                      <p className="mt-2 text-[10px] text-text-disabled">
                        {t("command.audited")} · {confirmOutcome.action_log_id}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <PendingActionConfirm
                    action={result.proposal.pending_action}
                    busy={confirmMutation.isPending}
                    onConfirm={() => handleConfirm(true)}
                    onDismiss={() => handleConfirm(false)}
                  />
                )
              ) : null}

              <p className="text-[10px] text-text-disabled">{t("command.backHint")}</p>
            </div>
          ) : thinking ? (
            <div className="flex items-center gap-2.5 px-4 py-5">
              <Sparks className="h-4 w-4 animate-pulse text-brand-gold" />
              <p className="text-sm text-text-muted">{t("command.thinking")}</p>
            </div>
          ) : (
            <>
              {navMatches.length > 0 ? (
                <>
                  <SectionLabel>
                    {showingRecents ? t("command.sectionRecent") : t("command.sectionNavigation")}
                  </SectionLabel>
                  {navMatches.map((page, index) => {
                    const active = activeIndex === index;
                    const Icon = page.icon;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => executeRow({ kind: "nav", page })}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`relative flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                          active ? "bg-surface-3" : "hover:bg-surface-3"
                        }`}
                      >
                        {active ? (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gold" />
                        ) : null}
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brand-gold" : "text-text-muted"}`} />
                        <span className="truncate text-sm text-text-primary">{t(page.labelKey)}</span>
                      </button>
                    );
                  })}
                </>
              ) : null}

              {searchRows.length > 0 ? (
                <>
                  <SectionLabel>{t("command.sectionSearch")}</SectionLabel>
                  {searchRows.map((row, index) => {
                    if (row.kind !== "search") return null;
                    const flatIndex = navMatches.length + index;
                    const active = activeIndex === flatIndex;
                    return (
                      <button
                        key={`${row.href}-${index}`}
                        type="button"
                        onClick={() => executeRow(row)}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        className={`relative flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                          active ? "bg-surface-3" : "hover:bg-surface-3"
                        }`}
                      >
                        {active ? (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gold" />
                        ) : null}
                        {row.icon === "object" ? (
                          <Box className={`h-4 w-4 shrink-0 ${active ? "text-brand-gold" : "text-text-muted"}`} />
                        ) : (
                          <ChatBubble className={`h-4 w-4 shrink-0 ${active ? "text-brand-gold" : "text-text-muted"}`} />
                        )}
                        <span className="truncate text-sm text-text-primary">{row.label}</span>
                      </button>
                    );
                  })}
                </>
              ) : null}

              {trimmed ? (
                (() => {
                  const flatIndex = navMatches.length + searchRows.length;
                  const active = activeIndex === flatIndex;
                  const disabled = !activeBranchId;
                  return (
                    <>
                      <SectionLabel>{t("command.sectionAsk")}</SectionLabel>
                      <button
                        type="button"
                        onClick={submitAsk}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        disabled={disabled}
                        className={`relative flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors disabled:opacity-50 ${
                          active ? "bg-surface-3" : "hover:bg-surface-3"
                        }`}
                      >
                        {active ? (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-gold" />
                        ) : null}
                        <Sparks className={`h-4 w-4 shrink-0 ${active ? "text-brand-gold" : "text-text-muted"}`} />
                        <span className="truncate text-sm text-text-primary">
                          {t("command.ask")} <span className="text-text-muted">“{trimmed}”</span>
                        </span>
                      </button>
                      {disabled ? (
                        <p className="px-4 pb-1 pt-0.5 text-[11px] text-text-disabled">
                          {t("command.errorNoBranch")}
                        </p>
                      ) : null}
                    </>
                  );
                })()
              ) : navMatches.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-text-muted">{t("command.empty")}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
