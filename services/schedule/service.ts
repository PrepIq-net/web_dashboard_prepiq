import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { scheduleEndpoints } from "./endpoints";
import {
  availabilityWeekSchema,
  coverageResponseSchema,
  employeeAvailabilitySchema,
  generateResponseSchema,
  historyResponseSchema,
  myAvailabilityResponseSchema,
  myContextSchema,
  scheduleWeekSchema,
  shiftMutationResponseSchema,
  weeklyScheduleSchema,
  type CreateShiftPayload,
  type ReviewAvailabilityPayload,
  type SubmitAvailabilityPayload,
  type UpdateShiftPayload,
} from "./types";

export async function getAvailabilityWeek(branchId: string, week: string) {
  return apiClientWithSchema(
    scheduleEndpoints.availability(branchId, week),
    availabilityWeekSchema,
    { method: "GET" },
  );
}

// ── Employee self-service ─────────────────────────────────────────────────

export async function getMyContext() {
  return apiClientWithSchema(scheduleEndpoints.myContext(), myContextSchema, {
    method: "GET",
  });
}

export async function getMyAvailability(branchId: string, week: string) {
  return apiClientWithSchema(
    scheduleEndpoints.myAvailability(branchId, week),
    myAvailabilityResponseSchema,
    { method: "GET" },
  );
}

export async function submitAvailability(payload: SubmitAvailabilityPayload) {
  // branch_id rides in both the query (branch resolution) and the body (the
  // submit serializer requires it) — mirror mobile and send the whole payload.
  return apiClientWithSchema(
    scheduleEndpoints.submitAvailability(payload.branch_id),
    employeeAvailabilitySchema,
    { method: "PUT", body: payload },
  );
}

export async function reviewAvailability(
  availabilityId: string,
  payload: ReviewAvailabilityPayload,
) {
  return apiClient<unknown>(scheduleEndpoints.reviewAvailability(availabilityId), {
    method: "POST",
    body: payload,
  });
}

export async function getScheduleWeek(branchId: string, week: string) {
  return apiClientWithSchema(
    scheduleEndpoints.scheduleWeek(branchId, week),
    scheduleWeekSchema,
    { method: "GET" },
  );
}

export async function generateSchedule(branchId: string, weekStartDate: string) {
  return apiClientWithSchema(scheduleEndpoints.generate(), generateResponseSchema, {
    method: "POST",
    body: { branch_id: branchId, week_start_date: weekStartDate },
  });
}

export async function copyPreviousWeek(branchId: string, weekStartDate: string) {
  return apiClient<unknown>(scheduleEndpoints.copyPrevious(), {
    method: "POST",
    body: { branch_id: branchId, week_start_date: weekStartDate },
  });
}

export async function publishSchedule(scheduleId: string) {
  return apiClientWithSchema(
    scheduleEndpoints.publish(scheduleId),
    weeklyScheduleSchema,
    { method: "POST", body: {} },
  );
}

export async function createShift(payload: CreateShiftPayload) {
  return apiClientWithSchema(scheduleEndpoints.shifts(), shiftMutationResponseSchema, {
    method: "POST",
    body: payload,
  });
}

export async function updateShift(shiftId: string, payload: UpdateShiftPayload) {
  return apiClientWithSchema(
    scheduleEndpoints.shiftDetail(shiftId),
    shiftMutationResponseSchema,
    { method: "PATCH", body: payload },
  );
}

export async function deleteShift(shiftId: string) {
  return apiClient<unknown>(scheduleEndpoints.shiftDetail(shiftId), {
    method: "DELETE",
  });
}

export async function getCoverage(branchId: string, week: string) {
  return apiClientWithSchema(
    scheduleEndpoints.coverage(branchId, week),
    coverageResponseSchema,
    { method: "GET" },
  );
}

export async function recomputeRequirements(branchId: string, weekStartDate: string) {
  return apiClient<unknown>(scheduleEndpoints.recomputeRequirements(), {
    method: "POST",
    body: { branch_id: branchId, week_start_date: weekStartDate },
  });
}

export async function getHistory(branchId: string, weeks = 8) {
  return apiClientWithSchema(
    scheduleEndpoints.history(branchId, weeks),
    historyResponseSchema,
    { method: "GET" },
  );
}

/**
 * Put an existing org member on this branch's roster (BranchStaff) by giving
 * them a branch role. No email — they're already in the org, so they appear on
 * the schedule immediately.
 */
export async function assignRosterRole(payload: {
  branchId: string;
  userId: string;
  roleSlug: string;
}) {
  return apiClient<unknown>(scheduleEndpoints.assignRosterRole(), {
    method: "POST",
    body: {
      branch_id: payload.branchId,
      user_id: payload.userId,
      action: "UPDATE_ROLE",
      role: payload.roleSlug,
    },
  });
}
