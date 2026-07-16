"use client";

import Link from "next/link";
import { Sparks, TaskList } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { useTaskBoard } from "@/services/execution/hooks";

/**
 * The bridge from the plan to the board. Locking generates task suggestions
 * out of band, and without this strip the chef would only discover them by
 * wandering to the Tasks page — the review step would silently never happen.
 *
 * Renders nothing before the plan is locked or when the board is empty, so on
 * a quiet morning it costs the page nothing.
 */
export function TasksStrip({
  branchId,
  targetDate,
  enabled,
}: {
  branchId: string;
  targetDate: string;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const boardQuery = useTaskBoard(branchId, targetDate, enabled);
  const board = boardQuery.data;

  if (!board) return null;

  const suggested = board.summary.suggested ?? 0;
  const todo = board.summary.todo ?? 0;
  const inProgress = board.summary.in_progress ?? 0;
  const done = board.summary.done ?? 0;

  if (suggested + todo + inProgress + done === 0) return null;

  const href = "/workspace/tasks";

  if (suggested > 0) {
    return (
      <Link
        href={href}
        className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-brand-gold/40 bg-brand-gold/5 px-5 py-3.5 transition-colors hover:bg-brand-gold/10"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Sparks className="h-4 w-4 text-brand-gold" />
          {t("today.tasksStrip.suggested", { count: suggested })}
        </span>
        <span className="text-sm font-semibold text-brand-gold">
          {t("today.tasksStrip.review")}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-surface-4 bg-surface-2 px-5 py-3.5 transition-colors hover:border-brand-gold/40"
    >
      <span className="flex items-center gap-2 text-sm text-text-secondary">
        <TaskList className="h-4 w-4" />
        {t("today.tasksStrip.counts", { todo, inProgress, done })}
      </span>
      <span className="text-sm text-brand-gold">{t("today.tasksStrip.open")}</span>
    </Link>
  );
}
