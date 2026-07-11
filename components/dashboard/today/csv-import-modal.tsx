"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { ModalShell } from "@/components/ui/modal-shell";
import { parseCSVFile } from "@/services/production-intelligence/csv-mapping";
import { useCSVUploadSessionStore } from "@/services/production-intelligence/csv-upload-session";
import { productionIntelligenceEndpoints } from "@/services/production-intelligence/endpoints";

/**
 * POS sales CSV import entry point: template download + file selection, then
 * hands off to the column-mapping screen. Owns all of its upload state.
 */
export function CsvImportModal({
  open,
  onClose,
  branchId,
  targetDate,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
  targetDate: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const csvUploadSession = useCSVUploadSessionStore();

  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setError(null);
    setStatus(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFileSelect = async (selected: File | null) => {
    reset();
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".csv")) {
      setError(t("today.csv.invalidExtension"));
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError(t("today.csv.tooLarge"));
      return;
    }
    try {
      const parsed = await parseCSVFile(selected);
      if (!parsed.headers.length) {
        setError(t("today.csv.noHeader"));
        return;
      }
      setFile(selected);
      setHeaders(parsed.headers);
      setStatus(t("today.csv.columnsDetected", { count: parsed.headers.length }));
    } catch {
      setError(t("today.csv.unreadable"));
    }
  };

  const handleDownload = async () => {
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(
        productionIntelligenceEndpoints.posCSVTemplate(),
      );
      if (!response.ok) {
        setError(t("today.csv.downloadError"));
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prepIQ_pos_sales_import_template.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      setStatus(t("today.csv.downloadSuccess"));
    } catch {
      setError(t("today.csv.downloadError"));
    }
  };

  const proceedToMapping = () => {
    if (!file || !branchId) {
      setError(t("today.csv.selectFile"));
      return;
    }
    const returnPath = `/workspace/today?branch_id=${branchId}&date=${targetDate}&csv_import=1`;
    csvUploadSession.setSession({
      file,
      branchId,
      returnPath,
      targetDate,
    });
    close();
    router.push("/workspace/today/csv-map");
  };

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t("today.csv.modalTitle")}
      description={t("today.csv.modalDescription")}
      maxWidthClassName="max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-10 items-center rounded-full border border-surface-4 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-3"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={proceedToMapping}
            disabled={!file}
            className="inline-flex h-10 items-center rounded-full border border-brand-gold/45 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("today.csv.continueToMapping")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.csv.template")}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            {t("today.csv.templateDescription")}
          </p>
          <button
            type="button"
            onClick={handleDownload}
            className="mt-3 inline-flex h-9 items-center rounded-full border border-surface-4 px-4 text-xs font-semibold text-text-primary hover:bg-surface-3"
          >
            {t("today.csv.downloadTemplate")}
          </button>
        </div>

        <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t("today.csv.upload")}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            {t("today.csv.uploadDescription")}
          </p>
          <label className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-full border border-surface-4 bg-surface-2 px-4 py-2 text-sm text-text-secondary hover:border-brand-gold">
            <span>{file ? file.name : t("today.csv.chooseFile")}</span>
            <input
              type="file"
              accept=".csv"
              onChange={(event) =>
                handleFileSelect(event.target.files?.[0] ?? null)
              }
              className="hidden"
            />
            <span className="text-xs font-semibold text-brand-gold">
              {t("today.csv.browse")}
            </span>
          </label>
          {status ? (
            <p className="mt-2 text-xs text-text-secondary">{status}</p>
          ) : null}
          {headers.length ? (
            <p className="mt-2 text-xs text-text-muted">
              {t("today.csv.columnsDetectedList", { columns: headers.join(", ") })}
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 text-xs text-status-critical">{error}</p>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
