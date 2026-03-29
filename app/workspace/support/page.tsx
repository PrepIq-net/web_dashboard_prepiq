"use client";

import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUserProfile } from "@/services";

export default function SupportPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();

  return (
    <WorkspaceShell
      eyebrow={t("workspace.support.eyebrow")}
      title={t("workspace.support.title")}
      description={t("workspace.support.description")}
      insight={t("workspace.support.insight")}
    >
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3 pb-8 border-b border-[#2A2A2E]">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.support.openTickets")}
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            2
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.support.avgResponse")}
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            {t("workspace.support.avgResponseValue", { minutes: 18 })}
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.support.resolvedThisWeek")}
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            11
          </p>
        </article>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          {t("workspace.support.operationalHighlights")}
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-[14px] text-[#C7C7CC]">
            • {t("workspace.support.highlight1")}
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • {t("workspace.support.highlight2")}
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • {t("workspace.support.highlight3")}
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}
