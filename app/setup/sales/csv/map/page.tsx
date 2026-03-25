"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ViewColumns3, CheckCircle } from "iconoir-react";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import {
  buildMappedCSV,
  parseCSVFile,
  suggestCSVMapping,
  type CSVColumnMapping,
} from "@/services/production-intelligence/csv-mapping";
import { useCSVUploadSessionStore } from "@/services/production-intelligence/csv-upload-session";
import {
  useImportPOSCSV,
  usePreviewPOSCSVImport,
} from "@/services/production-intelligence/hooks";

const REQUIRED_FIELDS: Array<{
  id: keyof CSVColumnMapping;
  label: string;
  description: string;
}> = [
  {
    id: "saleDate",
    label: "Date",
    description: "When the sale occurred (e.g., date, timestamp)",
  },
  {
    id: "item",
    label: "Item name or POS item id",
    description: "Item title or provider item identifier from your export",
  },
  {
    id: "quantity",
    label: "Quantity sold",
    description: "How many units (e.g., qty, amount)",
  },
];

const OPTIONAL_FIELDS: Array<{
  id: keyof CSVColumnMapping;
  label: string;
  description: string;
}> = [
  { id: "revenue", label: "Revenue (optional)", description: "Total sale value for margin analysis." },
  { id: "unit", label: "Unit (optional)", description: "PCS, KG, LTR, etc." },
  { id: "externalRef", label: "External ref (optional)", description: "Order/receipt identifier for dedupe." },
];

