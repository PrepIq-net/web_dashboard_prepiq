"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  ArrowRight,
  UserPlus,
  NavArrowDown,
  Database,
  Eye,
  Check,
} from "iconoir-react";
import {
  useCurrentUserProfile,
  useCreateInvite,
  useStaffInviteContext,
  // useTranslation,
} from "@/services";
import { SYSTEM_ROLE_OPTIONS } from "@/services/organizations/types";
import { useTranslation } from "@/lib/i18n";

type SalesAccessAnswer = "yes" | "no" | null;

type StaffRoleOption = {
  value: string;
  label: string;
  description: string;
  requiresBranch: boolean;
};

export default function StaffInvitePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();
  const orgId = user?.organization_id ?? "";
  const inviteContext = useStaffInviteContext(orgId);
  const inviteMutation = useCreateInvite(orgId);

  const [salesAccess, setSalesAccess] = useState<SalesAccessAnswer>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  // Roles are real RBAC slugs. Branch-level roles (manager/staff/custom) are
  // offered too — they just require picking the location they work at.
  const roleOptions: StaffRoleOption[] =
    inviteContext.data?.roles.map((roleOption) => ({
      value: roleOption.slug,
      label: roleOption.label,
      description: roleOption.permission_hints.join(", ") || roleOption.label,
      requiresBranch: roleOption.requires_branch,
    })) ??
    SYSTEM_ROLE_OPTIONS.filter((option) => option.value !== "system-super-admin").map(
      (option) => ({
        value: option.value,
        label: option.label,
        description: option.label,
        requiresBranch: option.value !== "system-admin",
      }),
    );

  // Someone who handles sales data is an org admin; otherwise the first
  // branch-level role (the kitchen lead at a location).
  const defaultRole =
    (salesAccess === "yes"
      ? roleOptions.find((o) => !o.requiresBranch)
      : roleOptions.find((o) => o.requiresBranch)
    )?.value ??
    roleOptions[0]?.value ??
    "";

  const activeRole = role || defaultRole;
  const selectedRole = roleOptions.find((option) => option.value === activeRole);
  const branchOptions = inviteContext.data?.allowed_branches ?? [];
  const needsBranch = Boolean(selectedRole?.requiresBranch);
  const activeBranchId =
    branchId ||
    branchOptions.find((b) => b.is_primary)?.id ||
    branchOptions[0]?.id ||
    "";

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@") || !orgId) return;
    if (needsBranch && !activeBranchId) {
      setInviteError(t("setup.staff.branchRequired"));
      return;
    }
    setInviteError(null);

    try {
      await inviteMutation.mutateAsync({
        email: email.trim(),
        custom_role_slug: activeRole,
        branch: needsBranch ? activeBranchId : undefined,
      });
      setInviteSent(true);
      setTimeout(() => router.push("/setup/pricing"), 1800);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to send invite.";
      setInviteError(msg);
    }
  }

  // Step 1 — ask if they have someone who handles sales data
  if (salesAccess === null) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-2 mb-10">
            <UserPlus className="h-4 w-4 text-[#A8821F]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
              {t("setup.staff.step")}
            </span>
          </div>

          <h1 className="font-display text-[40px] leading-12 font-semibold text-[#F5F5F7] mb-3">
            {t("setup.staff.question")}
          </h1>
          <p className="text-[16px] leading-6 text-[#8E8E93] mb-10 max-w-sm">
            {t("setup.staff.questionDesc")}
          </p>

          <div className="space-y-3 mb-8">
            <button
              type="button"
              onClick={() => setSalesAccess("yes")}
              className="w-full text-left rounded-xl border border-[#2E2E33] bg-[#1C1C1F] hover:border-[#3A3A3F] px-5 py-4 transition-all duration-150 focus:outline-none group"
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0 text-[#5A5A60] group-hover:text-[#A8821F] transition-colors">
                  <Database className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#C7C7CC] mb-1">
                    {t("setup.staff.yesOption")}
                  </p>
                  <p className="text-[13px] leading-5 text-[#8E8E93]">
                    {t("setup.staff.yesDesc")}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSalesAccess("no")}
              className="w-full text-left rounded-xl border border-[#2E2E33] bg-[#1C1C1F] hover:border-[#3A3A3F] px-5 py-4 transition-all duration-150 focus:outline-none group"
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0 text-[#5A5A60] group-hover:text-[#A8821F] transition-colors">
                  <Eye className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#C7C7CC] mb-1">
                    {t("setup.staff.noOption")}
                  </p>
                  <p className="text-[13px] leading-5 text-[#8E8E93]">
                    {t("setup.staff.noDesc")}
                  </p>
                </div>
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push("/setup/pricing")}
            className="w-full text-center text-sm text-[#5A5A60] hover:text-[#8E8E93] transition-colors duration-150"
          >
            {t("setup.staff.skipToPricing")}
          </button>
        </div>
      </div>
    );
  }

  // Step 2 — invite form (same for both paths, role differs)
  const headline =
    salesAccess === "yes"
      ? t("setup.staff.inviteDataManager")
      : t("setup.staff.inviteKitchenLead");
  const subtext =
    salesAccess === "yes"
      ? t("setup.staff.inviteDataManagerDesc")
      : t("setup.staff.inviteKitchenLeadDesc");

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => setSalesAccess(null)}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5A5A60] hover:text-[#8E8E93] transition-colors"
          >
            {t("setup.staff.back")}
          </button>
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            {t("setup.staff.step")}
          </span>
        </div>

        <h1 className="font-display text-[40px] leading-12 font-semibold text-[#F5F5F7] mb-3">
          {headline}
        </h1>
        <p className="text-[16px] leading-6 text-[#8E8E93] mb-10 max-w-sm">
          {subtext}
        </p>

        <form
          onSubmit={handleSendInvite}
          className="space-y-5"
          key={salesAccess}
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              {t("setup.staff.emailLabel")}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A5A60]">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  salesAccess === "yes"
                    ? "manager@yourrestaurant.com"
                    : "lead@yourrestaurant.com"
                }
                className="w-full h-12 bg-[#1C1C1F] border border-[#2E2E33] rounded-lg pl-10 pr-4 text-[14px] text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              {t("setup.staff.roleLabel")}
            </label>
            <div className="relative">
              <select
                value={activeRole}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-12 bg-[#1C1C1F] border border-[#2E2E33] rounded-lg px-4 pr-10 text-[14px] text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] transition-colors duration-150 appearance-none cursor-pointer"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A5A60]">
                <NavArrowDown className="h-4 w-4" />
              </span>
            </div>
            {selectedRole && (
              <p className="text-[12px] leading-4.5 text-[#5A5A60] px-1">
                {selectedRole.description}
              </p>
            )}
          </div>

          {/* Branch-level roles work at a specific location. */}
          {needsBranch && branchOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                {t("setup.staff.branchLabel")}
              </label>
              <div className="relative">
                <select
                  value={activeBranchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full h-12 bg-[#1C1C1F] border border-[#2E2E33] rounded-lg px-4 pr-10 text-[14px] text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] transition-colors duration-150 appearance-none cursor-pointer"
                >
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.is_primary ? ` ${t("setup.checkout.primary")}` : ""}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5A5A60]">
                  <NavArrowDown className="h-4 w-4" />
                </span>
              </div>
              <p className="text-[12px] leading-4.5 text-[#5A5A60] px-1">
                {t("setup.staff.branchHint")}
              </p>
            </div>
          )}

          {inviteError && (
            <div className="rounded-lg border border-[#C44949]/40 bg-[#C44949]/8 px-4 py-3">
              <p className="text-[13px] text-[#C44949]">{inviteError}</p>
            </div>
          )}

          {inviteSent && (
            <div className="rounded-lg border border-[#3F8F68]/40 bg-[#3F8F68]/8 px-4 py-3 flex items-center gap-3">
              <span className="h-5 w-5 rounded-full bg-[#3F8F68]/20 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-[#3F8F68]" />
              </span>
              <p className="text-[13px] text-[#3F8F68] font-medium">
                Invite sent to {email} — redirecting…
              </p>
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={!email.trim() || inviteMutation.isPending || inviteSent}
              className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-[14px] font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors duration-150"
            >
              {inviteMutation.isPending ? (
                t("setup.staff.sending")
              ) : (
                <>
                  {t("setup.staff.submit")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push("/setup/pricing")}
              className="w-full h-12 border border-[#2E2E33] bg-transparent hover:bg-[#1C1C1F] text-[#8E8E93] hover:text-[#C7C7CC] text-[14px] font-medium rounded-lg transition-colors duration-150"
            >
              {t("setup.staff.skipToPlans")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
