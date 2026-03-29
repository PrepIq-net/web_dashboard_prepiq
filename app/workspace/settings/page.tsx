"use client";

import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile } from "@/services";
import { useTranslation } from "@/lib/i18n";

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: user } = useCurrentUserProfile();

  return (
    <WorkspaceShell
      eyebrow={t("workspace.settings.eyebrow")}
      title={t("workspace.settings.title")}
      description={t("workspace.settings.description")}
      insight={t("workspace.settings.insight")}
    >
      <section className="grid grid-cols-1 gap-5 md:grid-cols-3 pb-8 border-b border-[#2A2A2E]">
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.settings.accessProfiles")}
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            5
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.settings.mfaCoverage")}
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            100%
          </p>
        </article>
        <article>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("workspace.settings.pendingChanges")}
          </p>
          <p className="mt-2 font-display text-[30px] leading-[36px] text-[#F5F5F7]">
            2
          </p>
        </article>
      </section>

      <section className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#8E8E93]">
          {t("workspace.settings.operationalHighlights")}
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-[14px] text-[#C7C7CC]">
            • {t("workspace.settings.highlight1")}
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • {t("workspace.settings.highlight2")}
          </p>
          <p className="text-[14px] text-[#C7C7CC]">
            • {t("workspace.settings.highlight3")}
          </p>
        </div>
      </section>
    </WorkspaceShell>
  );
}
