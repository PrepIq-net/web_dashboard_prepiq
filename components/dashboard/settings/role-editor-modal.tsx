"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalShell } from "@/components/ui/modal-shell";
import type { Permission, Role } from "@/services/organizations/types";
import { PermissionPicker, type PermissionState } from "./permission-picker";

export type RoleFormValues = {
  name: string;
  description: string;
  permission_codes: string[];
};

type RoleEditorModalProps = {
  open: boolean;
  /** Null creates a new role; a role edits it. System roles open read-only. */
  role: Role | null;
  permissions: Permission[];
  isSaving?: boolean;
  onClose: () => void;
  onSave: (values: RoleFormValues) => void;
};

/**
 * Create or edit a role, with every permission explained in place.
 *
 * System roles open here too, read-only — being able to see exactly what
 * "Admin" carries is what makes the choice between using a system role and
 * building a custom one an informed one.
 */
export function RoleEditorModal({
  open,
  role,
  permissions,
  isSaving = false,
  onClose,
  onSave,
}: RoleEditorModalProps) {
  const { t } = useTranslation();
  const isReadOnly = Boolean(role?.is_system);
  const [form, setForm] = useState<RoleFormValues>({
    name: "",
    description: "",
    permission_codes: [],
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: role?.name ?? "",
      description: role?.description ?? "",
      permission_codes: role?.permission_codes ?? [],
    });
  }, [open, role]);

  // Read-only roles list only what they carry, all locked — the question a
  // reader has about a system role is "what can this person do?", not "what
  // could I add?".
  const visiblePermissions = isReadOnly
    ? permissions.filter((permission) =>
        form.permission_codes.includes(permission.code),
      )
    : permissions;

  const permissionState = (code: string): PermissionState => {
    if (isReadOnly) return "locked";
    return form.permission_codes.includes(code) ? "on" : "off";
  };

  const handleToggle = (code: string) => {
    if (isReadOnly) return;
    setForm((previous) => ({
      ...previous,
      permission_codes: previous.permission_codes.includes(code)
        ? previous.permission_codes.filter((existing) => existing !== code)
        : [...previous.permission_codes, code],
    }));
  };

  const handleBulkChange = (codes: string[], select: boolean) => {
    if (isReadOnly) return;
    setForm((previous) => {
      const next = new Set(previous.permission_codes);
      for (const code of codes) {
        if (select) next.add(code);
        else next.delete(code);
      }
      return { ...previous, permission_codes: [...next] };
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t("settings.roles.modal.nameError"));
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  };

  const title = isReadOnly
    ? t("settings.roles.viewModal.title", { name: role?.name ?? "" })
    : role
      ? t("settings.roles.editModal.title")
      : t("settings.roles.createModal.title");

  const description = isReadOnly
    ? t("settings.roles.viewModal.description")
    : role
      ? t("settings.roles.editModal.description")
      : t("settings.roles.createModal.description");

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      maxWidthClassName="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {isReadOnly
              ? t("settings.roles.viewModal.close")
              : t("settings.roles.modal.cancel")}
          </Button>
          {isReadOnly ? null : (
            <Button onClick={handleSave} disabled={isSaving}>
              {role
                ? isSaving
                  ? t("settings.roles.modal.updating")
                  : t("settings.roles.modal.update")
                : isSaving
                  ? t("settings.roles.modal.creating")
                  : t("settings.roles.modal.create")}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6 py-2">
        {isReadOnly ? (
          <p className="rounded-lg border border-surface-4 bg-surface-2 px-4 py-3 text-sm text-text-secondary">
            {t("settings.roles.viewModal.systemNotice")}
          </p>
        ) : (
          <div className="space-y-4">
            <Input
              label={t("settings.roles.modal.roleNameLabel")}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder={t("settings.roles.modal.roleNamePlaceholder")}
            />
            <Input
              label={t("settings.roles.modal.descriptionLabel")}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              placeholder={t("settings.roles.modal.descriptionPlaceholder")}
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-medium text-text-primary">
              {t("settings.roles.modal.permissionsLabel")}
            </h4>
            <p className="text-sm text-text-muted">
              {isReadOnly
                ? t("settings.roles.viewModal.count", {
                    n: form.permission_codes.length,
                  })
                : t("settings.roles.modal.selected", {
                    n: form.permission_codes.length,
                    m: permissions.length,
                  })}
            </p>
          </div>
          <PermissionPicker
            permissions={visiblePermissions}
            getState={permissionState}
            onToggle={handleToggle}
            allowBulkSelect={!isReadOnly}
            onBulkChange={handleBulkChange}
            emptyLabel={t("settings.roles.noPermissions")}
          />
        </div>
      </div>
    </ModalShell>
  );
}
