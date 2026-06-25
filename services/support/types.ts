import { z } from "zod";

export const supportTicketSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  branch_id: z.string().nullable(),
  user_id: z.string(),
  user_name: z.string(),
  user_email: z.string(),
  subject: z.string(),
  category: z.enum([
    "technical_issue",
    "data_problem",
    "forecast_question",
    "billing_issue",
    "pos_integration",
    "other",
  ]),
  description: z.string(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  attachments: z.array(z.string()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
});

export const createSupportTicketPayloadSchema = z.object({
  subject: z.string().min(1).max(200),
  category: z.enum([
    "technical_issue",
    "data_problem",
    "forecast_question",
    "billing_issue",
    "pos_integration",
    "other",
  ]),
  description: z.string().min(10),
  branch_id: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export const bugReportSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  page_location: z.string(),
  browser_info: z.string(),
  description: z.string(),
  status: z.enum(["reported", "investigating", "fixed", "wont_fix"]),
  created_at: z.string(),
});

export const createBugReportPayloadSchema = z.object({
  description: z.string().min(10),
  page_location: z.string().optional(),
  browser_info: z.string().optional(),
});

export const featureRequestSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum([
    "forecasting",
    "production",
    "purchasing",
    "reporting",
    "inventory",
    "pos_integration",
    "other",
  ]),
  status: z.enum(["open", "under_review", "planned", "in_progress", "completed", "declined"]),
  votes: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createFeatureRequestPayloadSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20),
  category: z.enum([
    "forecasting",
    "production",
    "purchasing",
    "reporting",
    "inventory",
    "pos_integration",
    "other",
  ]),
});

export const systemStatusSchema = z.object({
  forecast_engine: z.enum(["operational", "degraded", "down"]),
  pos_integrations: z.enum(["operational", "degraded", "down"]),
  data_sync: z.enum(["operational", "degraded", "down"]),
  api_services: z.enum(["operational", "degraded", "down"]),
  last_updated: z.string(),
  active_incidents: z
    .array(
      z.object({
        service: z.string(),
        status: z.enum(["operational", "degraded", "down"]),
        message: z.string(),
        started_at: z.string(),
      }),
    )
    .optional(),
});

export const helpArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  summary: z.string(),
  category: z.enum([
    "getting_started",
    "daily_operations",
    "forecasting",
    "production",
    "inventory",
    "pos_integration",
    "billing",
  ]),
  content: z.string(),
  order: z.number(),
});

export const supportStatsSchema = z.object({
  open_tickets: z.number(),
  avg_response_time_minutes: z.number(),
  resolved_this_week: z.number(),
});

export const supportTicketListResponseSchema = z.object({
  tickets: z.array(supportTicketSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
});

export type SupportTicket = z.infer<typeof supportTicketSchema>;
export type CreateSupportTicketPayload = z.infer<typeof createSupportTicketPayloadSchema>;
export type BugReport = z.infer<typeof bugReportSchema>;
export type CreateBugReportPayload = z.infer<typeof createBugReportPayloadSchema>;
export type FeatureRequest = z.infer<typeof featureRequestSchema>;
export type CreateFeatureRequestPayload = z.infer<typeof createFeatureRequestPayloadSchema>;
export type SystemStatus = z.infer<typeof systemStatusSchema>;
export type HelpArticle = z.infer<typeof helpArticleSchema>;
export type SupportStats = z.infer<typeof supportStatsSchema>;
export type SupportTicketListResponse = z.infer<typeof supportTicketListResponseSchema>;