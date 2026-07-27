"use client";

import { Download, Mail, WarningTriangle } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";
import type { InsightReport, ReportsLog } from "@/services/insights/types";
import { EmptyState } from "./insight-primitives";

export function ReportsTab({ data }: { data: ReportsLog }) {
  const { t } = useTranslation();

  if (data.results.length === 0) {
    return (
      <EmptyState
        title={t("workspace.insights.reports.empty")}
        reason={t("workspace.insights.reports.emptyReason")}
      />
    );
  }

  return (
    <div>
      <p className="mb-8 text-[13px] text-text-muted">
        {data.board_reports_available
          ? t("workspace.insights.reports.scopeCommand")
          : t("workspace.insights.reports.scopeIntelligence")}
      </p>

      <div className="space-y-8">
        {data.results.map((report) => (
          <ReportRow key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}

function ReportRow({ report }: { report: InsightReport }) {
  const { t } = useTranslation();
  const isBoard = report.report_type === "MONTHLY_BOARD";

  return (
    <article className="border-b border-surface-4/60 pb-6 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                isBoard
                  ? "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
                  : "border-surface-4 bg-surface-3 text-text-muted"
              }`}
            >
              {t(
                isBoard
                  ? "workspace.insights.reports.board"
                  : "workspace.insights.reports.weekly",
              )}
            </span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
              {report.period_start} → {report.period_end}
            </span>
          </div>
          <h3 className="mt-2 font-display text-[16px] font-semibold text-text-primary">
            {report.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-muted">
            {report.sent_at ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t("workspace.insights.reports.sentTo", {
                  count: report.recipient_count,
                })}
              </span>
            ) : null}
            {/* A report that generated but never reached anyone must not sit
                here looking delivered. */}
            {report.email_error ? (
              <span className="inline-flex items-center gap-1.5 text-status-warning">
                <WarningTriangle className="h-3.5 w-3.5" />
                {t("workspace.insights.reports.notDelivered")}
              </span>
            ) : null}
          </div>
        </div>

        {report.has_pdf && report.download_url ? (
          <a
            href={report.download_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-surface-4 px-4 text-[13px] text-text-secondary transition-colors hover:bg-surface-3"
          >
            <Download className="h-4 w-4" />
            {t("workspace.insights.reports.download")}
          </a>
        ) : (
          <span className="text-[12px] text-text-muted">
            {t("workspace.insights.reports.noPdf")}
          </span>
        )}
      </div>
    </article>
  );
}
