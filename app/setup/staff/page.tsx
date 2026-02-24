"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  ArrowRight,
  UserPlus,
  DeliveryTruck,
  GraphUp,
} from "iconoir-react";

export default function StaffInvitePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CHEF");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;

    setIsSubmitting(true);
    // Simulate sending invite
    setTimeout(() => {
      // Route to plan selection after invite action.
      router.push("/setup/pricing");
    }, 1000);
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Step Context */}
        <div className="flex items-center gap-2 mb-10">
          <UserPlus className="h-4 w-4 text-[#A8821F]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 5 — Team
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-3">
          Invite your kitchen lead.
        </h1>
        <p className="text-[14px] leading-[22px] text-[#8E8E93] mb-8">
          The forecast is ready. Invite the person who leads the kitchen so they
          can seamlessly log production and track waste tomorrow.
        </p>

        {/* Value Prop Callout */}
        <div className="bg-[#1C1C1F] border border-[#2E2E33] rounded-[12px] p-4 flex flex-col gap-3 mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#F5F5F7]">
            Why add them now?
          </p>
          <div className="flex items-start gap-3">
            <DeliveryTruck className="h-4 w-4 text-[#3F8F68] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#C7C7CC]">
              They can immediately view tomorrow&apos;s prep targets.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <GraphUp className="h-4 w-4 text-[#3F8F68] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#C7C7CC]">
              They log waste, building the engine&apos;s forecasting accuracy.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSendInvite} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A60]">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="chef@example.com"
                  className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] pl-10 pr-4 text-sm text-[#F5F5F7] placeholder-[#5A5A60] focus:outline-none focus:border-[#A8821F] transition-colors duration-150"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93]">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-11 bg-[#1C1C1F] border border-[#2E2E33] rounded-[8px] px-4 text-sm text-[#F5F5F7] focus:outline-none focus:border-[#A8821F] transition-colors duration-150 appearance-none cursor-pointer"
              >
                <option value="CHEF">Chef / Kitchen Lead</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff (Read-only prep lists)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={!email.trim() || isSubmitting}
            className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
          >
            {isSubmitting
              ? "Sending invite..."
              : "Send Invite & Continue"}
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/setup/pricing")}
          className="w-full mt-4 text-center text-sm text-[#5A5A60] hover:text-[#8E8E93] transition-colors duration-150"
        >
          Skip — choose plan first
        </button>
      </div>
    </div>
  );
}
