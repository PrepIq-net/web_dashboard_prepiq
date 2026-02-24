"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  PlugTypeA,
  CloudUpload,
  WarningTriangle,
  Check,
  InfoCircle,
} from "iconoir-react";

type Option = "pos" | "csv" | "skip";

const POS_SYSTEMS = ["Square", "Toast", "Lightspeed", "Clover", "Shopify POS"];

export default function SalesSetupPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Option | null>(null);

  function handleContinue() {
    if (!selected) return;
    if (selected === "pos") router.push("/setup/sales/pos");
    if (selected === "csv") router.push("/setup/sales/csv");
    if (selected === "skip") router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Step eyebrow */}
        <div className="flex items-center gap-2 mb-10">
          <span className="h-px w-6 bg-[#A8821F]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
            Step 2 — Sales Data
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-3">
          How do you track sales?
        </h1>

        {/* Context */}
        <div className="flex items-start gap-3 bg-[#1C1C1F] border border-[#2E2E33] rounded-[12px] px-4 py-3.5 mb-8">
          <InfoCircle className="h-4 w-4 text-[#3A6EA5] shrink-0 mt-0.5" />
          <p className="text-[13px] leading-[20px] text-[#C7C7CC]">
            PrepIQ uses historical sales to generate production forecasts. The
            more data you provide, the more accurate your prep quantities will
            be.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {/* Option 1 — Connect POS */}
          <OptionCard
            id="pos"
            selected={selected === "pos"}
            onSelect={() => setSelected("pos")}
            icon={<PlugTypeA className="h-5 w-5" />}
            badge="Recommended"
            title="Connect POS system"
            description="Pull 30–90 days of sales automatically. Items are created from your POS catalog."
            detail={
              <div className="flex flex-wrap gap-1.5 mt-3">
                {POS_SYSTEMS.map((pos) => (
                  <span
                    key={pos}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#232327] text-[#8E8E93] border border-[#2E2E33]"
                  >
                    {pos}
                  </span>
                ))}
              </div>
            }
          />

          {/* Option 2 — Upload CSV */}
          <OptionCard
            id="csv"
            selected={selected === "csv"}
            onSelect={() => setSelected("csv")}
            icon={<CloudUpload className="h-5 w-5" />}
            title="Upload sales CSV"
            description="Export from your current system and upload. We'll map the columns for you."
            detail={
              <p className="text-[11px] text-[#5A5A60] mt-2 font-mono">
                Supported: .csv · .xlsx · .xls
              </p>
            }
          />

          {/* Option 3 — Skip */}
          <OptionCard
            id="skip"
            selected={selected === "skip"}
            onSelect={() => setSelected("skip")}
            icon={<WarningTriangle className="h-5 w-5" />}
            title="Skip for now"
            description="You can add data later, but forecasts will be unavailable until then."
            intent="warning"
          />
        </div>

        {/* Continue */}
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
        >
          {selected === "skip" ? "Continue to dashboard" : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OptionCard
// ─────────────────────────────────────────────────────────────────────────────
interface OptionCardProps {
  id: Option;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  detail?: React.ReactNode;
  intent?: "default" | "warning";
}

function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  badge,
  detail,
  intent = "default",
}: OptionCardProps) {
  const isWarning = intent === "warning";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-[12px] border px-5 py-4 transition-all duration-150 focus:outline-none
        ${
          selected
            ? isWarning
              ? "border-[#C48B2A] bg-[#C48B2A]/8"
              : "border-[#A8821F] bg-[#A8821F]/8"
            : "border-[#2E2E33] bg-[#1C1C1F] hover:border-[#3A3A3F]"
        }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <span
          className={`mt-0.5 shrink-0 transition-colors duration-150 ${
            selected
              ? isWarning
                ? "text-[#C48B2A]"
                : "text-[#A8821F]"
              : "text-[#5A5A60]"
          }`}
        >
          {icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-sm font-semibold transition-colors duration-150 ${
                selected ? "text-[#F5F5F7]" : "text-[#C7C7CC]"
              }`}
            >
              {title}
            </span>
            {badge && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#A8821F]/15 text-[#A8821F]">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[13px] leading-[20px] text-[#8E8E93]">
            {description}
          </p>
          {detail}
        </div>

        {/* Selection indicator */}
        <span
          className={`mt-0.5 h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all duration-150 ${
            selected
              ? isWarning
                ? "border-[#C48B2A] bg-[#C48B2A]"
                : "border-[#A8821F] bg-[#A8821F]"
              : "border-[#3A3A3F]"
          }`}
        >
          {selected && <Check className="h-3 w-3 text-[#141416]" />}
        </span>
      </div>
    </button>
  );
}
