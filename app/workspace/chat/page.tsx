"use client";

import { useTranslation } from "@/lib/i18n";
import { OperationsHub } from "@/components/hub/operations-hub";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { useCurrentUserProfile } from "@/services";

export default function OperationsHubPage() {
  const { t } = useTranslation();
  const { data: user, isLoading } = useCurrentUserProfile();

  if (isLoading || !user) {
    return (
      <WorkspaceShell
        eyebrow={t("workspace.chat.eyebrow")}
        title={t("workspace.chat.title")}
        description={t("workspace.chat.description")}
        insight={t("workspace.chat.insight")}
      >
        <div className="flex h-[calc(100vh-200px)] rounded-xl border border-surface-4 bg-surface-2">
          <div className="w-80 border-r border-surface-4 p-4">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-surface-3" />
              ))}
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      eyebrow={t("workspace.chat.eyebrow")}
      title={t("workspace.chat.title")}
      description={t("workspace.chat.description")}
      insight={t("workspace.chat.insight")}
    >
      <OperationsHub
        user={{
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
        }}
      />
    </WorkspaceShell>
  );
}
