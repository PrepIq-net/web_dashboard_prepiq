"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Check, Link } from "iconoir-react";

interface POSSystem {
  id: string;
  name: string;
  description: string;
  color: string; // brand accent for the logo tile
  initials: string; // until real logos are available
  logoSrc?: string;
  pulls: string[];
  authType: "oauth" | "api_key";
  authLabel: string;
}

const POS_SYSTEMS: POSSystem[] = [
  {
    id: "square",
    name: "Square",
    description: "Used worldwide by cafés, restaurants, and food trucks.",
    color: "#000000",
    initials: "SQ",
    logoSrc: "/app_logo/square-point-of-sale-logo.png",
    pulls: [
      "30–90 days of itemised sales",
      "Menu items auto-created",
      "Hourly sales breakdown",
    ],
    authType: "oauth",
    authLabel: "Connect with Square",
  },
  {
    id: "toast",
    name: "Toast POS",
    description:
      "Purpose-built for full-service and quick-service restaurants.",
    color: "#FF4C00",
    initials: "TS",
    pulls: [
      "90 days of net sales by item",
      "Modifier-level data",
      "Void and comp tracking",
    ],
    authType: "api_key",
    authLabel: "Enter Toast API key",
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    description: "Multi-location retail and restaurant POS.",
    color: "#005AE0",
    initials: "LS",
    pulls: [
      "Sales by location and item",
      "Inventory snapshots",
      "Cost of goods data",
    ],
    authType: "oauth",
    authLabel: "Connect with Lightspeed",
  },
  {
    id: "clover",
    name: "Clover",
    description: "All-in-one POS and payments platform.",
    color: "#1DA462",
    initials: "CL",
    pulls: [
      "Itemised order history",
      "Revenue by day and shift",
      "Discount and refund data",
    ],
    authType: "api_key",
    authLabel: "Enter Clover API key",
  },
  {
    id: "shopify",
    name: "Shopify POS",
    description: "Unified online + in-store commerce.",
    color: "#96BF48",
    initials: "SP",
    pulls: [
      "Product-level sales",
      "Online + in-store unified",
      "Variant-level quantities",
    ],
    authType: "oauth",
    authLabel: "Connect with Shopify",
  },
  {
    id: "revel",
    name: "Revel Systems",
    description: "Enterprise-grade iPad POS for restaurants and chains.",
    color: "#E4002B",
    initials: "RV",
    pulls: [
      "Multi-location rollup",
      "Ingredient-level depletion",
      "Customer frequency data",
    ],
    authType: "api_key",
    authLabel: "Enter Revel credentials",
  },
];

export default function POSSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const activePos = POS_SYSTEMS.find((p) => p.id === selected);

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
            Step 2 — Connect POS
          </span>
        </div>

        <h1 className="font-display text-[32px] leading-[40px] font-semibold text-[#F5F5F7] mb-2">
          Select your POS system
        </h1>
        <p className="text-[14px] text-[#8E8E93] mb-8">
          We&apos;ll pull your sales history automatically — no manual exports
          needed.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {POS_SYSTEMS.map((pos) => {
            const isSelected = selected === pos.id;
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => setSelected(pos.id)}
                className={`text-left rounded-[12px] border px-4 py-4 transition-all duration-150 focus:outline-none group
                  ${
                    isSelected
                      ? "border-[#A8821F] bg-[#A8821F]/8"
                      : "border-[#2E2E33] bg-[#1C1C1F] hover:border-[#3A3A3F]"
                  }`}
              >
                <div className="flex items-start gap-3">
                  {/* Logo tile */}
                  <span
                    className="h-10 w-10 rounded-[8px] flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden"
                    style={{ backgroundColor: pos.color }}
                  >
                    {pos.logoSrc ? (
                      <Image
                        src={pos.logoSrc}
                        alt={`${pos.name} logo`}
                        width={28}
                        height={28}
                        className="object-contain"
                      />
                    ) : (
                      pos.initials
                    )}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold mb-0.5 ${isSelected ? "text-[#F5F5F7]" : "text-[#C7C7CC]"}`}
                    >
                      {pos.name}
                    </p>
                    <p className="text-[12px] text-[#5A5A60] leading-[17px]">
                      {pos.description}
                    </p>
                  </div>

                  {/* Check ring */}
                  <span
                    className={`mt-0.5 h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all duration-150
                    ${isSelected ? "border-[#A8821F] bg-[#A8821F]" : "border-[#3A3A3F]"}`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-[#141416]" />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel — slides in when a POS is selected */}
        {activePos && (
          <div className="rounded-[12px] border border-[#2E2E33] bg-[#1C1C1F] p-5 mb-6 animate-fade-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8E8E93] mb-3">
              What we&apos;ll pull from {activePos.name}
            </p>
            <ul className="space-y-2 mb-5">
              {activePos.pulls.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 text-[13px] text-[#C7C7CC]"
                >
                  <Check className="h-3.5 w-3.5 text-[#3F8F68] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Auth type badge */}
            <div className="flex items-center gap-2">
              <Link className="h-3.5 w-3.5 text-[#5A5A60]" />
              <span className="text-[11px] text-[#5A5A60]">
                {activePos.authType === "oauth"
                  ? "OAuth — you'll be redirected to authorise"
                  : "API key — you'll paste a key from your dashboard"}
              </span>
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push(`/setup/sales/pos/${selected}/connect`)}
          disabled={!selected}
          className="w-full h-12 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] disabled:opacity-40 disabled:cursor-not-allowed text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
        >
          {activePos ? activePos.authLabel : "Select a POS system"}
          {selected && <ArrowRight className="h-4 w-4" />}
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
