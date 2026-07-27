"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTranslation } from "@/lib/i18n";
import { TaskCard } from "./task-card";
import {
  BOARD_STATUSES,
  type BoardStatus,
  type KitchenTask,
  type TaskBoard as TaskBoardData,
} from "@/services/execution/types";

const COLUMN_TONE: Record<BoardStatus, string> = {
  TODO: "border-surface-4",
  IN_PROGRESS: "border-brand-gold/50",
  DONE: "border-status-positive/40",
};

function BoardColumn({
  status,
  tasks,
  canDrag,
  canDragTask,
  onOpen,
  onEdit,
  onClaim,
  onRelease,
  canClaimTask,
  canReleaseTask,
  claimPending,
  highlightAi,
}: {
  status: BoardStatus;
  tasks: KitchenTask[];
  canDrag: boolean;
  canDragTask: (task: KitchenTask) => boolean;
  onOpen?: (task: KitchenTask) => void;
  onEdit?: (task: KitchenTask) => void;
  onClaim?: (task: KitchenTask) => void;
  onRelease?: (task: KitchenTask) => void;
  canClaimTask: (task: KitchenTask) => boolean;
  canReleaseTask: (task: KitchenTask) => boolean;
  claimPending?: boolean;
  highlightAi?: boolean;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[280px] flex-col rounded-xl border bg-surface-1/60 ${COLUMN_TONE[status]} ${
        isOver ? "bg-brand-gold/5" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-surface-4/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
          {t(`tasks.column.${status.toLowerCase()}`)}
        </p>
        <span className="text-xs tabular-nums text-text-muted">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {tasks.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-text-muted">
            {t(`tasks.column.empty.${status.toLowerCase()}`)}
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              draggable={canDrag && canDragTask(task)}
              onOpen={onOpen}
              onEdit={onEdit}
              onClaim={onClaim}
              onRelease={onRelease}
              canClaim={canClaimTask(task)}
              canRelease={canReleaseTask(task)}
              claimPending={claimPending}
              highlightAi={highlightAi}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Three columns, drag between them. Pointer, touch AND keyboard sensors from
 * day one — the kitchen runs on tablets, and the keyboard sensor is what keeps
 * the board operable without a pointer at all.
 */
export function TaskBoard({
  board,
  canManage,
  currentUserId,
  onMove,
  onOpen,
  onEdit,
  onClaim,
  onRelease,
  claimPending,
  highlightAi,
}: {
  board: TaskBoardData;
  canManage: boolean;
  currentUserId?: string;
  onMove: (taskId: string, status: BoardStatus) => void;
  onOpen?: (task: KitchenTask) => void;
  onEdit?: (task: KitchenTask) => void;
  onClaim?: (task: KitchenTask) => void;
  onRelease?: (task: KitchenTask) => void;
  claimPending?: boolean;
  highlightAi?: boolean;
}) {
  const sensors = useSensors(
    // The activation distance is what keeps a plain tap working as a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // Managers move anything; everyone else exactly their own card — the same
  // rule the API enforces, mirrored so a forbidden drag never starts.
  const canDragTask = (task: KitchenTask) =>
    canManage || (!!currentUserId && task.assigned_to?.id === currentUserId);

  // Claim is a staff affordance for unassigned work; managers assign through
  // the edit modal instead. Release only undoes a claim you made yourself.
  const canClaimTask = (task: KitchenTask) =>
    !canManage && !task.assigned_to;
  const canReleaseTask = (task: KitchenTask) =>
    !!task.self_assigned && !!currentUserId && task.assigned_to?.id === currentUserId;

  const handleDragEnd = (event: DragEndEvent) => {
    const target = event.over?.id;
    const from = event.active.data.current?.status;
    if (!target || target === from) return;
    if (!BOARD_STATUSES.includes(target as BoardStatus)) return;
    onMove(String(event.active.id), target as BoardStatus);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid gap-4 md:grid-cols-3">
        {BOARD_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={board.columns[status] ?? []}
            canDrag
            canDragTask={canDragTask}
            onOpen={onOpen}
            onEdit={onEdit}
            onClaim={onClaim}
            onRelease={onRelease}
            canClaimTask={canClaimTask}
            canReleaseTask={canReleaseTask}
            claimPending={claimPending}
            highlightAi={highlightAi}
          />
        ))}
      </div>
    </DndContext>
  );
}
