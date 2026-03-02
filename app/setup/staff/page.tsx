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
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/20">
            <UserPlus className="h-4 w-4 text-brand-gold" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Step 5 — Team
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-text-primary mb-3">
          Invite your kitchen lead.
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary mb-8">
          The forecast is ready. Invite the person who leads the kitchen so they
          can seamlessly log production and track waste tomorrow.
        </p>

        {/* Value Prop Callout */}
        <div className="bg-[#1C1C1F] border border-[#2A2A2E] rounded-xl p-5 space-y-4 mb-8 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-primary">
            Why add them now?
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-status-success/20 flex-shrink-0">
                <DeliveryTruck className="h-4 w-4 text-status-success" />
              </div>
              <p className="text-sm text-text-secondary pt-1">
                They can immediately view tomorrow&apos;s prep targets.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-status-success/20 flex-shrink-0">
                <GraphUp className="h-4 w-4 text-status-success" />
              </div>
              <p className="text-sm text-text-secondary pt-1">
                They log waste, building the engine&apos;s forecasting accuracy.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSendInvite} className="space-y-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">
                Email Address
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
                  className="w-full h-12 bg-[#1C1C1F] border border-[#2A2A2E] rounded-lg pl-10 pr-4 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all duration-200 hover:border-[#3A3A40]"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">
                Role
              </label>
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full h-12 bg-[#1C1C1F] border border-[#2A2A2E] rounded-lg px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all duration-200 hover:border-[#3A3A40] appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238E8E93' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                  }}
                >
                  <option value="CHEF">Chef / Kitchen Lead</option>
                  <option value="MANAGER">Manager</option>
                  <option value="STAFF">Staff (Read-only prep lists)</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!email.trim() || isSubmitting}
            className="w-full h-12 bg-gradient-to-br from-[#A8821F] to-[#8F6F18] hover:shadow-[0_4px_12px_rgba(168,130,31,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none text-[#141416] text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_2px_8px_rgba(168,130,31,0.25)]"
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
          className="w-full mt-4 text-center text-sm text-text-muted hover:text-text-secondary transition-colors duration-200"
        >
          Skip — choose plan first
        </button>
      </div>
    </div>
  );
}
