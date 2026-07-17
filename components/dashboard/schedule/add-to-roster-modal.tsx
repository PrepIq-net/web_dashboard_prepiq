"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ModalShell } from "@/components/ui/modal-shell";
import { Field, TextInput } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import {
  useOrganizationMembers,
  useOrganizationRoles,
} from "@/services/organizations/hooks";
import { SYSTEM_ROLE_SLUG } from "@/services/organizations/types";
import { useAssignRosterRole } from "@/services/schedule/hooks";
import { useStaffInviteContext, useCreateInvite } from "@/services/branches/hooks";

type Mode = "existing" | "invite";

/**
 * Grow a branch's roster. The roster is BranchStaff — a link between an org
 * member and a branch — so the first, cheapest path is to pick someone already
 * in the org and give them a branch role: no email, on the schedule instantly.
 * Email invites are the fallback for people not in the org yet; on accept the
 * backend writes their BranchStaff row and they appear here too.
 */
export function AddToRosterModal({
  open,
  orgId,
  branchId,
  branchName,
  rosterUserIds,
  onClose,
}: {
  open: boolean;
  orgId: string;
  branchId: string;
  branchName: string;
  rosterUserIds: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("existing");

  const membersQuery = useOrganizationMembers(orgId);
  const rolesQuery = useOrganizationRoles(orgId);
  const assign = useAssignRosterRole(branchId);

  const onRoster = useMemo(() => new Set(rosterUserIds), [rosterUserIds]);
  const availableMembers = useMemo(
    () =>
      (membersQuery.data ?? []).filter(
        (member) => member.is_active && !onRoster.has(member.user),
      ),
    [membersQuery.data, onRoster],
  );

  // A roster role is any org role except the org-wide Super Admin (which is not
  // a "job on a branch"). Managers and staff both belong here.
  const roleOptions = useMemo(
    () =>
      (rolesQuery.data ?? []).filter(
        (role) => role.slug !== SYSTEM_ROLE_SLUG.SUPER_ADMIN,
      ),
    [rolesQuery.data],
  );
  const defaultRoleSlug = useMemo(() => {
    const staffish = roleOptions.find((role) => /staff|member/i.test(role.slug));
    return staffish?.slug ?? roleOptions[roleOptions.length - 1]?.slug ?? "";
  }, [roleOptions]);

  const [userId, setUserId] = useState("");
  const [roleSlug, setRoleSlug] = useState("");

  // Invite-mode state
  const contextQuery = useStaffInviteContext(orgId);
  const createInvite = useCreateInvite(orgId);
  const inviteRoles = useMemo(
    () => (contextQuery.data?.roles ?? []).filter((role) => role.requires_branch),
    [contextQuery.data],
  );
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");

  // Reset the form fields once per open. Mode defaults to "from team"; the
  // empty-state there guides to Invite when nobody is free to add, so we don't
  // flip modes as the member list loads in (which would fight the user).
  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setUserId("");
    setEmail("");
  }, [open]);

  // Role defaults settle in independently once their lists arrive.
  useEffect(() => {
    if (!roleSlug && defaultRoleSlug) setRoleSlug(defaultRoleSlug);
  }, [roleSlug, defaultRoleSlug]);
  useEffect(() => {
    if (!inviteRole && inviteRoles.length > 0) setInviteRole(inviteRoles[0].role);
  }, [inviteRole, inviteRoles]);

  const emailValid = /.+@.+\..+/.test(email.trim());

  const submitExisting = () => {
    if (!userId || !roleSlug) return;
    assign.mutate({ userId, roleSlug }, { onSuccess: () => onClose() });
  };
  const submitInvite = () => {
    if (!emailValid || !inviteRole) return;
    createInvite.mutate(
      { email: email.trim(), role: inviteRole, branch: branchId },
      { onSuccess: () => onClose() },
    );
  };

  const pending = assign.isPending || createInvite.isPending;

  return (
    <ModalShell
      open={open}
      title={t("schedule.roster.title")}
      description={t("schedule.roster.description", { branch: branchName })}
      onClose={onClose}
      maxWidthClassName="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:bg-surface-3"
          >
            {t("schedule.roster.cancel")}
          </button>
          {mode === "existing" ? (
            <button
              type="button"
              onClick={submitExisting}
              disabled={!userId || !roleSlug || pending}
              className="inline-flex h-9 items-center rounded-lg bg-brand-gold px-4 text-sm font-semibold text-[#141416] transition-colors hover:bg-brand-gold-hover disabled:opacity-40"
            >
              {assign.isPending ? t("schedule.roster.adding") : t("schedule.roster.add")}
            </button>
          ) : (
            <button
              type="button"
              onClick={submitInvite}
              disabled={!emailValid || !inviteRole || pending}
              className="inline-flex h-9 items-center rounded-lg bg-brand-gold px-4 text-sm font-semibold text-[#141416] transition-colors hover:bg-brand-gold-hover disabled:opacity-40"
            >
              {createInvite.isPending
                ? t("schedule.roster.sending")
                : t("schedule.roster.sendInvite")}
            </button>
          )}
        </>
      }
    >
      {/* Mode toggle */}
      <div className="mb-4 inline-flex rounded-lg border border-surface-4 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            mode === "existing"
              ? "bg-brand-gold/15 font-medium text-brand-gold"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {t("schedule.roster.fromTeam")}
        </button>
        <button
          type="button"
          onClick={() => setMode("invite")}
          className={`rounded-md px-3 py-1.5 transition-colors ${
            mode === "invite"
              ? "bg-brand-gold/15 font-medium text-brand-gold"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {t("schedule.roster.inviteNew")}
        </button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-4">
          {availableMembers.length === 0 ? (
            <p className="text-sm text-text-muted">
              {membersQuery.isLoading
                ? t("schedule.roster.loading")
                : t("schedule.roster.everyoneAdded")}
            </p>
          ) : (
            <>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("schedule.roster.memberLabel")}
                </span>
                <Select
                  options={availableMembers.map((member) => ({
                    value: member.user,
                    label:
                      `${member.first_name} ${member.last_name}`.trim() ||
                      member.email,
                  }))}
                  value={userId}
                  onChange={setUserId}
                  placeholder={t("schedule.roster.memberPlaceholder")}
                />
              </div>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("schedule.roster.roleLabel")}
                </span>
                <Select
                  options={roleOptions.map((role) => ({
                    value: role.slug,
                    label: role.name,
                  }))}
                  value={roleSlug}
                  onChange={setRoleSlug}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {inviteRoles.length === 0 && !contextQuery.isLoading ? (
            <p className="text-sm text-text-muted">{t("schedule.roster.noInvitePermission")}</p>
          ) : (
            <>
              <Field label={t("schedule.roster.emailLabel")}>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("schedule.roster.emailPlaceholder")}
                />
              </Field>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {t("schedule.roster.roleLabel")}
                </span>
                <Select
                  options={inviteRoles.map((role) => ({
                    value: role.role,
                    label: role.label,
                  }))}
                  value={inviteRole}
                  onChange={setInviteRole}
                />
              </div>
              <p className="text-xs text-text-muted">
                {t("schedule.roster.inviteHint", { branch: branchName })}
              </p>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
}
