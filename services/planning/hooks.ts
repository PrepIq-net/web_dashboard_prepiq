import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import * as planningService from "./service";
import type {
  PlanningEventsParams,
  CalendarViewParams,
  ForecastContextParams,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────────────────

export const planningKeys = {
  all: ["planning"] as const,
  events: () => [...planningKeys.all, "events"] as const,
  eventList: (params?: PlanningEventsParams) =>
    [...planningKeys.events(), "list", params] as const,
  eventDetail: (eventId: string) =>
    [...planningKeys.events(), "detail", eventId] as const,
  calendar: (params: CalendarViewParams) =>
    [...planningKeys.all, "calendar", params] as const,
  forecastContext: (params: ForecastContextParams) =>
    [...planningKeys.all, "forecast-context", params] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Read hooks
// ─────────────────────────────────────────────────────────────────────────────

export function usePlanningEvents(
  params?: PlanningEventsParams,
  enabled = true,
) {
  return useQuery({
    queryKey: planningKeys.eventList(params),
    queryFn: () => planningService.listEvents(params),
    enabled,
    staleTime: 30_000,
  });
}

export function usePlanningEvent(eventId: string, enabled = true) {
  return useQuery({
    queryKey: planningKeys.eventDetail(eventId),
    queryFn: () => planningService.getEvent(eventId),
    enabled: enabled && !!eventId,
    staleTime: 30_000,
  });
}

export function usePlanningCalendar(
  params: CalendarViewParams,
  enabled = true,
) {
  return useQuery({
    queryKey: planningKeys.calendar(params),
    queryFn: () => planningService.getCalendarView(params),
    enabled: enabled && !!params.start && !!params.end,
    staleTime: 60_000,
  });
}

export function usePlanningForecastContext(
  params: ForecastContextParams,
  enabled = true,
) {
  return useQuery({
    queryKey: planningKeys.forecastContext(params),
    queryFn: () => planningService.getForecastContext(params),
    enabled: enabled && !!params.branch_id && !!params.date,
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useCreatePlanningEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCalendarEventPayload) =>
      planningService.createEvent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.events() });
      queryClient.invalidateQueries({ queryKey: [...planningKeys.all, "calendar"] });
      toast.success("Event created.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create event.");
    },
  });
}

export function useUpdatePlanningEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: UpdateCalendarEventPayload;
    }) => planningService.updateEvent(eventId, payload),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.events() });
      queryClient.invalidateQueries({
        queryKey: planningKeys.eventDetail(event.id),
      });
      queryClient.invalidateQueries({ queryKey: [...planningKeys.all, "calendar"] });
      toast.success("Event updated.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update event.");
    },
  });
}

export function useDeletePlanningEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => planningService.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.events() });
      queryClient.invalidateQueries({ queryKey: [...planningKeys.all, "calendar"] });
      toast.success("Event removed.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to delete event.");
    },
  });
}
