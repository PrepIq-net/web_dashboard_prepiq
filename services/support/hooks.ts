import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getSupportTickets,
  getSupportTicket,
  createSupportTicket,
  createBugReport,
  getFeatureRequests,
  createFeatureRequest,
  voteFeatureRequest,
  getSystemStatus,
  getHelpArticles,
  searchHelpArticles,
  getSupportStats,
} from "./service";
import type {
  CreateSupportTicketPayload,
  CreateBugReportPayload,
  CreateFeatureRequestPayload,
} from "./types";

export const supportQueryKeys = {
  root: ["support"] as const,
  tickets: () => [...supportQueryKeys.root, "tickets"] as const,
  ticket: (id: string) => [...supportQueryKeys.root, "tickets", id] as const,
  featureRequests: () => [...supportQueryKeys.root, "feature-requests"] as const,
  systemStatus: () => [...supportQueryKeys.root, "system-status"] as const,
  helpArticles: () => [...supportQueryKeys.root, "help-articles"] as const,
  searchHelp: (query: string) => [...supportQueryKeys.root, "help-articles", "search", query] as const,
  stats: () => [...supportQueryKeys.root, "stats"] as const,
};

export function useSupportTickets() {
  return useQuery({
    queryKey: supportQueryKeys.tickets(),
    queryFn: getSupportTickets,
  });
}

export function useSupportTicket(id: string) {
  return useQuery({
    queryKey: supportQueryKeys.ticket(id),
    queryFn: () => getSupportTicket(id),
    enabled: Boolean(id),
  });
}

export function useCreateSupportTicket() {
  return useMutation({
    mutationFn: (payload: CreateSupportTicketPayload) => createSupportTicket(payload),
  });
}

export function useCreateBugReport() {
  return useMutation({
    mutationFn: (payload: CreateBugReportPayload) => createBugReport(payload),
  });
}

export function useFeatureRequests() {
  return useQuery({
    queryKey: supportQueryKeys.featureRequests(),
    queryFn: getFeatureRequests,
  });
}

export function useCreateFeatureRequest() {
  return useMutation({
    mutationFn: (payload: CreateFeatureRequestPayload) => createFeatureRequest(payload),
  });
}

export function useVoteFeatureRequest() {
  return useMutation({
    mutationFn: (id: string) => voteFeatureRequest(id),
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: supportQueryKeys.systemStatus(),
    queryFn: getSystemStatus,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useHelpArticles() {
  return useQuery({
    queryKey: supportQueryKeys.helpArticles(),
    queryFn: getHelpArticles,
  });
}

export function useSearchHelpArticles(query: string) {
  return useQuery({
    queryKey: supportQueryKeys.searchHelp(query),
    queryFn: () => searchHelpArticles(query),
    enabled: query.length >= 2,
  });
}

export function useSupportStats() {
  return useQuery({
    queryKey: supportQueryKeys.stats(),
    queryFn: getSupportStats,
  });
}