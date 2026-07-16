import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import * as scheduleService from "./service";
import type {
  CreateShiftPayload,
  ReviewAvailabilityPayload,
  UpdateShiftPayload,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────────────────

export const scheduleKeys = {
  all: ["schedule"] as const,
  availability: (branchId: string, week: string) =>
    [...scheduleKeys.all, "availability", branchId, week] as const,
  week: (branchId: string, week: string) =>
    [...scheduleKeys.all, "week", branchId, week] as const,
  coverage: (branchId: string, week: string) =>
    [...scheduleKeys.all, "coverage", branchId, week] as const,
  history: (branchId: string, weeks: number) =>
    [...scheduleKeys.all, "history", branchId, weeks] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Read hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useAvailabilityWeek(branchId?: string, week?: string, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.availability(branchId ?? "", week ?? ""),
    queryFn: () => scheduleService.getAvailabilityWeek(branchId!, week!),
    enabled: enabled && !!branchId && !!week,
    staleTime: 30_000,
  });
}

export function useScheduleWeek(branchId?: string, week?: string, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.week(branchId ?? "", week ?? ""),
    queryFn: () => scheduleService.getScheduleWeek(branchId!, week!),
    enabled: enabled && !!branchId && !!week,
    staleTime: 30_000,
  });
}

export function useCoverage(branchId?: string, week?: string, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.coverage(branchId ?? "", week ?? ""),
    queryFn: () => scheduleService.getCoverage(branchId!, week!),
    enabled: enabled && !!branchId && !!week,
    staleTime: 30_000,
  });
}

export function useScheduleHistory(branchId?: string, weeks = 8, enabled = true) {
  return useQuery({
    queryKey: scheduleKeys.history(branchId ?? "", weeks),
    queryFn: () => scheduleService.getHistory(branchId!, weeks),
    enabled: enabled && !!branchId,
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Anything that changes a week invalidates its schedule, coverage and availability. */
function useWeekInvalidator(branchId?: string, week?: string) {
  const queryClient = useQueryClient();
  return () => {
    if (!branchId || !week) return;
    queryClient.invalidateQueries({ queryKey: scheduleKeys.week(branchId, week) });
    queryClient.invalidateQueries({ queryKey: scheduleKeys.coverage(branchId, week) });
    queryClient.invalidateQueries({ queryKey: scheduleKeys.availability(branchId, week) });
  };
}

/**
 * Assign an existing org member a branch role — this is what adds them to the
 * roster. Invalidates the whole schedule cache for the branch so the roster,
 * grid and availability all pick up the new person.
 */
export function useAssignRosterRole(branchId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { userId: string; roleSlug: string }) =>
      scheduleService.assignRosterRole({ branchId: branchId ?? "", ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Added to the roster.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useReviewAvailability(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: ({
      availabilityId,
      payload,
    }: {
      availabilityId: string;
      payload: ReviewAvailabilityPayload;
    }) => scheduleService.reviewAvailability(availabilityId, payload),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(
        variables.payload.status === "APPROVED"
          ? "Availability approved"
          : "Availability rejected",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useGenerateSchedule(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: () => scheduleService.generateSchedule(branchId!, week!),
    onSuccess: (data) => {
      invalidate();
      const count = data.schedule.shifts.length;
      if (count === 0) {
        toast.error("No shifts could be drafted — approve availability first.");
      } else {
        toast.success(`Drafted ${count} shifts. Review before publishing.`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCopyPreviousWeek(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: () => scheduleService.copyPreviousWeek(branchId!, week!),
    onSuccess: () => {
      invalidate();
      toast.success("Copied last week's shifts into this draft.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePublishSchedule(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: (scheduleId: string) => scheduleService.publishSchedule(scheduleId),
    onSuccess: () => {
      invalidate();
      toast.success("Schedule published — the team has been notified.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateShift(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: (payload: CreateShiftPayload) => scheduleService.createShift(payload),
    onSuccess: (data) => {
      invalidate();
      // Warnings are advisory (overlaps, off-shift): surface them without
      // implying the shift failed to save.
      data.warnings.forEach((warning) => toast(warning, { icon: "⚠️" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateShift(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: ({ shiftId, payload }: { shiftId: string; payload: UpdateShiftPayload }) =>
      scheduleService.updateShift(shiftId, payload),
    onSuccess: (data) => {
      invalidate();
      data.warnings.forEach((warning) => toast(warning, { icon: "⚠️" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteShift(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: (shiftId: string) => scheduleService.deleteShift(shiftId),
    onSuccess: () => {
      invalidate();
      toast.success("Shift removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRecomputeRequirements(branchId?: string, week?: string) {
  const invalidate = useWeekInvalidator(branchId, week);
  return useMutation({
    mutationFn: () => scheduleService.recomputeRequirements(branchId!, week!),
    onSuccess: () => {
      invalidate();
      toast.success("Staffing requirements recalculated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
