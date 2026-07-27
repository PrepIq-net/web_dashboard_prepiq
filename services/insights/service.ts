import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { insightsEndpoints } from "./endpoints";
import {
  analystThreadDetailSchema,
  analystThreadSchema,
  analystThreadsSchema,
  analystTurnSchema,
  feedSchema,
  insightSchema,
  opportunitiesSchema,
  reportsSchema,
  rootCausesSchema,
  runsSchema,
  summarySchema,
  type InsightStatus,
} from "./types";

export async function getSummary(branchId: string) {
  return apiClientWithSchema(insightsEndpoints.summary(branchId), summarySchema, {
    method: "GET",
  });
}

export async function getFeed(
  branchId: string,
  params?: { status?: string; type?: string },
) {
  return apiClientWithSchema(insightsEndpoints.feed(branchId, params), feedSchema, {
    method: "GET",
  });
}

export async function getOpportunities(branchId: string) {
  return apiClientWithSchema(
    insightsEndpoints.opportunities(branchId),
    opportunitiesSchema,
    { method: "GET" },
  );
}

export async function getRootCauses(branchId: string, outcome?: string) {
  return apiClientWithSchema(
    insightsEndpoints.rootCauses(branchId, outcome),
    rootCausesSchema,
    { method: "GET" },
  );
}

export async function getReports(branchId: string) {
  return apiClientWithSchema(insightsEndpoints.reports(branchId), reportsSchema, {
    method: "GET",
  });
}

export async function getRuns(branchId: string) {
  return apiClientWithSchema(insightsEndpoints.runs(branchId), runsSchema, {
    method: "GET",
  });
}

/**
 * A manager's verdict on one finding — the only write in this API.
 *
 * Dismissal is temporary by design: the server sets an expiry and the pipeline
 * resurfaces the finding if the condition is still costing money weeks later.
 */
export async function setInsightStatus(insightId: string, status: InsightStatus) {
  return apiClientWithSchema(insightsEndpoints.status(insightId), insightSchema, {
    method: "POST",
    body: { status },
  });
}

// ── Analysis chat ───────────────────────────────────────────────────────────

export async function getAnalystThreads(branchId: string) {
  return apiClientWithSchema(
    insightsEndpoints.threads(branchId),
    analystThreadsSchema,
    { method: "GET" },
  );
}

export async function getAnalystThread(branchId: string, threadId: string) {
  return apiClientWithSchema(
    insightsEndpoints.thread(branchId, threadId),
    analystThreadDetailSchema,
    { method: "GET" },
  );
}

export async function createAnalystThread(branchId: string, title?: string) {
  return apiClientWithSchema(
    insightsEndpoints.threads(branchId),
    analystThreadSchema,
    { method: "POST", body: { title: title ?? "" } },
  );
}

export async function renameAnalystThread(
  branchId: string,
  threadId: string,
  title: string,
) {
  return apiClientWithSchema(
    insightsEndpoints.thread(branchId, threadId),
    analystThreadSchema,
    { method: "PATCH", body: { title } },
  );
}

export async function deleteAnalystThread(branchId: string, threadId: string) {
  return apiClient(insightsEndpoints.thread(branchId, threadId), {
    method: "DELETE",
  });
}

/**
 * Ask a question and wait for the reply.
 *
 * This is the one endpoint in the feature that calls a model, so it is the one
 * that can take seconds rather than milliseconds. Callers must show a pending
 * state; there is no streaming here yet.
 */
export async function sendAnalystTurn(
  branchId: string,
  threadId: string,
  message: string,
) {
  return apiClientWithSchema(
    insightsEndpoints.threadTurn(branchId, threadId),
    analystTurnSchema,
    { method: "POST", body: { message } },
  );
}

export async function openAnalystWeek(branchId: string) {
  return apiClientWithSchema(
    insightsEndpoints.openWeek(branchId),
    analystTurnSchema,
    { method: "POST", body: {} },
  );
}

export async function retireAnalystMemory(branchId: string, memoryId: string) {
  return apiClient(insightsEndpoints.memory(branchId, memoryId), {
    method: "DELETE",
  });
}
