import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { supportEndpoints } from "./endpoints";
import type {
  SupportTicket,
  CreateSupportTicketPayload,
  BugReport,
  CreateBugReportPayload,
  FeatureRequest,
  CreateFeatureRequestPayload,
  SystemStatus,
  HelpArticle,
  SupportStats,
  SupportTicketListResponse,
} from "./types";
import {
  supportTicketSchema,
  bugReportSchema,
  featureRequestSchema,
  systemStatusSchema,
  helpArticleSchema,
  supportStatsSchema,
  supportTicketListResponseSchema,
} from "./types";

export async function getSupportTickets(): Promise<SupportTicketListResponse> {
  return apiClientWithSchema(supportEndpoints.tickets, supportTicketListResponseSchema);
}

export async function getSupportTicket(id: string): Promise<SupportTicket> {
  return apiClientWithSchema(supportEndpoints.ticket(id), supportTicketSchema);
}

export async function createSupportTicket(
  payload: CreateSupportTicketPayload,
): Promise<SupportTicket> {
  return apiClientWithSchema(supportEndpoints.tickets, supportTicketSchema, {
    method: "POST",
    body: payload,
  });
}

export async function createBugReport(payload: CreateBugReportPayload): Promise<BugReport> {
  return apiClientWithSchema(supportEndpoints.bugReports, bugReportSchema, {
    method: "POST",
    body: {
      ...payload,
      browser_info:
        typeof window !== "undefined"
          ? navigator.userAgent
          : "Server-side report",
      page_location:
        typeof window !== "undefined"
          ? window.location.href
          : "Unknown",
    },
  });
}

export async function getFeatureRequests(): Promise<FeatureRequest[]> {
  return apiClient(supportEndpoints.featureRequests);
}

export async function createFeatureRequest(
  payload: CreateFeatureRequestPayload,
): Promise<FeatureRequest> {
  return apiClientWithSchema(supportEndpoints.featureRequests, featureRequestSchema, {
    method: "POST",
    body: payload,
  });
}

export async function voteFeatureRequest(id: string): Promise<{ votes: number }> {
  return apiClient(supportEndpoints.featureRequestVote(id), {
    method: "POST",
  });
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return apiClientWithSchema(supportEndpoints.systemStatus, systemStatusSchema);
}

export async function getHelpArticles(): Promise<HelpArticle[]> {
  const data = await apiClient<HelpArticle[] | { results: HelpArticle[] }>(supportEndpoints.helpArticles);
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export async function searchHelpArticles(query: string): Promise<HelpArticle[]> {
  const data = await apiClient<HelpArticle[] | { results: HelpArticle[] }>(supportEndpoints.searchHelp, {
    method: "POST",
    body: { query },
  });
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export async function getSupportStats(): Promise<SupportStats> {
  return apiClientWithSchema(supportEndpoints.stats, supportStatsSchema);
}