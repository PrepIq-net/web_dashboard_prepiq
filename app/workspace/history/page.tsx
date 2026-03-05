"use client";

import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile } from "@/services";

export default function HistoryPage() {
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();

  return (
    <WorkspaceShell
      eyebrow="Production"
      title="History"
      description="Recent production execution history and quality trend snapshots."
      insight="Command adherence has improved for three consecutive days."
    >
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3 pb-8 border-b border-[#2A2A2E]">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Last 7 Days
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            168 batches
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Avg Adherence
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            92%
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            Variance Trend
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            Down
          </p>
        </article>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          Operational Highlights
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-[14px] text-[#C7C7CC]">
            • Variance is stabilizing around target threshold.
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • Largest improvement came from reduced late prep.
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • History panel ready for advanced filters.
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}
