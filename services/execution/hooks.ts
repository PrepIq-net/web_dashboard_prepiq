import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import * as executionService from "./service";
import type {
  CreateTaskPayload,
  KitchenTask,
  TaskBoard,
  TaskStatus,
  UpdateTaskPayload,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────────────────

export const executionKeys = {
  all: ["execution"] as const,
  board: (branchId: string, date: string) =>
    [...executionKeys.all, "board", branchId, date] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Read hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useTaskBoard(branchId?: string, date?: string, enabled = true) {
  return useQuery({
    queryKey: executionKeys.board(branchId ?? "", date ?? ""),
    queryFn: () => executionService.getTaskBoard(branchId!, date!),
    enabled: enabled && !!branchId && !!date,
    staleTime: 15_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

function useInvalidateBoard() {
  const queryClient = useQueryClient();
  return (branchId: string, date: string) =>
    queryClient.invalidateQueries({
      queryKey: executionKeys.board(branchId, date),
    });
}

export function useGenerateTasks() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: ({ branchId, date }: { branchId: string; date: string }) =>
      executionService.generateTasks(branchId, date),
    onSuccess: (_data, { branchId, date }) => invalidate(branchId, date),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useConfirmTasks() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: ({
      branchId,
      date,
      taskIds,
    }: {
      branchId: string;
      date: string;
      taskIds: string[];
    }) => executionService.confirmTasks(branchId, date, taskIds),
    onSuccess: (data, { branchId, date }) => {
      invalidate(branchId, date);
      // Off-shift warnings are advice, not failure — the confirm went through.
      for (const warning of data.warnings) toast(warning, { icon: "⚠️" });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateTask() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) =>
      executionService.createTask(payload),
    onSuccess: (data, payload) => {
      invalidate(payload.branch_id, payload.date);
      for (const warning of data.warnings ?? []) toast(warning, { icon: "⚠️" });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: ({
      taskId,
      branchId,
      date: _date,
      payload,
    }: {
      taskId: string;
      branchId: string;
      date: string;
      payload: UpdateTaskPayload;
    }) => executionService.updateTask(taskId, branchId, payload),
    onSuccess: (_data, { branchId, date }) => invalidate(branchId, date),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: ({
      taskId,
      branchId,
    }: {
      taskId: string;
      branchId: string;
      date: string;
    }) => executionService.deleteTask(taskId, branchId),
    onSuccess: (_data, { branchId, date }) => invalidate(branchId, date),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAssignTask() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: ({
      taskId,
      branchId,
      userId,
    }: {
      taskId: string;
      branchId: string;
      date: string;
      userId: string | null;
    }) => executionService.assignTask(taskId, branchId, userId),
    onSuccess: (data, { branchId, date }) => {
      invalidate(branchId, date);
      for (const warning of data.warnings ?? []) toast(warning, { icon: "⚠️" });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Self-service: claim an unassigned task, or release a claim you made. */
export function useClaimTask() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: ({
      taskId,
      branchId,
      release,
    }: {
      taskId: string;
      branchId: string;
      date: string;
      release?: boolean;
    }) =>
      release
        ? executionService.releaseTask(taskId, branchId)
        : executionService.claimTask(taskId, branchId),
    onSuccess: (data, { branchId, date }) => {
      invalidate(branchId, date);
      for (const warning of data.warnings ?? []) toast(warning, { icon: "⚠️" });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Status changes drive the drag interaction, so this one is optimistic: the
 * card lands in its new column immediately and rolls back if the server
 * disagrees. Everything else on this page can afford a round trip; a drag
 * that snaps back half a second later cannot.
 */
export function useSetTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      branchId,
      status,
    }: {
      taskId: string;
      branchId: string;
      date: string;
      status: TaskStatus;
    }) => executionService.setTaskStatus(taskId, branchId, status),
    onMutate: async ({ taskId, branchId, date, status }) => {
      const key = executionKeys.board(branchId, date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskBoard>(key);

      if (previous) {
        const move = (task: KitchenTask): KitchenTask =>
          task.id === taskId ? { ...task, status } : task;
        const next: TaskBoard = {
          ...previous,
          suggestions: previous.suggestions.map(move),
          columns: Object.fromEntries(
            Object.entries(previous.columns).map(([column, tasks]) => [
              column,
              tasks.map(move).filter((task) => task.status === column),
            ]),
          ),
        };
        // A task that changed column needs to appear in its new one.
        const moved =
          previous.suggestions.find((t) => t.id === taskId) ??
          Object.values(previous.columns)
            .flat()
            .find((t) => t.id === taskId);
        if (moved && next.columns[status]) {
          const already = next.columns[status].some((t) => t.id === taskId);
          if (!already) {
            next.columns[status] = [
              ...next.columns[status],
              { ...moved, status },
            ];
          }
        }
        queryClient.setQueryData(key, next);
      }
      return { previous, key };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error(error.message);
    },
    onSettled: (_data, _error, { branchId, date }) => {
      queryClient.invalidateQueries({
        queryKey: executionKeys.board(branchId, date),
      });
    },
  });
}
