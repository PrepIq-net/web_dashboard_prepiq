"use client";

import { Download, Page, WarningTriangle } from "iconoir-react";
import { resolveBackendFileUrl } from "@/lib/api/client";
import { useTranslation } from "@/lib/i18n";
import type { AnalystArtifact } from "@/services/insights/types";

/**
 * A file the Analyst generated on request. Same download affordance as
 * `reports-tab.tsx`'s scheduled reports — this is the same kind of object,
 * just requested in chat instead of by the nightly pipeline.
 *
 * `status`/`download_url` are resolved live by the backend serializer at read
 * time (see `AnalystMessageSerializer.get_artifacts`), so this never needs its
 * own polling: by the time the message exists, generation already finished.
 */
export function AnalystExportCard({ artifact }: { artifact: AnalystArtifact }) {
  const { t } = useTranslation();
  const failed = artifact.status === "FAILED";
  const format = (artifact.format ?? "").toUpperCase();
  const downloadUrl = resolveBackendFileUrl(artifact.download_url ?? "");

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-4 bg-surface-2 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
          <Page className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary">
            {artifact.title || t("workspace.insights.analysis.export.untitled")}
          </p>
          <p className="text-[11px] text-text-muted">
            {format}
            {artifact.row_count != null
              ? ` · ${t("workspace.insights.analysis.export.rows", { count: String(artifact.row_count) })}`
              : ""}
          </p>
        </div>
      </div>

      {failed || !downloadUrl ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-status-critical">
          <WarningTriangle className="h-3.5 w-3.5" />
          {t("workspace.insights.analysis.export.failed")}
        </span>
      ) : (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-surface-4 px-3 text-[12px] text-text-secondary transition-colors hover:bg-surface-3"
        >
          <Download className="h-3.5 w-3.5" />
          {t("workspace.insights.analysis.export.download")}
        </a>
      )}
    </div>
  );
}
