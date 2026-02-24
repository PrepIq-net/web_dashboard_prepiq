"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CloudUpload, Check, Xmark, Page } from "iconoir-react";

type UploadState = "idle" | "dragging" | "selected" | "uploading";

const COLUMN_HINTS = [
  { field: "Date", examples: "date, sale_date, transaction_date" },
  { field: "Item name", examples: "item, product, name, menu_item" },
  { field: "Quantity sold", examples: "qty, quantity, units_sold" },
  { field: "Revenue", examples: "revenue, amount, total, net_sales" },
];

export default function CSVUploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);

  function handleFile(f: File) {
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
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleContinue() {
    if (!file) return;
    // TODO: upload + column mapping — navigate to mapping step
    router.push("/setup/sales/csv/map");
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
            ← Back
          </button>
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 2 — Upload CSV
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          Upload your sales data
        </h1>
        <p className="text-[14px] text-[#8E8E93] mb-8">
          Export from your current system and drop it here. We&apos;ll walk you
          through mapping the columns.
        </p>

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
                  ? "Drop it here"
                  : "Drop your file or click to browse"}
              </p>
              <p className="text-[12px] text-[#5A5A60]">
                .csv only · max 50 MB
              </p>
            </div>
          )}
        </div>

        {/* Template Download */}
        <div className="flex justify-end mb-6">
          <button
            onClick={() => {
              const csvContent =
                "data:text/csv;charset=utf-8,Date,Item Name,Quantity,Revenue\n2026-02-24,Croissant,10,45.00";
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "prepiq_sales_template.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="text-[12px] font-medium text-[#A8821F] hover:text-[#B8962E] transition-colors"
          >
            Download CSV template
          </button>
        </div>

        {/* Column requirements */}
        <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-5 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8E8E93] mb-3">
            Required columns
          </p>
          <div className="space-y-2">
            {COLUMN_HINTS.map((col) => (
              <div key={col.field} className="flex items-start gap-3">
                <Check className="h-3.5 w-3.5 text-[#3F8F68] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[13px] font-semibold text-[#C7C7CC]">
                    {col.field}
                  </span>
                  <span className="text-[12px] text-[#5A5A60] ml-2 font-mono">
                    {col.examples}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#5A5A60] mt-4">
            Column names don&apos;t need to match exactly — you&apos;ll map them
            in the next step.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={!file}
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
        >
          Map columns
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => router.push("/")}
          className="w-full mt-3 text-center text-sm text-[#5A5A60] hover:text-[#8E8E93] transition-colors duration-150"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
