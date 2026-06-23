import { z } from "zod";
import { apiClient, apiClientWithSchema } from "@/lib/api/client";
import { planningEndpoints } from "./endpoints";
import {
  calendarEventListSchema,
  calendarEventDetailSchema,
  calendarViewResponseSchema,
  forecastContextSchema,
  type PlanningEventsParams,
  type CalendarViewParams,
  type ForecastContextParams,
  type CreateCalendarEventPayload,
  type UpdateCalendarEventPayload,
} from "./types";

export async function listEvents(params?: PlanningEventsParams) {
  const response = await apiClient<unknown>(planningEndpoints.list(params), {
    method: "GET",
  });

  const direct = z.array(calendarEventListSchema).safeParse(response);
  if (direct.success) return direct.data;

  const paginated = z
    .object({ results: z.array(calendarEventListSchema) })
    .safeParse(response);
  if (paginated.success) return paginated.data.results;

  throw new Error("Unexpected planning events response format.");
}

export async function getEvent(eventId: string) {
  return apiClientWithSchema(
    planningEndpoints.detail(eventId),
    calendarEventDetailSchema,
    { method: "GET" },
  );
}

export async function createEvent(payload: CreateCalendarEventPayload) {
  return apiClientWithSchema(
    planningEndpoints.create(),
    calendarEventDetailSchema,
    { method: "POST", body: payload },
  );
}

export async function updateEvent(
  eventId: string,
  payload: UpdateCalendarEventPayload,
) {
  return apiClientWithSchema(
    planningEndpoints.update(eventId),
    calendarEventDetailSchema,
    { method: "PATCH", body: payload },
  );
}

export async function deleteEvent(eventId: string) {
  return apiClient<void>(planningEndpoints.delete(eventId), {
    method: "DELETE",
  });
}

export async function getCalendarView(params: CalendarViewParams) {
  return apiClientWithSchema(
    planningEndpoints.calendarView(params),
    calendarViewResponseSchema,
    { method: "GET" },
  );
}

export async function getForecastContext(params: ForecastContextParams) {
  return apiClientWithSchema(
    planningEndpoints.forecastContext(params),
    forecastContextSchema,
    { method: "GET" },
  );
}
