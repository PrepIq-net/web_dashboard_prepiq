"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CloudUpload, Check, Xmark, Page } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { useProductionIntelligenceAccessScope } from "@/services/production-intelligence/hooks";
import { useCSVUploadSessionStore } from "@/services/production-intelligence/csv-upload-session";
import { useTranslation } from "@/lib/i18n";

type UploadState = "idle" | "dragging" | "selected" | "uploading";

const COLUMN_HINTS = [
  { field: "Date", examples: "date, sale_date, transaction_date" },
  { field: "Item name", examples: "item, product, name, menu_item" },
  { field: "Quantity sold", examples: "qty, quantity, units_sold" },
  { field: "Revenue", examples: "revenue, amount, total, net_sales" },
];

export default function CSVUploadPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState("");
  const setSession = useCSVUploadSessionStore((state) => state.setSession);
  const {
    data: scope,
    isLoading: scopeLoading,
    error: scopeError,
  } = useProductionIntelligenceAccessScope();

  const branches = useMemo(() => scope?.accessible_branches ?? [], [scope]);
  const selectedBranchId =
    branchId || scope?.default_branch_id || branches[0]?.id || "";

  function handleFile(f: File) {
    if (!String(f.name).toLowerCase().endsWith(".csv")) {
      setError(t("setup.csv.onlyCsvSupported"));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError(t("setup.csv.tooLarge"));
      return;
    }
    setError("");
    setFile(f);
    setUploadState("selected");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setUploadState("idle");
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setUploadState("dragging");
  }

  function handleDragLeave() {
    setUploadState("idle");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
  }

  function clearFile() {
    setFile(null);
    setUploadState("idle");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleContinue() {
    if (!file || !selectedBranchId) return;
    setSession({ file, branchId: selectedBranchId });
    router.push("/setup/sales/csv/map");
  }

  async function handleTemplateDownload() {
    try {
      setUploadState("uploading");
      const response = await fetch(
        "/api/proxy/api/production-intelligence/sales/import-csv/template/",
        {
          method: "GET",
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error(t("setup.csv.failedDownloadTemplate"));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "prepiq_pos_sales_import_template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("setup.csv.couldNotDownloadTemplate"));
    } finally {
      setUploadState(file ? "selected" : "idle");
    }
  }

  const isDragging = uploadState === "dragging";

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Back + step */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => router.back()}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5A5A60] hover:text-[#8E8E93] transition-colors"
          >
            {t("setup.staff.back")}
          </button>
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            {t("setup.csv.step")}
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          {t("setup.csv.title")}
        </h1>
        <p className="text-[14px] text-[#8E8E93] mb-8">
          {t("setup.csv.description")}
        </p>

        {!scopeError && (
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4 mb-6">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E93] block mb-2">
              {t("setup.csv.branchLabel")}
            </label>
            {scopeLoading ? (
              <div className="h-11 rounded-[8px] border border-[#2E2E33] bg-[#232327] flex items-center px-3 gap-2 text-[#8E8E93] text-sm">
                <Spinner size="sm" color="#8E8E93" />
                {t("setup.csv.loadingBranches")}
              </div>
            ) : (
              <Select
                label=""
                options={branches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                }))}
                value={selectedBranchId}
                onChange={setBranchId}
                placeholder={t("setup.csv.selectBranchPlaceholder")}
                className="space-y-0"
              />
            )}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !file && inputRef.current?.click()}
          className={`relative rounded-[12px] border-2 border-dashed transition-all duration-150 mb-6
            ${
              isDragging
                ? "border-[#A8821F] bg-[#A8821F]/8 scale-[1.01]"
                : file
                  ? "border-[#3F8F68] bg-[#3F8F68]/8 cursor-default"
                  : "border-[#2E2E33] bg-[#1C1C1F] hover:border-[#3A3A3F] cursor-pointer"
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={handleInputChange}
          />

          {file ? (
            /* File selected state */
            <div className="flex items-center gap-4 px-5 py-5">
              <span className="h-10 w-10 rounded-[8px] bg-[#3F8F68]/15 flex items-center justify-center shrink-0">
                <Page className="h-5 w-5 text-[#3F8F68]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#F5F5F7] truncate">
                  {file.name}
                </p>
                <p className="text-[12px] text-[#8E8E93]">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="h-7 w-7 flex items-center justify-center rounded-md text-[#5A5A60] hover:text-[#C44949] hover:bg-[#C44949]/10 transition-colors"
              >
                <Xmark className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Idle / dragging state */
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <span
                className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 transition-colors duration-150
                ${isDragging ? "bg-[#A8821F]/20" : "bg-[#232327]"}`}
              >
                <CloudUpload
                  className={`h-6 w-6 transition-colors duration-150 ${isDragging ? "text-[#A8821F]" : "text-[#5A5A60]"}`}
                />
              </span>
              <p className="text-sm font-semibold text-[#C7C7CC] mb-1">
                {isDragging
                  ? t("setup.csv.dropHere")
                  : t("setup.csv.dropOrBrowse")}
              </p>
              <p className="text-[12px] text-[#5A5A60]">
                {t("setup.csv.constraints")}
              </p>
            </div>
          )}
        </div>

        {(error || scopeError) && (
          <div className="rounded-[10px] border border-[#C44949]/50 bg-[#C44949]/10 p-3 mb-6">
            <p className="text-[13px] text-[#E7B4B4]">
              {error ||
                (scopeError instanceof Error
                  ? scopeError.message
                  : t("setup.csv.unableToLoadScope"))}
            </p>
          </div>
        )}

        {/* Template Download */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => {
              void handleTemplateDownload();
            }}
            className="text-[12px] font-medium text-[#A8821F] hover:text-[#B8962E] transition-colors"
          >
            {t("setup.csv.downloadTemplate")}
          </button>
        </div>

        {/* Column requirements */}
        <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-5 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8E8E93] mb-3">
            {t("setup.csv.requiredColumns")}
          </p>
          <div className="space-y-2">
            {COLUMN_HINTS.map((col) => (
              <div key={col.field} className="flex items-start gap-3">
                <Check className="h-3.5 w-3.5 text-[#3F8F68] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[13px] font-semibold text-[#C7C7CC]">
                    {t(`setup.csv.fields.${col.field}` as any)}
                  </span>
                  <span className="text-[12px] text-[#5A5A60] ml-2 font-mono">
                    {col.examples}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#5A5A60] mt-4">
            {t("setup.csv.columnsDisclaimer")}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={
            !file || !selectedBranchId || branches.length === 0 || scopeLoading
          }
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
        >
          {t("setup.csv.mapSubmit")}
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => router.push("/setup/forecast")}
          className="w-full mt-3 text-center text-sm text-[#5A5A60] hover:text-[#8E8E93] transition-colors duration-150"
        >
          {t("setup.branch.skip")}
        </button>
      </div>
    </div>
  );
}
