"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparks, ArrowRight, Brain, FastArrowRight } from "iconoir-react";
import { Spinner } from "@/components/ui/spinner";

const PROCESSING_STEPS = [
  "Analyzing 90 days of sales history...",
  "Applying weather and seasonality models...",
  "Calculating item-level margin impacts...",
  "Generating your first production forecast...",
];

const MOCK_FORECAST = [
  { name: "Butter Croissant", amount: 100, unit: "pcs", trend: "+12%" },
  { name: "Oat Milk Latte (12oz)", amount: 120, unit: "cups", trend: "+5%" },
  { name: "Almond Croissant", amount: 60, unit: "pcs", trend: "-2%" },
];

export default function AutoForecastPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Simulate the intelligent processing
  useEffect(() => {
    if (isReady) return;

    const stepDuration = 1200; // time per message
    const totalSteps = PROCESSING_STEPS.length;

    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev + 1 >= totalSteps) {
          clearInterval(interval);
          setTimeout(() => setIsReady(true), 800); // Small pause before showing results
          return prev;
        }
        return prev + 1;
      });
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isReady]);

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {!isReady ? (
          // ── PROCESSING STATE ──────────────────────────────────────────────
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center">
            <div className="relative flex items-center justify-center mb-8">
              <Spinner size="xl" color="#A8821F" />
              <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                <Brain className="h-5 w-5 text-[#A8821F]" />
              </div>
            </div>

            <h1 className="font-display text-[28px] leading-[36px] font-semibold text-[#F5F5F7] mb-3">
              PrepIQ is working...
            </h1>

            <div className="h-6 overflow-hidden relative w-full flex justify-center">
              {PROCESSING_STEPS.map((step, idx) => (
                <p
                  key={step}
                  className={`absolute text-[14px] font-medium text-[#8E8E93] transition-all duration-500
                    ${idx === stepIndex ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                >
                  {step}
                </p>
              ))}
            </div>
          </div>
        ) : (
          // ── RESULTS STATE ─────────────────────────────────────────────────
          <div className="animate-fade-in">
            {/* Step Context */}
            <div className="flex items-center gap-2 mb-8">
              <Sparks className="h-4 w-4 text-[#A8821F]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A8821F]">
                Step 4 — Intelligence
              </span>
            </div>

            <h1 className="font-display text-[40px] leading-[48px] font-semibold text-[#F5F5F7] mb-3">
              Your first forecast is ready.
            </h1>
            <p className="text-[16px] leading-[24px] text-[#A0A0A5] mb-10 max-w-lg">
              Based on your sales history, here is exactly what your kitchen
              should prep for tomorrow to meet demand without wasting food.
            </p>

            {/* Forecast Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {MOCK_FORECAST.map((item) => (
                <div
                  key={item.name}
                  className="bg-[#1C1C1F] border border-[#2E2E33] rounded-[16px] p-5 flex flex-col items-center text-center"
                >
                  <p className="text-[12px] font-semibold text-[#8E8E93] mb-4 uppercase tracking-wider line-clamp-1">
                    {item.name}
                  </p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-[40px] leading-[40px] font-display font-bold text-[#F5F5F7]">
                      {item.amount}
                    </span>
                    <span className="text-[14px] font-medium text-[#5A5A60]">
                      {item.unit}
                    </span>
                  </div>
                  <div
                    className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
                      item.trend.startsWith("+")
                        ? "text-[#3F8F68] bg-[#3F8F68]/10"
                        : "text-[#5A5A60] bg-[#2E2E33]/50"
                    }`}
                  >
                    {item.trend} vs last week
                  </div>
                </div>
              ))}
            </div>

            {/* Next Steps */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[#2E2E33] gap-4">
              <p className="text-[13px] text-[#8E8E93]">
                Next: Invite your kitchen staff.
              </p>

              <button
                onClick={() => router.push("/setup/staff")}
                className="w-full sm:w-auto h-12 px-8 bg-[#A8821F] hover:bg-[#B8962E] active:bg-[#8F6F18] text-[#141416] text-sm font-semibold rounded-[8px] flex items-center justify-center gap-2 transition-colors duration-150"
              >
                Continue to Team Setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
