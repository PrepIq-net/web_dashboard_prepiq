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
