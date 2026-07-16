"use client";

import { useState } from "react";
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
  type TaskCategory,
} from "@/services/execution/types";

export type NewTaskValues = {
  title: string;
  description: string;
  category: TaskCategory;
  priority: "LOW" | "NORMAL" | "HIGH";
  estimated_minutes?: number;
  user_id: string | null;
};

/** A task the chef thought of. Lands straight on the board — their decision. */
export function AddTaskModal({
  open,
  assignees,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  assignees: BoardAssignee[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: NewTaskValues) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("PREP");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH">("NORMAL");
  const [minutes, setMinutes] = useState("");
  const [userId, setUserId] = useState("");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
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
      open={open}
      title={t("tasks.add.title")}
      description={t("tasks.add.description")}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
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
            {saving ? t("tasks.add.saving") : t("tasks.add.save")}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("tasks.add.fieldTitle")}>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("tasks.add.titlePlaceholder")}
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
