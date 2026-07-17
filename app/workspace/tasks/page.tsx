"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
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
  useUpdateTask,
} from "@/services";
import { useTaskBoardRealtime } from "@/services/execution/use-task-board-realtime";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { useSelectedBranch } from "@/services/context/branch-store";
import { useSubscriptionTier } from "@/services/payment/hooks";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { BranchRequiredState } from "@/components/dashboard/empty-states/branch-required-state";
import { SubscriptionRequiredState } from "@/components/dashboard/empty-states/subscription-required-state";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { useTranslation } from "@/lib/i18n";
import { UUID_PATTERN } from "@/lib/constants";
import { todayIso } from "@/lib/format";
import { TaskBoard } from "@/components/dashboard/tasks/task-board";
import { SuggestionsTray } from "@/components/dashboard/tasks/suggestions-tray";
import {
  AddTaskModal,
  type NewTaskValues,
} from "@/components/dashboard/tasks/add-task-modal";
import {
  EditTaskModal,
  type EditTaskValues,
} from "@/components/dashboard/tasks/edit-task-modal";
import type { BoardStatus, KitchenTask } from "@/services/execution/types";

/**
 * Board scope for dual-role users. Permissions are additive — a working
 * manager is also a person on shift with their own cards — so instead of a
 * manager/staff mode fork, everyone gets the same board behind a Team/Mine
 * lens. Staff see Team read-only (their own cards stay movable); the last
 * choice sticks per browser.
 */
type BoardScope = "TEAM" | "MINE";
const SCOPE_STORAGE_KEY = "prepiq.tasks.scope";

