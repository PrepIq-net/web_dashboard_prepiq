"use client";

import { Check, TaskList } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import {
  useMyKitchenTasks,
  useSetMyTaskStatus,
} from "@/services/execution/hooks";
import type { MyKitchenTask } from "@/services/execution/types";

/**
 * Self-service — the signed-in person's own assigned tasks, with the two
 * moves that matter: Start, and Done. Complementary to `TasksStrip` (the
 * manager-facing board-count teaser), not a replacement for it — ported from
 * `mobile-app/src/components/today/my-tasks-card.tsx`, which has carried this
 * since it shipped.
 *
 * Renders nothing when nothing is assigned to this person today.
 */
export function MyTasksCard({ date }: { date: string }) {
  const { t } = useTranslation();
  const { data } = useMyKitchenTasks(date);
  const setStatus = useSetMyTaskStatus(date);

  const tasks = (data?.tasks ?? []).filter((task) => task.status !== "CANCELLED");
  if (tasks.length === 0) return null;

  const openCount = tasks.filter((task) => task.status !== "DONE").length;

  const advance = (task: MyKitchenTask) => {
    if (setStatus.isPending) return;
    const next = task.status === "TODO" ? "IN_PROGRESS" : "DONE";
    setStatus.mutate({ taskId: task.id, branchId: task.branch_id, status: next });
  };

  return (
    <div className="mb-6 rounded-xl border border-surface-4 bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TaskList className="h-4 w-4 text-brand-gold" strokeWidth={1.75} />
        <p className="font-display text-sm font-semibold text-text-primary">
          {t("today.myTasks.title")}
        </p>
        <p className="text-xs text-text-muted">
          {t("today.myTasks.count", { count: openCount })}
        </p>
      </div>

      <div className="divide-y divide-surface-4/60">
        {tasks.map((task) => {
          const done = task.status === "DONE";
          const inProgress = task.status === "IN_PROGRESS";
          const detail =
            task.links.length > 0
              ? task.links
                  .map((link) => `${link.product_title} ×${link.planned_quantity}`)
                  .join(" · ")
              : task.description;

          return (
            <div
              key={task.id}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  done
                    ? "bg-status-success/10"
                    : inProgress
                      ? "border border-brand-gold"
                      : "border border-surface-4"
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3 text-status-success" strokeWidth={2.5} />
                ) : null}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${done ? "text-text-muted" : "text-text-primary"}`}
                >
                  {task.title}
                </p>
                {detail ? (
                  <p className="truncate text-xs text-text-muted">{detail}</p>
                ) : null}
              </div>

              {!done ? (
                <button
                  type="button"
                  onClick={() => advance(task)}
                  disabled={setStatus.isPending}
                  className={`h-7 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    inProgress
                      ? "bg-brand-gold text-[#141416] hover:bg-brand-gold-hover"
                      : "bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20"
                  }`}
                >
                  {inProgress ? t("today.myTasks.done") : t("today.myTasks.start")}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
