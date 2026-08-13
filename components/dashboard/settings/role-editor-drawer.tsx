"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Xmark } from "iconoir-react";
import { toast } from "react-hot-toast";

import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Permission, Role } from "@/services/organizations/types";

import { PermissionPicker, type PermissionState } from "./permission-picker";

export type RoleFormValues = {
  name: string;
  description: string;
  permission_codes: string[];
};

type RoleEditorDrawerProps = {
  open: boolean;
  role: Role | null;
  permissions: Permission[];
  isSaving?: boolean;
  onClose: () => void;
  onSave: (values: RoleFormValues) => void;
};

export function RoleEditorDrawer({
  open,
  role,
  permissions,
  isSaving = false,
  onClose,
  onSave,
}: RoleEditorDrawerProps) {
  const { t } = useTranslation();

  const [mounted, setMounted] = useState(false);

  const isReadOnly = Boolean(role?.is_system);

  const [form, setForm] = useState<RoleFormValues>({
    name: "",
    description: "",
    permission_codes: [],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setForm({
      name: role?.name ?? "",
      description: role?.description ?? "",
      permission_codes: role?.permission_codes ?? [],
    });
  }, [open, role]);

  useEffect(() => {
    if (!open) return;

    // The page behind stays scrollable, consistent with every other drawer.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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

      codes.forEach((code) => {
        if (select) {
          next.add(code);
        } else {
          next.delete(code);
        }
      });

      return {
        ...previous,
        permission_codes: [...next],
      };
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t("settings.roles.modal.nameError"));
      return;
    }

    onSave({
      ...form,
      name: form.name.trim(),
    });
  };

  const title = isReadOnly
    ? t("settings.roles.viewModal.title", {
        name: role?.name ?? "",
      })
    : role
      ? t("settings.roles.editModal.title")
      : t("settings.roles.createModal.title");

  const description = isReadOnly
    ? t("settings.roles.viewModal.description")
    : role
      ? t("settings.roles.editModal.description")
      : t("settings.roles.createModal.description");

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex">
      <div
        className="flex-1 bg-black/50"
        onClick={onClose}
        role="presentation"
      />

      <div
        className="flex h-full w-[768px] max-w-[96vw] flex-col border-l border-surface-4 bg-surface-1 animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-4 px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {title}
            </h2>

            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          <div className="space-y-6">
            {isReadOnly ? (
              <div className="rounded-lg border border-surface-4 bg-surface-2 px-4 py-3 text-sm text-text-secondary">
                {t("settings.roles.viewModal.systemNotice")}
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label={t("settings.roles.modal.roleNameLabel")}
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder={t("settings.roles.modal.roleNamePlaceholder")}
                />

                <Input
                  label={t("settings.roles.modal.descriptionLabel")}
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
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
        </div>

        <footer className="flex justify-end gap-3 border-t border-surface-4 px-6 py-5">
          {!isReadOnly && (
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
        </footer>
      </div>
    </div>,
    document.body,
  );
}
