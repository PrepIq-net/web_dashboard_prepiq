"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshDouble, Shop } from "iconoir-react";
import {
  useAssignTask,
  useConfirmTasks,
  useCreateTask,
  useCurrentUserProfile,
  useDeleteTask,
  useGenerateTasks,
  useSetTaskStatus,
  useTaskBoard,
} from "@/services";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { useSelectedBranch } from "@/services/context/branch-store";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useTranslation } from "@/lib/i18n";
import { todayIso } from "@/lib/format";
import { TaskBoard } from "@/components/dashboard/tasks/task-board";
import { SuggestionsTray } from "@/components/dashboard/tasks/suggestions-tray";
import {
  AddTaskModal,
  type NewTaskValues,
} from "@/components/dashboard/tasks/add-task-modal";
import type { BoardStatus } from "@/services/execution/types";

export default function TasksPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const { branchOptions, defaultBranch, isLoading: branchesLoading } =
    useBranchOptions();
  const [branchId, setBranchId] = useSelectedBranch({
    branches: branchOptions,
    defaultBranchId: defaultBranch?.id,
  });

  // The board is a today surface. Yesterday's board is history, not work, so
  // there is deliberately no date picker in v1.
  const date = todayIso();

  const [addOpen, setAddOpen] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const permissions = useMemo(() => resolvePermissions(user), [user]);
  const canManage = permissions.has(PERMISSIONS.MANAGE_TASKS);

  const boardQuery = useTaskBoard(branchId, date);
  const generate = useGenerateTasks();
  const confirm = useConfirmTasks();
  const create = useCreateTask();
  const assign = useAssignTask();
  const remove = useDeleteTask();
  const setStatus = useSetTaskStatus();

  const board = boardQuery.data;

  const filteredBoard = useMemo(() => {
    if (!board || !assigneeFilter) return board;
    return {
      ...board,
      columns: Object.fromEntries(
        Object.entries(board.columns).map(([column, tasks]) => [
          column,
          tasks.filter((task) => task.assigned_to?.id === assigneeFilter),
        ]),
      ),
    };
  }, [board, assigneeFilter]);

  if (!branchesLoading && branchOptions.length === 0) {
    return (
      <WorkspaceShell
        eyebrow={t("tasks.eyebrow")}
        title={t("tasks.title")}
        description={t("tasks.description")}
        insight={t("tasks.insight")}
      >
        <BranchRequiredState />
      </WorkspaceShell>
    );
  }

  const handleConfirm = async (
    picks: { taskId: string; userId: string | null }[],
  ) => {
    if (!branchId || !board) return;
    // Push the chef's assignee edits first — assigning a SUGGESTED task is
    // silent by design, so nobody hears about a task until the confirm.
    for (const pick of picks) {
      const suggestion = board.suggestions.find((s) => s.id === pick.taskId);
      const suggested = suggestion?.suggested_assignee?.id ?? null;
      if (pick.userId !== suggested) {
        await assign.mutateAsync({
          taskId: pick.taskId,
          branchId,
          date,
          userId: pick.userId,
        });
      }
    }
    confirm.mutate({ branchId, date, taskIds: picks.map((p) => p.taskId) });
  };

  const handleCreate = (values: NewTaskValues) => {
    if (!branchId) return;
    create.mutate(
      {
        branch_id: branchId,
        date,
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        priority: values.priority,
        estimated_minutes: values.estimated_minutes,
        user_id: values.user_id,
      },
      { onSuccess: () => setAddOpen(false) },
    );
  };

  const handleMove = (taskId: string, status: BoardStatus) => {
    if (!branchId) return;
    setStatus.mutate({ taskId, branchId, date, status });
  };

  const assigneeOptions = [
    { value: "", label: t("tasks.filter.everyone") },
    ...(board?.assignees ?? []).map((person) => ({
      value: person.id,
      label: person.name,
    })),
  ];

  return (
    <WorkspaceShell
      eyebrow={t("tasks.eyebrow")}
      title={t("tasks.title")}
      description={t("tasks.description")}
      insight={t("tasks.insight")}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {branchOptions.length > 1 ? (
          <div className="w-56">
            <Select
              options={branchOptions.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              value={branchId}
              onChange={setBranchId}
              leadingIcon={<Shop className="h-4 w-4" />}
            />
          </div>
        ) : null}

        <div className="w-48">
          <Select
            options={assigneeOptions}
            value={assigneeFilter}
            onChange={setAssigneeFilter}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {canManage ? (
            <>
              <button
                type="button"
                onClick={() =>
                  branchId && generate.mutate({ branchId, date })
                }
                disabled={generate.isPending}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:bg-surface-3 disabled:opacity-50"
              >
                <RefreshDouble
                  className={`h-4 w-4 ${generate.isPending ? "animate-spin" : ""}`}
                />
                {t("tasks.actions.generate")}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20"
              >
                <Plus className="h-4 w-4" />
                {t("tasks.actions.add")}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {boardQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : boardQuery.isError ? (
        <p className="py-16 text-center text-sm text-status-critical">
          {t("tasks.loadError")}
        </p>
      ) : board ? (
        <>
          {canManage ? (
            <SuggestionsTray
              suggestions={board.suggestions}
              assignees={board.assignees}
              confirming={confirm.isPending || assign.isPending}
              onConfirm={handleConfirm}
              onDismiss={(taskId) =>
                branchId && remove.mutate({ taskId, branchId, date })
              }
            />
          ) : null}

          {filteredBoard ? (
            <TaskBoard
              board={filteredBoard}
              canManage={canManage}
              currentUserId={user?.id}
              onMove={handleMove}
            />
          ) : null}

          {board.suggestions.length === 0 &&
          Object.values(board.columns).every((column) => column.length === 0) ? (
            <p className="mt-6 text-center text-sm text-text-muted">
              {canManage ? t("tasks.emptyManager") : t("tasks.emptyStaff")}
            </p>
          ) : null}
        </>
      ) : null}

      <AddTaskModal
        open={addOpen}
        assignees={board?.assignees ?? []}
        saving={create.isPending}
        onClose={() => setAddOpen(false)}
        onSave={handleCreate}
      />
    </WorkspaceShell>
  );
}
