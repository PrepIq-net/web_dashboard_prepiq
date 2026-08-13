"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  InfoCircle,
  MapPin,
  Plus,
  ShieldCheck,
  Trash,
  Xmark,
} from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  useGrantMemberPermission,
  useMemberAccess,
  useRevokeMemberPermission,
} from "@/services/organizations/hooks";
import {
  useBranchAssignments,
  useRemoveBranchAssignment,
  useUpsertBranchAssignment,
} from "@/services/branches/hooks";
import type { Branch } from "@/services/branches/types";
import type {
  OrganizationMember,
  Permission,
} from "@/services/organizations/types";
import { PermissionPicker, type PermissionState } from "./permission-picker";

type RoleOption = { label: string; value: string };

type MemberAccessDrawerProps = {
  open: boolean;
  orgId: string;
  member: OrganizationMember | null;
  branches: Branch[];
  permissions: Permission[];
  /** System + custom roles assignable here (owner excluded by the caller). */
  roleOptions: RoleOption[];
  onClose: () => void;
  onChangeOrgRole: (userId: string, roleSlug: string) => void;
  isChangingOrgRole?: boolean;
};

/**
 * Everything about one person's access, in one place.
 *
 * The screen this replaces could only change someone's role, which forced a
 * new near-duplicate role every time one person needed one extra capability.
 * Three things are editable here instead:
 *
 *   1. the organization-level role,
 *   2. the branches they work at and the role they hold at each,
 *   3. individual permissions granted on top of the role — optionally scoped
 *      to a single branch.
 *
 * The permission list distinguishes "comes from their role" (locked, change
 * the role to affect it) from "granted to this person" (revocable here), so
 * it is always clear what removing something will actually do.
 */
