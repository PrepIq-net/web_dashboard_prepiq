import { apiClientWithSchema } from "@/lib/api/client";
import { insightsEndpoints } from "./endpoints";
import {
  feedSchema,
  insightSchema,
  opportunitiesSchema,
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