export default function CSVMappingPage() {
  const router = useRouter();
  const file = useCSVUploadSessionStore((state) => state.file);
  const branchId = useCSVUploadSessionStore((state) => state.branchId);
  const returnPath = useCSVUploadSessionStore((state) => state.returnPath);
  const clearSession = useCSVUploadSessionStore((state) => state.clearSession);
  const previewMutation = usePreviewPOSCSVImport();
  const importMutation = useImportPOSCSV();

  const [headers, setHeaders] = useState<string[]>([]);
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseCSVFile>> | null>(null);
  const [mapping, setMapping] = useState<CSVColumnMapping>({
    saleDate: "",
    item: "",
    quantity: "",
    revenue: "",
    unit: "",
    externalRef: "",
  });
  const [autoCreateItems, setAutoCreateItems] = useState(false);
  const [mappingError, setMappingError] = useState("");
  const [mappedFile, setMappedFile] = useState<File | null>(null);
  const [isTransitioningAfterImport, setIsTransitioningAfterImport] =
    useState(false);

  useEffect(() => {
    async function loadFile() {
      if (isTransitioningAfterImport) return;
      if (!file || !branchId) {
        router.replace("/setup/sales/csv");
        return;
      }
      const result = await parseCSVFile(file);
      const availableHeaders = result.headers.filter(Boolean);
      if (!availableHeaders.length) {
        setMappingError("CSV has no header row.");
        return;
      }
      setHeaders(availableHeaders);
      setParsed(result);
      const suggested = suggestCSVMapping(availableHeaders);
      setMapping({
        saleDate: suggested.saleDate || "",
        item: suggested.item || "",
        quantity: suggested.quantity || "",
        revenue: suggested.revenue || "",
        unit: suggested.unit || "",
        externalRef: suggested.externalRef || "",
      });
    }
    void loadFile();
  }, [branchId, file, isTransitioningAfterImport, router]);

  const mappingSchema = z
    .object({
      saleDate: z.string().min(1, "Sale date column is required."),
      item: z.string().min(1, "Item column is required."),
      quantity: z.string().min(1, "Quantity column is required."),
      revenue: z.string().optional(),
      unit: z.string().optional(),
      externalRef: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const values = [
        data.saleDate,
        data.item,
        data.quantity,
        data.revenue,
        data.unit,
        data.externalRef,
      ].filter(Boolean);
      const unique = new Set(values);
      if (unique.size !== values.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each CSV column can only map to one field.",
        });
      }
      if (headers.length) {
        const headerSet = new Set(headers);
        for (const [key, value] of Object.entries(data)) {
          if (!value) continue;
          if (!headerSet.has(value)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Column "${value}" is not in the CSV headers.`,
              path: [key],
            });
          }
        }
      }
    });

  const isComplete = REQUIRED_FIELDS.every((field) =>
    Boolean(mapping[field.id]),
  );

  const selectOptions = useMemo(
    () => [
      { value: "", label: "Unmapped" },
      ...headers.map((header) => ({ value: header, label: header })),
    ],
    [headers],
  );

  function handleMapChange(fieldId: keyof CSVColumnMapping, value: string) {
    setMappingError("");
    setMapping((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handlePreview() {
    if (!isComplete || !parsed || !branchId) return;

    const validation = mappingSchema.safeParse(mapping);
    if (!validation.success) {
      setMappingError(validation.error.issues[0]?.message ?? "Please fix mapping errors.");
      return;
    }

    const normalizedCSV = buildMappedCSV(parsed, mapping);
    const fileToSend = new File([normalizedCSV], "mapped-sales.csv", {
      type: "text/csv",
    });
    setMappedFile(fileToSend);

    try {
      await previewMutation.mutateAsync({
        branch_id: branchId,
        file: fileToSend,
        auto_create_items: autoCreateItems,
        preview_limit: 50,
      });
    } catch (error) {
      setMappingError(error instanceof Error ? error.message : "Failed to preview CSV.");
    }
  }

  async function handleImport() {
    if (!mappedFile || !branchId) return;
    try {
      const result = await importMutation.mutateAsync({
        branch_id: branchId,
        file: mappedFile,
        auto_create_items: autoCreateItems,
      });

      const created = Number(result.created || 0);
      const updated = Number(result.updated || 0);
      const failed = Number(result.failed || 0);

      if (created + updated > 0) {
        toast.success(
          failed > 0
            ? `Imported ${created + updated} rows (${failed} failed).`
            : `Import complete: ${created + updated} rows processed.`,
        );
        setIsTransitioningAfterImport(true);
        // In setup flow (no returnPath), go to items confirmation; otherwise return to caller
        router.push(returnPath || "/setup/items");
        setTimeout(() => clearSession(), 400);
        return;
      }

      toast.error("No rows were imported. Please check your mapping.");
      setMappingError("No rows were imported. Please review mapping and try again.");
    } catch (error) {
      setMappingError(error instanceof Error ? error.message : "Failed to import CSV.");
      toast.error(error instanceof Error ? error.message : "Failed to import CSV.");
    }
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Back + step */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => router.back()}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5A5A60] hover:text-[#8E8E93] transition-colors"
          >
            ← Back
          </button>
          {returnPath ? (
            <button
              onClick={() => router.push(returnPath)}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F] hover:text-[#D6A83A] transition-colors"
            >
              Back to Live
            </button>
          ) : null}
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 2 — Map Columns
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          Match your columns
        </h1>
        <p className="text-[14px] text-[#8E8E93] mb-8">
          We found {headers.length} columns in your CSV. Please tell us
          which column matches the data we need to generate your forecasts.
        </p>

        {/* Mapping Form */}
        <div className="bg-[#1C1C1F] border border-[#2E2E33] rounded-[12px] p-5 mb-8">
          <div className="grid grid-cols-2 gap-8 mb-4 px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Required Data
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Your CSV Column
            </span>
          </div>

          <div className="space-y-4">
            {REQUIRED_FIELDS.concat(OPTIONAL_FIELDS).map((field) => {
              const isRequired = REQUIRED_FIELDS.some((required) => required.id === field.id);
              const isMapped = Boolean(mapping[field.id]);
              return (
                <div
                  key={field.id}
                  className="grid grid-cols-2 gap-8 items-center bg-[#232327] p-3 rounded-[8px] border border-[#2E2E33]"
                >
                  {/* Left Side: Our Field */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isMapped ? (
                        <CheckCircle className="h-5 w-5 text-[#3F8F68]" />
                      ) : (
                        <ViewColumns3 className="h-5 w-5 text-[#A8821F]" />
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#F5F5F7]">
                        {field.label}
                      </p>
                      <p className="text-[12px] text-[#5A5A60] mt-0.5">
                        {field.description}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: CSV Column Select */}
                  <div>
                    <Select
                      label="CSV Column"
                      options={selectOptions}
                      value={mapping[field.id] || ""}
                      onChange={(value) => handleMapChange(field.id, value)}
                      className={`${
                        isRequired && !isMapped
                          ? "[&_button]:border-[#C48B2A]/50 [&_span]:text-[#C48B2A]"
                          : ""
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[#C7C7CC] mb-4">
          <input
            type="checkbox"
            checked={autoCreateItems}
            onChange={(event) => setAutoCreateItems(event.target.checked)}
            className="accent-[#A8821F]"
          />
          Auto-create missing items from CSV
        </label>

        {mappingError && (
          <div className="rounded-[10px] border border-[#C44949]/50 bg-[#C44949]/10 p-3 mb-4">
            <p className="text-[13px] text-[#E7B4B4]">{mappingError}</p>
          </div>
        )}

        {!!previewMutation.data && (
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-4 mb-4 text-[13px] text-[#C7C7CC]">
            <p>
              Preview: {previewMutation.data.valid_rows} valid,{" "}
              {previewMutation.data.failed_rows} failed, {previewMutation.data.would_create} create,{" "}
              {previewMutation.data.would_update} update.
            </p>
            {!!previewMutation.data.warnings.length && (
              <p className="text-[#C48B2A] mt-2">{previewMutation.data.warnings[0]}</p>
            )}
            {!!previewMutation.data.errors.length && (
              <p className="text-[#E7B4B4] mt-2">{previewMutation.data.errors[0]}</p>
            )}
          </div>
        )}

        {/* CTA actions */}
        <button
          onClick={() => {
            void handlePreview();
          }}
          disabled={!isComplete || previewMutation.isPending || importMutation.isPending}
          className="w-full h-12 bg-[#232327] hover:bg-[#2B2B30] border border-[#2E2E33] disabled:opacity-40 disabled:cursor-not-allowed text-[#F5F5F7] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150 mb-3"
        >
          {previewMutation.isPending ? (
            <>
              <Spinner size="sm" color="#F5F5F7" />
              Validating...
            </>
          ) : (
            "Validate Mapping"
          )}
        </button>

        <button
          onClick={() => {
            void handleImport();
          }}
          disabled={!previewMutation.data || importMutation.isPending}
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
        >
          {importMutation.isPending ? (
            <>
              <Spinner size="sm" color="#141416" />
              Importing...
            </>
          ) : (
            <>
              Import Sales Data
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
