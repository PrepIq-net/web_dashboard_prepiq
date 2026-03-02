"use client";

import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile } from "@/services";

export default function BillingPage() {
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();

  return (
    <WorkspaceShell
      eyebrow="Executive"
      title="Billing"
      description="Plan, subscription, and payment operations for organization owners."
      insight="Current plan utilization is healthy; no immediate upgrade pressure detected."
    >
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3 pb-8 border-b border-[#2A2A2E]">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Plan
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            Core
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Next Renewal
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            12 days
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Branch Capacity
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            5 / 10
          </p>
        </article>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          Operational Highlights
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-[14px] text-[#C7C7CC]">
            • Billing history sync is complete and up to date.
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • Plan limits are aligned with current org footprint.
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • Upgrade recommendations will be surfaced proactively.
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}
