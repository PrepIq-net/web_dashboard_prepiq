"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import * as insightsService from "./service";
import type { InsightStatus } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────────────────

export const insightsKeys = {
  all: ["insights"] as const,
  branch: (branchId: string) => [...insightsKeys.all, branchId] as const,
  summary: (branchId: string) => [...insightsKeys.branch(branchId), "summary"] as const,
  feed: (branchId: string, status?: string, type?: string) =>
    [...insightsKeys.branch(branchId), "feed", status ?? "", type ?? ""] as const,
  opportunities: (branchId: string) =>
    [...insightsKeys.branch(branchId), "opportunities"] as const,
  rootCauses: (branchId: string, outcome?: string) =>
    [...insightsKeys.branch(branchId), "root-causes", outcome ?? ""] as const,
  runs: (branchId: string) => [...insightsKeys.branch(branchId), "runs"] as const,
  reports: (branchId: string) => [...insightsKeys.branch(branchId), "reports"] as const,
};

/**
 * The whole store is rewritten once a night and never during the day, so a
 * short staleTime would buy nothing but round-trips. Five minutes keeps a
 * tab-switch instant while still picking up a manual pipeline re-run within
 * the session.
 */
const NIGHTLY = 5 * 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Read hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useInsightSummary(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: insightsKeys.summary(branchId ?? ""),
    queryFn: () => insightsService.getSummary(branchId!),
    enabled: enabled && !!branchId,
    staleTime: NIGHTLY,
  });
}

export function useInsightFeed(
  branchId?: string,
  params?: { status?: string; type?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: insightsKeys.feed(branchId ?? "", params?.status, params?.type),
    queryFn: () => insightsService.getFeed(branchId!, params),
    enabled: enabled && !!branchId,
    staleTime: NIGHTLY,
  });
}

export function useOpportunities(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: insightsKeys.opportunities(branchId ?? ""),
    queryFn: () => insightsService.getOpportunities(branchId!),
    enabled: enabled && !!branchId,
    staleTime: NIGHTLY,
  });
}

export function useRootCauses(branchId?: string, outcome?: string, enabled = true) {
  return useQuery({
    queryKey: insightsKeys.rootCauses(branchId ?? "", outcome),
    queryFn: () => insightsService.getRootCauses(branchId!, outcome),
    enabled: enabled && !!branchId,
    staleTime: NIGHTLY,
  });
}

/**
 * The in-app Reports log.
 *
 * Reports appear on a Monday-morning beat, not on user action, so the cache
 * can sit for the same nightly interval as everything else here.
 */
export function useInsightReports(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: insightsKeys.reports(branchId ?? ""),
    queryFn: () => insightsService.getReports(branchId!),
    enabled: enabled && !!branchId,
    staleTime: NIGHTLY,
  });
}

export function useInsightRuns(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: insightsKeys.runs(branchId ?? ""),
    queryFn: () => insightsService.getRuns(branchId!),
    enabled: enabled && !!branchId,
    staleTime: NIGHTLY,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dismiss, restore, or mark a finding implemented.
 *
 * Invalidates the whole branch subtree rather than one list: a dismissal
 * changes the feed, the opportunity total, the open count on the summary, and
 * possibly which finding is the headline action. Patching one cache and
 * leaving the others is how a total stops matching its rows.
 */
export function useSetInsightStatus(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ insightId, status }: { insightId: string; status: InsightStatus }) =>
      insightsService.setInsightStatus(insightId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: insightsKeys.branch(branchId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis chat
// ─────────────────────────────────────────────────────────────────────────────

export const analystKeys = {
  threads: (branchId: string) =>
    [...insightsKeys.branch(branchId), "analyst", "threads"] as const,
  thread: (branchId: string, threadId: string) =>
    [...insightsKeys.branch(branchId), "analyst", "thread", threadId] as const,
  goals: (branchId: string) =>
    [...insightsKeys.branch(branchId), "analyst", "goals"] as const,
};

/**
 * The thread list and the manager's standing instructions.
 *
 * Unlike the nightly tabs, this reflects the manager's own actions within the
 * session, so it is not cached for five minutes — a thread they just created
 * has to appear immediately.
 */
export function useAnalystThreads(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: analystKeys.threads(branchId ?? ""),
    queryFn: () => insightsService.getAnalystThreads(branchId!),
    enabled: enabled && !!branchId,
  });
}

export function useAnalystThread(
  branchId?: string,
  threadId?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: analystKeys.thread(branchId ?? "", threadId ?? ""),
    queryFn: () => insightsService.getAnalystThread(branchId!, threadId!),
    enabled: enabled && !!branchId && !!threadId,
  });
}

export function useCreateAnalystThread(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      insightsService.createAnalystThread(branchId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analystKeys.threads(branchId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRenameAnalystThread(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      insightsService.renameAnalystThread(branchId, threadId, title),
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: analystKeys.threads(branchId) });
      queryClient.invalidateQueries({
        queryKey: analystKeys.thread(branchId, threadId),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteAnalystThread(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) =>
      insightsService.deleteAnalystThread(branchId, threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analystKeys.threads(branchId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Ask a question.
 *
 * Invalidates the thread list as well as the transcript: a reply bumps
 * `updated_at`, which is the list's sort key, and the first turn also names an
 * untitled thread. Refreshing only the transcript leaves the sidebar showing a
 * stale title in a stale position.
 */
export function useSendAnalystTurn(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, message }: { threadId: string; message: string }) =>
      insightsService.sendAnalystTurn(branchId, threadId, message),
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({
        queryKey: analystKeys.thread(branchId, threadId),
      });
      queryClient.invalidateQueries({ queryKey: analystKeys.threads(branchId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useOpenAnalystWeek(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => insightsService.openAnalystWeek(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analystKeys.threads(branchId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Resolve a "do the work" bundle a turn proposed — Review & approve.
 * Invalidates the transcript the same way a turn does: the confirm response
 * is itself a new assistant message (the "Done — …" / "Okay, I won't apply
 * that" line), and any items it applied may have changed data other tabs
 * show, so a full refetch on next visit is the safe default rather than
 * trying to patch specific caches per action type.
 */
export function useConfirmAnalystBundle(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { threadId: string; messageId: string; applied: boolean; actionLogIds?: string[] }) =>
      insightsService.confirmAnalystBundle(branchId, params.threadId, params),
    onSuccess: (_data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: analystKeys.thread(branchId, threadId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * "How are my restaurants doing" — one-shot, no thread to invalidate.
 */
export function useAskOrgQuery(organizationId: string) {
  return useMutation({
    mutationFn: (question: string) => insightsService.askOrgQuery(organizationId, question),
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Goals — same underlying rows as `useAnalystThreads`' `memories`, plus the
 * pickable metric menu for the structured create form.
 */
export function useGoals(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: analystKeys.goals(branchId ?? ""),
    queryFn: () => insightsService.getGoals(branchId!),
    enabled: enabled && !!branchId,
  });
}

export function useCreateGoal(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      metric: string;
      comparator: "gt" | "gte" | "lt" | "lte";
      threshold: number;
      weekday?: number | null;
      item_title?: string | null;
    }) => insightsService.createGoal(branchId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analystKeys.goals(branchId) });
      // The Analysis tab's sidebar reads the same rows via the thread list.
      queryClient.invalidateQueries({ queryKey: analystKeys.threads(branchId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Retire a standing instruction.
 *
 * The reply may also have created one (via the `remember` tool), so this
 * invalidates the same list the chat writes to.
 */
export function useRetireAnalystMemory(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) =>
      insightsService.retireAnalystMemory(branchId, memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analystKeys.threads(branchId) });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