function TasksPageContent() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUserProfile();
  const searchParams = useSearchParams();
  const { branchOptions, defaultBranch, isLoading: branchesLoading } =
    useBranchOptions();
  const [branchId, setBranchId] = useSelectedBranch({
    branches: branchOptions,
    defaultBranchId: defaultBranch?.id,
  });
  const safeBranchId = UUID_PATTERN.test(branchId) ? branchId : "";
  const { isLoading: subLoading, shouldBlockAccess, gateVariant } =
    useSubscriptionTier(safeBranchId || undefined);
  const subscriptionBlocked = Boolean(safeBranchId) && !subLoading && shouldBlockAccess;

  // The board is a today surface. Yesterday's board is history, not work, so
  // there is deliberately no date picker in v1.
  const date = todayIso();

  const [addOpen, setAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KitchenTask | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  // Set when the manager arrives from the "PrepIQ AI suggested tasks" toast:
  // AI cards get a gold ring and the review tray scrolls into view.
  const [highlightAi, setHighlightAi] = useState(false);

  // Deep-link support: /workspace/tasks?branch=<id>&highlight=ai
  useEffect(() => {
    const paramBranch = searchParams.get("branch");
    if (paramBranch && UUID_PATTERN.test(paramBranch)) {
      setBranchId(paramBranch);
    }
    // The AI review tray is a Team-scope surface; arriving via the toast
    // deep-link means "review the suggestions", so flip the lens over there.
    if (searchParams.get("highlight") === "ai") {
      setHighlightAi(true);
      setScope("TEAM");
    } else {
      setHighlightAi(false);
    }
  }, [searchParams, setBranchId]);

  const permissions = useMemo(() => resolvePermissions(user), [user]);
  const canManage = permissions.has(PERMISSIONS.MANAGE_TASKS);

  const [scope, setScope] = useState<BoardScope>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SCOPE_STORAGE_KEY);
      if (stored === "TEAM" || stored === "MINE") return stored;
    }
    return "TEAM";
  });
  const changeScope = (next: BoardScope) => {
    setScope(next);
    window.localStorage.setItem(SCOPE_STORAGE_KEY, next);
  };
  // Managers land on Team, staff on Mine — but only until they've chosen.
  useEffect(() => {
    if (!user) return;
    if (window.localStorage.getItem(SCOPE_STORAGE_KEY)) return;
    setScope(canManage ? "TEAM" : "MINE");
  }, [user, canManage]);

  const boardQuery = useTaskBoard(branchId, date, !subscriptionBlocked);
  const generate = useGenerateTasks();
  const confirm = useConfirmTasks();
  const create = useCreateTask();
  const assign = useAssignTask();
  const remove = useDeleteTask();
  const update = useUpdateTask();
  const setStatus = useSetTaskStatus();

  // Live sync: another admin's move lands here without a manual refresh. When
  // the AI drafts new suggestions for this day, managers hear about it in place.
  useTaskBoardRealtime(safeBranchId || undefined, date, (count) => {
    if (!canManage) return;
    setHighlightAi(true);
    setScope("TEAM");
    toast(t("tasks.aiSuggestedToast", { count }), {
      id: "ai-tasks-suggested",
      icon: "✨",
      duration: 8000,
    });
  });

  const board = boardQuery.data;

  const trayRef = useRef<HTMLDivElement | null>(null);
  const suggestionCount = board?.suggestions.length ?? 0;
  useEffect(() => {
    if (highlightAi && suggestionCount > 0) {
      trayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [highlightAi, suggestionCount]);

  const filteredBoard = useMemo(() => {
    if (!board) return board;
    // Team is the whole kitchen (the backend deliberately lets every member
    // read the board); Mine is the personal lens. Move rights are unchanged
    // either way — a card is draggable only by a manager or its assignee.
    const keep = (task: KitchenTask) =>
      scope === "MINE"
        ? task.assigned_to?.id === user?.id
        : !assigneeFilter || task.assigned_to?.id === assigneeFilter;
    if (scope === "TEAM" && !assigneeFilter) return board;
    return {
      ...board,
      columns: Object.fromEntries(
        Object.entries(board.columns).map(([column, tasks]) => [
          column,
          tasks.filter(keep),
        ]),
      ),
    };
  }, [board, assigneeFilter, scope, user?.id]);

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

  const handleEditSave = async (taskId: string, values: EditTaskValues) => {
    if (!branchId || !editingTask) return;
    const previousAssignee = editingTask.assigned_to?.id ?? null;
    await update.mutateAsync({
      taskId,
      branchId,
      date,
      payload: {
        title: values.title,
        description: values.description,
        category: values.category,
        priority: values.priority,
        estimated_minutes: values.estimated_minutes,
      },
    });
    if (values.user_id !== previousAssignee) {
      await assign.mutateAsync({
        taskId,
        branchId,
        date,
        userId: values.user_id,
      });
    }
    setEditingTask(null);
  };

  const handleEditDelete = (taskId: string) => {
    if (!branchId) return;
    remove.mutate(
      { taskId, branchId, date },
      { onSuccess: () => setEditingTask(null) },
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
      description={canManage ? t("tasks.description") : t("tasks.descriptionStaff")}
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

        <div className="inline-flex h-9 items-center rounded-lg border border-surface-4 p-0.5">
          {(["TEAM", "MINE"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeScope(option)}
              className={`inline-flex h-full items-center rounded-md px-3 text-xs font-semibold transition-colors ${
                scope === option
                  ? "bg-surface-3 text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {option === "TEAM"
                ? t("tasks.scope.team")
                : t("tasks.scope.mine")}
            </button>
          ))}
        </div>

        {canManage && scope === "TEAM" ? (
          <div className="w-48">
            <Select
              options={assigneeOptions}
              value={assigneeFilter}
              onChange={setAssigneeFilter}
            />
          </div>
        ) : null}

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

      {subscriptionBlocked ? (
        <SubscriptionRequiredState variant={gateVariant} compact />
      ) : boardQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : boardQuery.isError ? (
        <p className="py-16 text-center text-sm text-status-critical">
          {t("tasks.loadError")}
        </p>
      ) : board ? (
        <>
          {canManage && scope === "TEAM" ? (
            <div
              ref={trayRef}
              className={
                highlightAi && board.suggestions.length > 0
                  ? "rounded-xl ring-1 ring-brand-gold/40"
                  : undefined
              }
            >
              <SuggestionsTray
                suggestions={board.suggestions}
                assignees={board.assignees}
                confirming={confirm.isPending || assign.isPending}
                onConfirm={handleConfirm}
                onDismiss={(taskId) =>
                  branchId && remove.mutate({ taskId, branchId, date })
                }
              />
            </div>
          ) : null}

          {filteredBoard ? (
            <TaskBoard
              board={filteredBoard}
              canManage={canManage}
              currentUserId={user?.id}
              onMove={handleMove}
              onEdit={canManage ? setEditingTask : undefined}
              highlightAi={highlightAi}
            />
          ) : null}

          {board.suggestions.length === 0 &&
          Object.values(board.columns).every((column) => column.length === 0) ? (
            <p className="mt-6 text-center text-sm text-text-muted">
              {canManage ? t("tasks.emptyManager") : t("tasks.emptyStaff")}
            </p>
          ) : scope === "MINE" &&
            filteredBoard &&
            Object.values(filteredBoard.columns).every(
              (column) => column.length === 0,
            ) ? (
            <p className="mt-6 text-center text-sm text-text-muted">
              {t("tasks.emptyMine")}
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
      <EditTaskModal
        task={editingTask}
        assignees={board?.assignees ?? []}
        saving={update.isPending || assign.isPending || remove.isPending}
        onClose={() => setEditingTask(null)}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
      />
    </WorkspaceShell>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageContent />
    </Suspense>
  );
}
