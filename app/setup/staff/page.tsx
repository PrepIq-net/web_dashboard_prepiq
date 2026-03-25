"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  ArrowRight,
  UserPlus,
  Check,
  NavArrowDown,
  Database,
  Eye,
} from "iconoir-react";

const ROLE_OPTIONS = [
  {
    value: "CHEF",
    label: "Kitchen Lead",
    description: "Full production access — logs prep, waste, and batch output.",
  },
  {
    value: "MANAGER",
    label: "Manager",
    description: "Branch-level oversight — views reports and manages staff.",
  },
  {
    value: "STAFF",
    label: "Staff",
    description: "Read-only prep lists — sees daily targets, no editing.",
  },
];

type SalesAccessAnswer = "yes" | "no" | null;

export default function StaffInvitePage() {
  const router = useRouter();
  const [salesAccess, setSalesAccess] = useState<SalesAccessAnswer>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CHEF");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    setIsSubmitting(true);
    // TODO: wire to useCreateInvite hook
    setTimeout(() => {
      router.push("/setup/pricing");
    }, 900);
  }

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === role);

  // Step 1 — ask if they have someone who handles sales data
  if (salesAccess === null) {
    return (
      <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-2 mb-10">
            <UserPlus className="h-4 w-4 text-[#A8821F]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
              Step 5 — Team
            </span>
          </div>

          <h1 className="font-display text-[40px] leading-[48px] font-semibold text-[#F5F5F7] mb-3">
            Does someone else handle your sales data?
          </h1>
          <p className="text-[16px] leading-[24px] text-[#8E8E93] mb-10 max-w-sm">
            If a team member manages your POS or exports, they can connect it directly — no need to share credentials.
          </p>

          <div className="space-y-3 mb-8">
            <button
              type="button"
              onClick={() => setSalesAccess("yes")}
              className="w-full text-left rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] hover:border-[#3A3A3F] px-5 py-4 transition-all duration-150 focus:outline-none group"
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0 text-[#5A5A60] group-hover:text-[#A8821F] transition-colors">
                  <Database className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#C7C7CC] mb-1">
                    Yes — invite them to connect sales data
                  </p>
                  <p className="text-[13px] leading-[20px] text-[#8E8E93]">
                    They'll get access to connect the POS or upload CSV exports.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSalesAccess("no")}
              className="w-full text-left rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] hover:border-[#3A3A3F] px-5 py-4 transition-all duration-150 focus:outline-none group"
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0 text-[#5A5A60] group-hover:text-[#A8821F] transition-colors">
                  <Eye className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#C7C7CC] mb-1">
                    No — I handle it myself
                  </p>
                  <p className="text-[13px] leading-[20px] text-[#8E8E93]">
                    Invite your kitchen lead instead so they can log prep and waste from day one.
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
            Skip — go to pricing
          </button>
        </div>
      </div>
    );
  }

  // Step 2 — invite form (same for both paths, role differs)
  const defaultRole = salesAccess === "yes" ? "MANAGER" : "CHEF";
  const headline =
    salesAccess === "yes"
      ? "Invite your data manager."
      : "Invite your kitchen lead.";
  const subtext =
    salesAccess === "yes"
      ? "They'll be able to connect your POS or upload sales exports directly."
      : "The forecast is ready. Invite the person who runs the kitchen so they can log production and track waste from day one.";

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => setSalesAccess(null)}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5A5A60] hover:text-[#8E8E93] transition-colors"
          >
            ← Back
          </button>
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 5 — Team
          </span>
        </div>

        <h1 className="font-display text-[40px] leading-[48px] font-semibold text-[#F5F5F7] mb-3">
          {headline}
        </h1>
        <p className="text-[16px] leading-[24px] text-[#8E8E93] mb-10 max-w-sm">
          {subtext}
        </p>

        <form
          onSubmit={handleSendInvite}
          className="space-y-5"
          key={salesAccess}
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Email Address
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
                className="w-full h-12 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] pl-10 pr-4 text-[14px] text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
              Role
            </label>
            <div className="relative">
              <select
                value={role || defaultRole}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-12 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 pr-10 text-[14px] text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] transition-colors duration-150 appearance-none cursor-pointer"
              >
                {ROLE_OPTIONS.map((opt) => (
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
              <p className="text-[12px] leading-[18px] text-[#5A5A60] px-1">
                {selectedRole.description}
              </p>
            )}
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={!email.trim() || isSubmitting}
              className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-[14px] font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
            >
              {isSubmitting ? (
                "Sending invite..."
              ) : (
                <>
                  Send Invite &amp; Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push("/setup/pricing")}
              className="w-full h-12 border border-[#2E2E33] bg-transparent hover:bg-[#1C1C1F] text-[#8E8E93] hover:text-[#C7C7CC] text-[14px] font-medium rounded-[8px] transition-colors duration-150"
            >
              Skip — choose plan first
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
