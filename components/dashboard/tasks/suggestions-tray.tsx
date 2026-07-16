"use client";

import { useState } from "react";
import { Sparks, Xmark } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { Select } from "@/components/ui/select";
import type { BoardAssignee, KitchenTask } from "@/services/execution/types";

/**
 * The review step. Suggestions are the AI's guess at how to split the locked
 * plan — nothing here has been promised to anyone yet, which is exactly why
 * this tray exists: the chef edits owners, drops what's wrong, and only
 * "Confirm" turns a guess into somebody's instruction (and their push
 * notification).
 */
export function SuggestionsTray({
  suggestions,
  assignees,
  confirming,
  onConfirm,
  onDismiss,
}: {
  suggestions: KitchenTask[];
  assignees: BoardAssignee[];
  confirming: boolean;
  onConfirm: (picks: { taskId: string; userId: string | null }[]) => void;
  onDismiss: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  // Chef's overrides, keyed by task. Absent = keep the AI's suggestion.
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  if (suggestions.length === 0) return null;

  const options = [
    { value: "", label: t("tasks.tray.unassigned") },
    ...assignees.map((person) => ({
      value: person.id,
      label:
        person.assigned_count > 0
          ? `${person.name} (${t("tasks.tray.load", { count: person.assigned_count })})`
          : person.name,
    })),
  ];

  const resolvedAssignee = (task: KitchenTask) =>
    overrides[task.id] ?? task.suggested_assignee?.id ?? "";

  const handleConfirm = () => {
    onConfirm(
      suggestions.map((task) => ({
        taskId: task.id,
        userId: resolvedAssignee(task) || null,
      })),
    );
  };

  return (
    <section className="mb-8 rounded-xl border border-brand-gold/40 bg-brand-gold/5">
      <div className="flex items-center justify-between gap-4 border-b border-brand-gold/20 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparks className="h-4 w-4 text-brand-gold" />
          <p className="text-sm font-semibold text-text-primary">
            {t("tasks.tray.title", { count: suggestions.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming}
          className="inline-flex h-9 items-center rounded-lg bg-brand-gold px-4 text-sm font-semibold text-surface-1 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {confirming
            ? t("tasks.tray.confirming")
            : t("tasks.tray.confirm", { count: suggestions.length })}
        </button>
      </div>

      <div className="divide-y divide-brand-gold/10">
        {suggestions.map((task) => (
          <div key={task.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">{task.title}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {task.links.length > 0
                  ? task.links
                      .map((link) => `${link.product_title} ×${link.planned_quantity}`)
                      .join(" · ")
                  : task.rationale || task.description}
              </p>
            </div>
            {task.estimated_minutes ? (
              <span className="text-xs tabular-nums text-text-muted">
                ~{t("tasks.card.minutes", { count: task.estimated_minutes })}
              </span>
            ) : null}
            <div className="w-44">
              <Select
                options={options}
                value={resolvedAssignee(task)}
                onChange={(value) =>
                  setOverrides((prev) => ({ ...prev, [task.id]: value }))
                }
              />
            </div>
            <button
              type="button"
              onClick={() => onDismiss(task.id)}
              aria-label={t("tasks.tray.dismiss")}
              className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-status-critical"
            >
              <Xmark className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
