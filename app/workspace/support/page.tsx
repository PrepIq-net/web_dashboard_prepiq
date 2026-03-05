"use client";

import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile } from "@/services";

export default function SupportPage() {
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();

  return (
    <WorkspaceShell
      eyebrow="System"
      title="Support"
      description="Help center, issue tracking, and implementation assistance."
      insight="Most onboarding blockers are integration-related and resolved within 24h."
    >
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3 pb-8 border-b border-[#2A2A2E]">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Open Tickets
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            2
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Avg Response
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            18 min
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Resolved This Week
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            11
          </p>
        </article>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          Operational Highlights
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-[14px] text-[#C7C7CC]">
            • Priority support is active for production blockers.
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • Implementation docs are versioned and up to date.
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • Share branch ID when opening data-quality tickets.
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}
