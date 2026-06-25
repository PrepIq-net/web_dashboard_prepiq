"use client";

import { usePathname } from "next/navigation";

const SETUP_STEPS = [
  { label: "Branch", paths: ["/setup/branch"] },
  { label: "Sales Data", paths: ["/setup/sales"] },
  { label: "Menu Items", paths: ["/setup/items"] },
  { label: "Forecast", paths: ["/setup/forecast"] },
  { label: "Team", paths: ["/setup/staff"] },
  { label: "Plan", paths: ["/setup/pricing", "/setup/checkout"] },
];

function SetupProgressBar() {
  const pathname = usePathname();

  const currentIndex = SETUP_STEPS.findIndex((step) =>
    step.paths.some((p) => pathname.startsWith(p)),
  );

  if (currentIndex === -1) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#141416]/95 backdrop-blur-sm border-b border-[#1C1C1F]">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5A5A60] shrink-0">
          Setup
        </span>
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {SETUP_STEPS.map((step, idx) => {
            const isComplete = idx < currentIndex;
            const isActive = idx === currentIndex;
            return (
              <div key={step.label} className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all duration-300 ${
                      isActive
                        ? "bg-[#A8821F] text-[#141416]"
                        : isComplete
                          ? "bg-[#A8821F]/30 text-[#A8821F]"
                          : "bg-[#2E2E33] text-[#5A5A60]"
                    }`}
                  >
                    {isComplete ? "✓" : idx + 1}
                  </span>
                  <span
                    className={`text-[11px] font-semibold transition-colors duration-300 ${
                      isActive
                        ? "text-[#F5F5F7]"
                        : isComplete
                          ? "text-[#5A5A60]"
                          : "text-[#3A3A40]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < SETUP_STEPS.length - 1 && (
                  <div
                    className={`h-px w-6 transition-colors duration-300 ${
                      isComplete ? "bg-[#A8821F]/40" : "bg-[#2E2E33]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="shrink-0 text-[10px] font-semibold text-[#5A5A60]">
          {currentIndex + 1} / {SETUP_STEPS.length}
        </div>
      </div>
      {/* Progress fill bar */}
      <div className="h-px bg-[#2E2E33]">
        <div
          className="h-full bg-[#A8821F] transition-all duration-500 ease-out"
          style={{
            width: `${((currentIndex + 1) / SETUP_STEPS.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SetupProgressBar />
      <div className="pt-[57px]">{children}</div>
    </>
  );
}