export function MemberAccessDrawer({
  open,
  orgId,
  member,
  branches,
  permissions,
  roleOptions,
  onClose,
  onChangeOrgRole,
  isChangingOrgRole = false,
}: MemberAccessDrawerProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isAddingPermission, setIsAddingPermission] = useState(false);
  const [grantScopeBranchId, setGrantScopeBranchId] = useState("");
  const [assignBranchId, setAssignBranchId] = useState("");
  const [assignRoleSlug, setAssignRoleSlug] = useState("");

  const userId = member ? String(member.user) : undefined;

  const { data: access, isLoading: accessLoading } = useMemberAccess(
    orgId,
    open ? userId : undefined,
  );
  const { data: assignments, isLoading: assignmentsLoading } =
    useBranchAssignments(orgId, open ? userId : undefined);

  const grantPermission = useGrantMemberPermission(orgId, userId);
  const revokePermission = useRevokeMemberPermission(orgId, userId);
  const upsertAssignment = useUpsertBranchAssignment(orgId);
  const removeAssignment = useRemoveBranchAssignment(orgId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // Reset the transient forms whenever the drawer switches person.
  useEffect(() => {
    setIsAddingPermission(false);
    setGrantScopeBranchId("");
    setAssignBranchId("");
    setAssignRoleSlug("");
  }, [userId]);

  const roleCodes = useMemo(
    () => new Set(access?.role_permission_codes ?? []),
    [access],
  );
  const grantsByCode = useMemo(() => {
    const grants = access?.granted_permissions ?? [];
    const map = new Map<string, typeof grants>();
    for (const grant of grants) {
      map.set(grant.code, [...(map.get(grant.code) ?? []), grant]);
    }
    return map;
  }, [access]);

  const assignedBranches = assignments ?? [];
  const unassignedBranches = branches.filter(
    (branch) =>
      branch.is_active &&
      !assignedBranches.some((assignment) => assignment.branch === branch.id),
  );

  const permissionState = (code: string): PermissionState => {
    if (roleCodes.has(code)) return "locked";
    return grantsByCode.has(code) ? "on" : "off";
  };

  const handleTogglePermission = (code: string) => {
    if (roleCodes.has(code)) return;
    if (grantsByCode.has(code)) {
      revokePermission.mutate({ permission_code: code });
      return;
    }
    grantPermission.mutate({
      permission_code: code,
      branch_id: grantScopeBranchId || undefined,
    });
  };

  const handleAssignBranch = () => {
    if (!userId || !assignBranchId) return;
    upsertAssignment.mutate(
      {
        user_id: userId,
        branch_id: assignBranchId,
        custom_role_slug: assignRoleSlug || undefined,
      },
      {
        onSuccess: () => {
          setAssignBranchId("");
          setAssignRoleSlug("");
        },
      },
    );
  };

  if (!open || !member || !mounted) return null;

  const displayName =
    `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
    member.email;
  const grantCount = access?.granted_permissions.length ?? 0;
  const effectiveCount = access?.effective_permission_codes.length ?? 0;

  const drawer = (
    <div className="fixed inset-0 z-9999 flex">
      <div
        className="flex-1 bg-black/50"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="flex h-full w-[720px] max-w-[94vw] flex-col border-l border-surface-4 bg-surface-1 animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.memberDrawer.title", { name: displayName })}
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-surface-4 bg-surface-2 text-sm font-semibold text-brand-gold">
              {(
                member.first_name?.[0] ||
                member.email?.[0] ||
                "?"
              ).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-semibold text-text-primary">
                {displayName}
              </h2>
              <p className="truncate text-sm text-text-secondary">
                {member.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("settings.memberDrawer.close")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 scrollbar-thin">
          {/* ── Role ─────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="h-4 w-4 text-brand-gold"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-text-primary">
                {t("settings.memberDrawer.role.title")}
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              {t("settings.memberDrawer.role.help")}
            </p>
            <Select
              label={t("settings.memberDrawer.role.label")}
              value={member.custom_role_slug ?? ""}
              onChange={(value) => onChangeOrgRole(String(member.user), value)}
              options={roleOptions}
              disabled={isChangingOrgRole}
            />
            {access ? (
              <p className="text-xs text-text-muted">
                {t("settings.memberDrawer.role.summary", {
                  role:
                    access.role?.name ?? t("settings.memberDrawer.role.none"),
                  n: access.role_permission_codes.length,
                })}
              </p>
            ) : null}
          </section>

          {/* ── Branch assignments ───────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-gold" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text-primary">
                {t("settings.memberDrawer.branches.title")}
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              {t("settings.memberDrawer.branches.help")}
            </p>

            {assignmentsLoading ? (
              <p className="text-sm text-text-muted">
                {t("settings.memberDrawer.loading")}
              </p>
            ) : assignedBranches.length === 0 ? (
              <p className="rounded-lg border border-dashed border-surface-4 px-4 py-4 text-sm text-text-muted">
                {t("settings.memberDrawer.branches.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {assignedBranches.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-4 bg-surface-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {assignment.branch_name}
                      </p>
                      {/* role_name falls back to the org role, so say which
                          of the two the reader is looking at. */}
                      <p className="truncate text-xs text-text-muted">
                        {assignment.role_slug
                          ? assignment.role_name
                          : t("settings.memberDrawer.branches.inheritsNamed", {
                              role:
                                assignment.role_name ??
                                t("settings.memberDrawer.role.none"),
                            })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        value={assignment.role_slug ?? ""}
                        onChange={(event) =>
                          upsertAssignment.mutate({
                            user_id: String(member.user),
                            branch_id: assignment.branch,
                            custom_role_slug: event.target.value || undefined,
                          })
                        }
                        aria-label={t("settings.memberDrawer.branches.roleAt", {
                          branch: assignment.branch_name,
                        })}
                        className="rounded-md border border-surface-4 bg-surface-1 px-2 py-1 text-xs text-text-primary focus:border-brand-gold focus:outline-none"
                      >
                        <option value="">
                          {t("settings.memberDrawer.branches.inherits")}
                        </option>
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          removeAssignment.mutate({
                            user_id: String(member.user),
                            branch_id: assignment.branch,
                          })
                        }
                        disabled={removeAssignment.isPending}
                        aria-label={t("settings.memberDrawer.branches.remove", {
                          branch: assignment.branch_name,
                        })}
                        title={t("settings.memberDrawer.branches.remove", {
                          branch: assignment.branch_name,
                        })}
                        className="p-1.5 text-text-muted transition-colors hover:text-status-critical disabled:opacity-50"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {unassignedBranches.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-lg border border-surface-4 bg-surface-2 p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    label={t("settings.memberDrawer.branches.addLabel")}
                    value={assignBranchId}
                    onChange={setAssignBranchId}
                    placeholder={t(
                      "settings.memberDrawer.branches.addPlaceholder",
                    )}
                    options={unassignedBranches.map((branch) => ({
                      label: branch.name,
                      value: branch.id,
                    }))}
                  />
                </div>
                <div className="flex-1">
                  <Select
                    label={t("settings.memberDrawer.branches.addRoleLabel")}
                    value={assignRoleSlug}
                    onChange={setAssignRoleSlug}
                    options={[
                      {
                        label: t("settings.memberDrawer.branches.inherits"),
                        value: "",
                      },
                      ...roleOptions,
                    ]}
                  />
                </div>
                <Button
                  onClick={handleAssignBranch}
                  disabled={!assignBranchId || upsertAssignment.isPending}
                  leftIcon={<Plus className="h-4 w-4" />}
                  className="shrink-0"
                >
                  {upsertAssignment.isPending
                    ? t("settings.memberDrawer.branches.adding")
                    : t("settings.memberDrawer.branches.add")}
                </Button>
              </div>
            ) : null}
          </section>

          {/* ── Extra permissions ────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="h-4 w-4 text-brand-gold"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-text-primary">
                {t("settings.memberDrawer.extra.title")}
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">
              {t("settings.memberDrawer.extra.help")}
            </p>

            {accessLoading ? (
              <p className="text-sm text-text-muted">
                {t("settings.memberDrawer.loading")}
              </p>
            ) : grantCount === 0 ? (
              <p className="rounded-lg border border-dashed border-surface-4 px-4 py-4 text-sm text-text-muted">
                {t("settings.memberDrawer.extra.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {access?.granted_permissions.map((grant) => (
                  <li
                    key={grant.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                        {grant.label}
                        <span className="rounded-full border border-surface-4 bg-surface-1 px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                          {grant.branch_name
                            ? t("settings.memberDrawer.extra.scopedTo", {
                                branch: grant.branch_name,
                              })
                            : t("settings.memberDrawer.extra.allBranches")}
                        </span>
                      </p>
                      {grant.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                          {grant.description}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        revokePermission.mutate({ grant_id: grant.id })
                      }
                      disabled={revokePermission.isPending}
                      aria-label={t("settings.memberDrawer.extra.revoke", {
                        permission: grant.label,
                      })}
                      title={t("settings.memberDrawer.extra.revoke", {
                        permission: grant.label,
                      })}
                      className="shrink-0 p-1.5 text-text-muted transition-colors hover:text-status-critical disabled:opacity-50"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {isAddingPermission ? (
              <div className="space-y-4 rounded-lg border border-surface-4 bg-surface-2 p-4">
                <Select
                  label={t("settings.memberDrawer.extra.scopeLabel")}
                  value={grantScopeBranchId}
                  onChange={setGrantScopeBranchId}
                  options={[
                    {
                      label: t("settings.memberDrawer.extra.allBranches"),
                      value: "",
                    },
                    ...assignedBranches.map((assignment) => ({
                      label: assignment.branch_name,
                      value: assignment.branch,
                    })),
                  ]}
                />
                <p className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
                  <InfoCircle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted"
                    aria-hidden="true"
                  />
                  {t("settings.memberDrawer.extra.scopeHelp")}
                </p>
                <PermissionPicker
                  permissions={permissions}
                  getState={permissionState}
                  onToggle={handleTogglePermission}
                  lockedHint={t("settings.memberDrawer.extra.fromRole")}
                />
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setIsAddingPermission(false)}
                  >
                    {t("settings.memberDrawer.extra.done")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setIsAddingPermission(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                {t("settings.memberDrawer.extra.add")}
              </Button>
            )}
          </section>

          {/* ── Effective access ─────────────────────────────────────── */}
          <section className="space-y-2 border-t border-surface-4 pt-6">
            <h3 className="text-sm font-semibold text-text-primary">
              {t("settings.memberDrawer.effective.title")}
            </h3>
            <p className="text-xs leading-relaxed text-text-secondary">
              {t("settings.memberDrawer.effective.summary", {
                total: effectiveCount,
                role: access?.role_permission_codes.length ?? 0,
                extra: grantCount,
              })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
