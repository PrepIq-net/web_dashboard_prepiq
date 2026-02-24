"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ViewColumns3, CheckCircle } from "iconoir-react";

// Mock columns that were "read" from the user's uploaded CSV
const CSV_COLUMNS = [
  "Select a column...",
  "sale_date",
  "menu_item",
  "qty",
  "total_revenue",
  "tax",
  "discount",
  "location_id",
];

const REQUIRED_FIELDS = [
  {
    id: "date",
    label: "Date",
    description: "When the sale occurred (e.g., date, timestamp)",
  },
  {
    id: "item",
    label: "Item name",
    description: "Product sold (e.g., item_name, product)",
  },
  {
    id: "quantity",
    label: "Quantity sold",
    description: "How many units (e.g., qty, amount)",
  },
  {
    id: "revenue",
    label: "Revenue",
    description: "Total sale value (e.g., net_sales, revenue)",
  },
];

export default function CSVMappingPage() {
  const router = useRouter();

  // Mapping state: field id -> selected CSV column
  const [mapping, setMapping] = useState<Record<string, string>>({
    date: "sale_date", // Pre-filling intelligently if possible
    item: "menu_item",
    quantity: "qty",
    revenue: "Select a column...", // Left unmapped to show empty state
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Check if all required fields are mapped to a valid column
  const isComplete = REQUIRED_FIELDS.every(
    (field) => mapping[field.id] && mapping[field.id] !== "Select a column...",
  );

  function handleMapChange(fieldId: string, value: string) {
    setMapping((prev) => ({ ...prev, [fieldId]: value }));
  }

  function handleContinue() {
    if (!isComplete) return;

    setIsProcessing(true);
    // Simulate processing the CSV and generating items
    setTimeout(() => {
      router.push("/setup/items");
    }, 1500);
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
          <span className="h-px flex-1 bg-[#2E2E33]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 2 — Map Columns
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          Match your columns
        </h1>
        <p className="text-[14px] text-[#8E8E93] mb-8">
          We found {CSV_COLUMNS.length - 1} columns in your CSV. Please tell us
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
            {REQUIRED_FIELDS.map((field) => {
              const isMapped =
                mapping[field.id] && mapping[field.id] !== "Select a column...";
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
                    <select
                      value={mapping[field.id]}
                      onChange={(e) =>
                        handleMapChange(field.id, e.target.value)
                      }
                      className={`w-full h-10 bg-[#141416] border rounded-[6px] px-3 text-[13px] focus:outline-none appearance-none transition-colors
                        ${
                          !isMapped
                            ? "border-[#C48B2A]/50 text-[#C48B2A]"
                            : "border-[#2E2E33] text-[#F5F5F7] focus:border-[#A8821F]"
                        }
                      `}
                    >
                      {CSV_COLUMNS.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={!isComplete || isProcessing}
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
        >
          {isProcessing ? "Processing Data..." : "Import Sales Data"}
          {!isProcessing && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
