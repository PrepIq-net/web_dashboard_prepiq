"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, UserPlus } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { useCurrentUserProfile } from "@/services/users/hooks";
import {
  useCreateInvite,
  useStaffInviteContext,
} from "@/services/branches/hooks";
import type { StaffRole } from "@/services/branches/types";

const CAPABILITY_LABELS: Record<string, string> = {
  VIEW_ALL_BRANCHES: "View all branches",
  MANAGE_STAFF: "Manage team members",
  MANAGE_BRANCHES: "Manage branches",
  MANAGE_BRANCH_DATA: "Manage branch operations data",
  ASSIGN_BRANCH_MANAGERS: "Assign branch managers",
  VIEW_ANALYTICS: "View analytics",
  APPROVE_DONATIONS: "Approve donations",
  VIEW_AUDIT_LOGS: "View audit logs",
  MANAGE_INTEGRATIONS: "Manage integrations",
  VIEW_REPORTS: "View reports",
  VIEW_COMPLIANCE_DASHBOARDS: "View compliance dashboards",
  VIEW_DONATION_HISTORY: "View donation history",
  VIEW_ESG_METRICS: "View ESG metrics",
  ACCESS_GLOBAL_CHAT: "Access team chat",
  CREATE_BATCH: "Create production batches",
  LOG_WASTE: "Log waste",
  VIEW_DAILY_TARGET: "View daily targets",
  RESPOND_CUSTOMERS: "Respond to customers",
};

