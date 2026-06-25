import type { PlanningEventsParams, CalendarViewParams, ForecastContextParams } from "./types";

const BASE = `/api/planning/events`;

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const planningEndpoints = {
  list: (params?: PlanningEventsParams) =>
    `${BASE}/${buildQuery({
      branch_id: params?.branch_id,
      event_type: params?.event_type,
      status: params?.status,
      start_date: params?.start_date,
      end_date: params?.end_date,
    })}`,

  detail: (eventId: string) => `${BASE}/${eventId}/`,

  create: () => `${BASE}/`,

  update: (eventId: string) => `${BASE}/${eventId}/`,

  delete: (eventId: string) => `${BASE}/${eventId}/`,

  calendarView: (params: CalendarViewParams) =>
    `${BASE}/calendar/${buildQuery({
      start: params.start,
      end: params.end,
      branch_id: params.branch_id,
    })}`,

  forecastContext: (params: ForecastContextParams) =>
    `${BASE}/forecast-context/${buildQuery({
      branch_id: params.branch_id,
      date: params.date,
    })}`,
} as const;
