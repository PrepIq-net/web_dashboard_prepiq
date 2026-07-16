"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, User } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { KitchenTask } from "@/services/execution/types";

const CATEGORY_TONE: Record<string, string> = {
  PREP: "text-brand-gold border-brand-gold/40 bg-brand-gold/10",
  SETUP: "text-text-secondary border-surface-4 bg-surface-3/60",
  SERVICE: "text-status-critical border-status-critical/30 bg-status-critical/10",
  CLEANING: "text-text-secondary border-surface-4 bg-surface-3/60",
  OTHER: "text-text-secondary border-surface-4 bg-surface-3/60",
};

/**
 * One card on the board. Deliberately quiet — flat surface, border, no shadow
 * theatrics — per BRAND_SYSTEM.md; a kanban card earns its keep by being
 * scannable from a metre away, not by looking like Trello.
 */
export function TaskCard({
  task,
  draggable,
  onOpen,
}: {
  task: KitchenTask;
  draggable: boolean;
  onOpen?: (task: KitchenTask) => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { status: task.status },
      disabled: !draggable,
    });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(task)}
      className={`rounded-lg border border-surface-4 bg-surface-2 p-3 text-left transition-colors ${
        draggable ? "cursor-grab touch-none" : ""
      } ${isDragging ? "z-10 opacity-80" : "hover:border-brand-gold/40"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-text-primary">
          {task.title}
        </p>
        {task.priority === "HIGH" ? (
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-status-critical" />
        ) : null}
      </div>

      {task.links.length > 0 ? (
        <p className="mt-1 truncate text-xs text-text-muted">
          {task.links
            .map((link) => `${link.product_title} ×${link.planned_quantity}`)
            .join(" · ")}
        </p>
      ) : task.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-text-muted">
          {task.description}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
        <span
          className={`inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_TONE[task.category] ?? CATEGORY_TONE.OTHER}`}
        >
          {t(`tasks.category.${task.category.toLowerCase()}`)}
        </span>
        {task.estimated_minutes ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t("tasks.card.minutes", { count: task.estimated_minutes })}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1">
          <User className="h-3 w-3" />
          {task.assigned_to?.name ?? t("tasks.card.unassigned")}
        </span>
      </div>
    </div>
  );
}
