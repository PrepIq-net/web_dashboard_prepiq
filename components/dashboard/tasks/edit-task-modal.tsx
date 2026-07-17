"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  Field,
  NativeSelect,
  TextArea,
  TextInput,
} from "@/components/ui/form-field";
import {
  TASK_CATEGORIES,
  type BoardAssignee,
  type KitchenTask,
  type TaskCategory,
} from "@/services/execution/types";

export type EditTaskValues = {
  title: string;
  description: string;
  category: TaskCategory;
  priority: "LOW" | "NORMAL" | "HIGH";
  estimated_minutes?: number;
  /** Distinct from content fields: assignment travels through its own endpoint. */
  user_id: string | null;
};

/** Manager-only: reword, reprioritise or reassign an existing card. */
export function EditTaskModal({
  task,
  assignees,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  task: KitchenTask | null;
  assignees: BoardAssignee[];
  saving: boolean;
  onClose: () => void;
  onSave: (taskId: string, values: EditTaskValues) => void;
  onDelete?: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("PREP");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH">("NORMAL");
  const [minutes, setMinutes] = useState("");
  const [userId, setUserId] = useState("");

  // Re-seed the form each time a different card is opened.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description);
    setCategory(task.category);
    setPriority(task.priority);
    setMinutes(task.estimated_minutes ? String(task.estimated_minutes) : "");
    setUserId(task.assigned_to?.id ?? "");
  }, [task]);

  const handleSave = () => {
    if (!task || !title.trim()) return;
    onSave(task.id, {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      estimated_minutes: minutes ? Number(minutes) : undefined,
      user_id: userId || null,
    });
  };

  return (
    <ModalShell
      open={task !== null}
      title={t("tasks.edit.title")}
      description={t("tasks.edit.description")}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          {onDelete && task ? (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg border border-status-critical/40 px-4 text-sm text-status-critical transition-colors hover:bg-status-critical/10 disabled:opacity-50"
            >
              {t("tasks.edit.delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:bg-surface-3"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="inline-flex h-9 items-center rounded-lg bg-brand-gold px-4 text-sm font-semibold text-surface-1 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t("tasks.edit.saving") : t("tasks.edit.save")}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {task?.source !== "MANUAL" && task?.rationale ? (
          <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-gold">
              {t("tasks.edit.aiRationale")}
            </p>
            <p className="mt-1 text-xs text-text-secondary">{task.rationale}</p>
          </div>
        ) : null}
        <Field label={t("tasks.add.fieldTitle")}>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            autoFocus
          />
        </Field>
        <Field label={t("tasks.add.fieldDescription")}>
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={500}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tasks.add.fieldCategory")}>
            <NativeSelect
              value={category}
              onChange={(event) => setCategory(event.target.value as TaskCategory)}
            >
              {TASK_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {t(`tasks.category.${value.toLowerCase()}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("tasks.add.fieldPriority")}>
            <NativeSelect
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as "LOW" | "NORMAL" | "HIGH")
              }
            >
              <option value="LOW">{t("tasks.priority.low")}</option>
              <option value="NORMAL">{t("tasks.priority.normal")}</option>
              <option value="HIGH">{t("tasks.priority.high")}</option>
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tasks.add.fieldMinutes")}>
            <TextInput
              type="number"
              min={5}
              max={480}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </Field>
          <Field label={t("tasks.add.fieldAssignee")}>
            <NativeSelect
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">{t("tasks.tray.unassigned")}</option>
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}
