"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WarningTriangle, Trash, LogOut } from "iconoir-react";
import { toast } from "react-hot-toast";

import { ModalShell } from "@/components/ui/modal-shell";
import { ConfirmActionModal } from "@/components/dashboard/today/confirm-action-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUserProfile, useMyOrganizations } from "@/services";
import {
  useOrganizationMembers,
  useLeaveOrganization,
  useTransferOrganizationOwnership,
  useDeleteOrganization,
} from "@/services/organizations/hooks";
import { useDeleteAccount, useSessionLogoutUser } from "@/services/users/hooks";
import { resolvePermissions } from "@/lib/permissions";
import { PERMISSIONS } from "@/services/organizations/types";
import { ApiError } from "@/lib/api/errors";

type SoleOwnerOrg = { id: string; name: string };

/**
 * The "Danger Zone" — irreversible, destructive account/tenant actions.
 * Account deletion is available to every user (store/GDPR requirement); org/
 * ownership actions are owner-gated. Leaving/removing keeps the org's data.
 */
export function DangerZone({ orgId }: { orgId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: user } = useCurrentUserProfile();
  const { data: organizations } = useMyOrganizations();
  const org = useMemo(
    () => organizations?.find((o) => o.id === orgId) ?? organizations?.[0],
    [organizations, orgId],
  );
  const effectiveOrgId = org?.id ?? orgId ?? "";
  const { data: members } = useOrganizationMembers(effectiveOrgId);

  const permissions = resolvePermissions(user);
  const isOwner =
    permissions.has(PERMISSIONS.MANAGE_ORG_SETTINGS) &&
    permissions.has(PERMISSIONS.MANAGE_BILLING);

  const deleteAccount = useDeleteAccount();
  const leaveOrg = useLeaveOrganization(effectiveOrgId);
  const transferOwnership = useTransferOrganizationOwnership(effectiveOrgId);
  const deleteOrg = useDeleteOrganization(effectiveOrgId);
  const logout = useSessionLogoutUser();

  // Modals
  const [accountOpen, setAccountOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [orgDeleteOpen, setOrgDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // Account-delete form
  const [reasonChoice, setReasonChoice] = useState("NOT_USEFUL");
  const [reasonDetails, setReasonDetails] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [blockedOrgs, setBlockedOrgs] = useState<SoleOwnerOrg[]>([]);

  // Org-delete form
  const [orgConfirm, setOrgConfirm] = useState("");

  // Transfer form
  const [transferTarget, setTransferTarget] = useState("");

  const transferOptions = useMemo(
    () =>
      (members ?? [])
        .filter((m) => m.is_active && m.user !== user?.id)
        .map((m) => ({
          value: m.user,
          label:
            `${m.first_name} ${m.last_name}`.trim() || m.email || m.user,
        })),
    [members, user?.id],
  );

  async function signOutAndRedirect() {
    try {
      await logout.mutateAsync(undefined);
    } catch {
      /* tokens already blacklisted server-side; redirect regardless */
    }
    router.replace("/login");
  }

  function handleDeleteAccount() {
    deleteAccount.mutate(
      {
        reason_choice: reasonChoice as never,
        reason_details: reasonDetails,
        confirm: true,
      },
      {
        onSuccess: async () => {
          setAccountOpen(false);
          toast.success(t("settings.danger.account.deleted"));
          await signOutAndRedirect();
        },
        onError: (err: unknown) => {
          if (err instanceof ApiError && err.status === 409) {
            const orgs =
              ((err.details as Record<string, any>)?.error?.details
                ?.organizations as SoleOwnerOrg[]) ?? [];
            setBlockedOrgs(orgs);
            setAccountOpen(false);
          } else {
            toast.error(
              (err as Error)?.message || t("settings.danger.account.failed"),
            );
          }
        },
      },
    );
  }

  function handleLeaveOrg() {
    leaveOrg.mutate(undefined, {
      onSuccess: () => {
        setLeaveOpen(false);
        toast.success(t("settings.danger.leave.done"));
        router.replace("/workspace");
      },
    });
  }

  function handleTransfer() {
    if (!transferTarget) return;
    transferOwnership.mutate(transferTarget, {
      onSuccess: () => {
        setTransferOpen(false);
        setTransferTarget("");
        setBlockedOrgs([]);
      },
    });
  }

  function handleDeleteOrg() {
    deleteOrg.mutate(undefined, {
      onSuccess: () => {
        setOrgDeleteOpen(false);
        setOrgConfirm("");
        setBlockedOrgs([]);
        toast.success(t("settings.danger.org.deleted"));
        router.replace("/workspace");
      },
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          {t("settings.danger.title")}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          {t("settings.danger.subtitle")}
        </p>
      </div>

      {blockedOrgs.length > 0 && (
        <div className="border-l-4 border-status-critical bg-status-critical/5 rounded-r-lg px-4 py-3">
          <div className="flex items-center gap-2 text-status-critical">
            <WarningTriangle className="h-4 w-4" />
            <p className="text-sm font-semibold">
              {t("settings.danger.soleOwner.title")}
            </p>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {t("settings.danger.soleOwner.body")}{" "}
            <span className="text-text-primary font-medium">
              {blockedOrgs.map((o) => o.name).join(", ")}
            </span>
          </p>
        </div>
      )}

      {/* Leave organization */}
      {effectiveOrgId && (
        <DangerCard
          icon={<LogOut className="h-5 w-5" />}
          title={t("settings.danger.leave.title")}
          description={t("settings.danger.leave.description")}
          action={
            <Button variant="destructive" onClick={() => setLeaveOpen(true)}>
              {t("settings.danger.leave.button")}
            </Button>
          }
        />
      )}

      {/* Transfer ownership (owner only) */}
      {isOwner && effectiveOrgId && (
        <DangerCard
          icon={<WarningTriangle className="h-5 w-5" />}
          title={t("settings.danger.transfer.title")}
          description={t("settings.danger.transfer.description")}
          action={
            <Button
              variant="secondary"
              onClick={() => setTransferOpen(true)}
              disabled={transferOptions.length === 0}
            >
              {t("settings.danger.transfer.button")}
            </Button>
          }
        />
      )}

      {/* Delete organization (owner only) */}
      {isOwner && effectiveOrgId && (
        <DangerCard
          icon={<Trash className="h-5 w-5" />}
          title={t("settings.danger.org.title")}
          description={t("settings.danger.org.description")}
          action={
            <Button variant="destructive" onClick={() => setOrgDeleteOpen(true)}>
              {t("settings.danger.org.button")}
            </Button>
          }
        />
      )}

      {/* Delete account (everyone) */}
      <DangerCard
        icon={<Trash className="h-5 w-5" />}
        title={t("settings.danger.account.title")}
        description={t("settings.danger.account.description")}
        action={
          <Button variant="destructive" onClick={() => setAccountOpen(true)}>
            {t("settings.danger.account.button")}
          </Button>
        }
      />

      {/* ── Account deletion modal ── */}
      <ModalShell
        open={accountOpen}
        title={t("settings.danger.account.modalTitle")}
        description={t("settings.danger.account.modalDescription")}
        onClose={() => setAccountOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAccountOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={accountConfirm !== "DELETE" || deleteAccount.isPending}
              onClick={handleDeleteAccount}
            >
              {deleteAccount.isPending
                ? t("common.processing")
                : t("settings.danger.account.confirmButton")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t("settings.danger.account.reasonLabel")}
            value={reasonChoice}
            onChange={(v: string) => setReasonChoice(v)}
            options={[
              { value: "NOT_USEFUL", label: t("settings.danger.reasons.notUseful") },
              { value: "TOO_COMPLICATED", label: t("settings.danger.reasons.tooComplicated") },
              { value: "PRIVACY", label: t("settings.danger.reasons.privacy") },
              { value: "OTHER", label: t("settings.danger.reasons.other") },
            ]}
          />
          <Input
            label={t("settings.danger.account.detailsLabel")}
            value={reasonDetails}
            onChange={(e) => setReasonDetails(e.target.value)}
            placeholder={t("settings.danger.account.detailsPlaceholder")}
            maxLength={500}
          />
          <Input
            label={t("settings.danger.account.typeToConfirm")}
            value={accountConfirm}
            onChange={(e) => setAccountConfirm(e.target.value)}
            placeholder="DELETE"
          />
        </div>
      </ModalShell>

      {/* ── Leave org confirm ── */}
      <ConfirmActionModal
        open={leaveOpen}
        title={t("settings.danger.leave.title")}
        description={t("settings.danger.leave.confirm")}
        confirmLabel={t("settings.danger.leave.button")}
        tone="critical"
        isConfirming={leaveOrg.isPending}
        onClose={() => setLeaveOpen(false)}
        onConfirm={handleLeaveOrg}
      />

      {/* ── Transfer ownership ── */}
      <ModalShell
        open={transferOpen}
        title={t("settings.danger.transfer.title")}
        description={t("settings.danger.transfer.modalDescription")}
        onClose={() => setTransferOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTransferOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={!transferTarget || transferOwnership.isPending}
              onClick={handleTransfer}
            >
              {transferOwnership.isPending
                ? t("common.processing")
                : t("settings.danger.transfer.button")}
            </Button>
          </>
        }
      >
        <Select
          label={t("settings.danger.transfer.selectLabel")}
          value={transferTarget}
          onChange={(v: string) => setTransferTarget(v)}
          options={[
            { value: "", label: t("settings.danger.transfer.selectPlaceholder") },
            ...transferOptions,
          ]}
        />
      </ModalShell>

      {/* ── Delete org (typed confirm) ── */}
      <ModalShell
        open={orgDeleteOpen}
        title={t("settings.danger.org.modalTitle")}
        description={t("settings.danger.org.modalDescription")}
        onClose={() => setOrgDeleteOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOrgDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={orgConfirm !== (org?.name ?? "") || deleteOrg.isPending}
              onClick={handleDeleteOrg}
            >
              {deleteOrg.isPending
                ? t("common.processing")
                : t("settings.danger.org.confirmButton")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {t("settings.danger.org.warning")}
          </p>
          <Input
            label={t("settings.danger.org.typeName", { name: org?.name ?? "" })}
            value={orgConfirm}
            onChange={(e) => setOrgConfirm(e.target.value)}
            placeholder={org?.name ?? ""}
          />
        </div>
      </ModalShell>
    </div>
  );
}

function DangerCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="border-l-4 border-status-critical/60 bg-[#141416] rounded-r-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="text-status-critical mt-0.5">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="text-sm text-text-muted mt-1">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