function humanizeCapability(code: string): string {
  if (CAPABILITY_LABELS[code]) return CAPABILITY_LABELS[code];
  return code
    .toLowerCase()
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export default function StaffInvitePage() {
  const router = useRouter();
  const { data: user, isLoading: userLoading, isError: userError } =
    useCurrentUserProfile();

  const orgId = user?.organization_id ?? "";
  const contextQuery = useStaffInviteContext(orgId);
  const inviteMutation = useCreateInvite(orgId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState("");
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    roleLabel: string;
    branchLabel?: string;
  } | null>(null);

  const roleOptions = useMemo(
    () =>
      (contextQuery.data?.roles ?? []).map((entry) => ({
        value: entry.role,
        label: entry.label,
      })),
    [contextQuery.data?.roles],
  );

  const selectedRole = useMemo(
    () => contextQuery.data?.roles.find((entry) => entry.role === role),
    [contextQuery.data?.roles, role],
  );

  const branchOptions = useMemo(
    () =>
      (contextQuery.data?.allowed_branches ?? []).map((branch) => ({
        value: branch.id,
        label: branch.is_primary ? `${branch.name} (Primary)` : branch.name,
      })),
    [contextQuery.data?.allowed_branches],
  );

  useEffect(() => {
    if (!role && roleOptions[0]) {
      setRole(roleOptions[0].value);
    }
  }, [role, roleOptions]);

  useEffect(() => {
    if (!selectedRole?.requires_branch) {
      setBranchId("");
      return;
    }

    if (branchOptions.length === 1) {
      setBranchId(branchOptions[0].value);
    }
  }, [selectedRole?.requires_branch, branchOptions]);

  const isLoading = userLoading || contextQuery.isLoading;

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }

    if (!role) {
      setError("Please choose a role.");
      return;
    }

    if (selectedRole?.requires_branch && !branchId) {
      setError("Please choose a branch for this role.");
      return;
    }

    try {
      const roleLabel = selectedRole?.label ?? role;
      const branchLabel = selectedRole?.requires_branch
        ? branchOptions.find((option) => option.value === branchId)?.label
        : undefined;

      await inviteMutation.mutateAsync({
        email: email.trim(),
        role,
        branch: selectedRole?.requires_branch ? branchId : undefined,
      });
      setLastInvite({
        email: email.trim(),
        roleLabel,
        branchLabel,
      });
      setEmail("");
      setError("");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Failed to send invite.");
      } else {
        setError("Failed to send invite.");
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-[#8E8E93] text-sm">
          <Spinner size="md" color="#A8821F" />
          Loading team setup...
        </div>
      </div>
    );
  }

  if (userError || contextQuery.isError || !orgId || !contextQuery.data) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-[12px] border border-[#C44949]/50 bg-[#1C1C1F] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C44949] mb-2">
            Team Setup Unavailable
          </p>
          <h1 className="font-display text-[28px] leading-[36px] font-semibold text-[#F5F5F7] mb-2">
            We couldn&apos;t load staff invite settings.
          </h1>
          <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-6">
            Confirm your organization and branch access, then retry.
          </p>
          <button
            onClick={() => router.push("/")}
            className="h-11 px-6 rounded-[8px] bg-[#A8821F] hover:bg-[#B8962E] text-[#141416] text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            Back to Dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const limits = contextQuery.data.limits;

  if (lastInvite) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3F8F68] mb-2">
            Invite Sent
          </p>
          <h1 className="font-display text-[28px] leading-[36px] font-semibold text-[#F5F5F7] mb-2">
            Staff invite delivered successfully.
          </h1>
          <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-1">
            <span className="text-[#C7C7CC]">{lastInvite.email}</span> was invited as{" "}
            <span className="text-[#C7C7CC]">{lastInvite.roleLabel}</span>.
          </p>
          {lastInvite.branchLabel ? (
            <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-6">
              Branch: <span className="text-[#C7C7CC]">{lastInvite.branchLabel}</span>
            </p>
          ) : (
            <div className="mb-6" />
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/setup/pricing")}
              className="w-full sm:w-auto h-12 px-8 bg-[#A8821F] hover:bg-[#B8962E] text-[#141416] text-sm font-semibold rounded-[8px] inline-flex items-center justify-center gap-2 transition-colors"
            >
              Continue to pricing
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLastInvite(null)}
              className="w-full sm:w-auto h-12 px-8 border border-[#2E2E33] bg-transparent hover:bg-[#232327] text-[#C7C7CC] text-sm font-medium rounded-[8px] transition-colors"
            >
              Add another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-10">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/20">
            <UserPlus className="h-4 w-4 text-brand-gold" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Step 5 — Team
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-text-primary mb-3">
          Add your team with the right access.
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary mb-6">
          Invite staff by branch and role. We&apos;ll apply permissions based on the role you pick.
        </p>

        <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-2">
            Plan Capacity
          </p>
          <p className="text-[13px] text-[#C7C7CC]">
            {limits.plan_name || "Current plan"}: {limits.current_staff_total} active staff, {limits.pending_invites_total} pending invites.
            {typeof limits.max_total_staff === "number"
              ? ` Max total: ${limits.max_total_staff}.`
              : ""}
          </p>
        </div>

        <form onSubmit={handleSendInvite} className="space-y-5">
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4 space-y-4">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Team Member Email
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chef@example.com"
                className="w-full h-12 bg-[#1C1C1F] border border-[#2A2A2E] rounded-lg pl-10 pr-4 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold"
                required
              />
            </div>

            <Select
              label="Role"
              options={roleOptions}
              value={role}
              onChange={(value) => setRole(value as StaffRole)}
              placeholder="Select role"
            />

            {selectedRole?.requires_branch ? (
              <Select
                label="Branch"
                options={branchOptions}
                value={branchId}
                onChange={setBranchId}
                placeholder="Select branch"
              />
            ) : null}
          </div>

          {selectedRole ? (
            <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8E8E93] mb-2">
                What this role can do
              </p>
              <div className="space-y-1 mb-3">
                {selectedRole.permission_hints.map((hint) => (
                  <p key={hint} className="text-[13px] text-[#C7C7CC]">• {hint}</p>
                ))}
              </div>
              <p className="text-[12px] text-[#8E8E93]">
                Capabilities:{" "}
                {selectedRole.capabilities.length
                  ? selectedRole.capabilities.map(humanizeCapability).join(", ")
                  : "Full access"}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[10px] border border-[#C44949]/50 bg-[#C44949]/10 p-3">
              <p className="text-[13px] text-[#E7B4B4]">{error}</p>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="w-full sm:w-auto h-12 px-8 bg-[#A8821F] hover:bg-[#B8962E] disabled:opacity-60 text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors"
            >
              {inviteMutation.isPending ? "Sending invite..." : "Send Invite"}
              {!inviteMutation.isPending ? <ArrowRight className="h-4 w-4" /> : null}
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full sm:w-auto h-12 px-8 border border-[#2E2E33] bg-transparent hover:bg-[#232327] text-[#C7C7CC] text-sm font-medium rounded-[8px] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
