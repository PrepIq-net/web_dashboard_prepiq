"use client";

type WaterfallStep = {
  label: string;
  value: number;
  cumulative: number;
  modifier?: number;
};

type ForecastDriverWaterfallProps = {
  baselineQty: number;
  finalQty: number;
  steps: WaterfallStep[];
  unit: string;
};

function formatQty(value: number, unit: string) {
  const isDiscrete = ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    unit.toUpperCase(),
  );
  return isDiscrete ? Math.round(value) : value.toFixed(2);
}

export function ForecastDriverWaterfall({
  baselineQty,
  finalQty,
  steps,
  unit,
}: ForecastDriverWaterfallProps) {
  if (!steps.length) {
    return (
      <div className="rounded-lg border border-surface-4 bg-surface-3/35 px-4 py-8 text-center">
        <p className="text-sm text-text-muted">
          No driver breakdown available yet.
        </p>
      </div>
    );
  }

  const maxValue = Math.max(...steps.map((s) => Math.abs(s.cumulative)), 1);

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isBaseline = index === 0;
        const isPositive = (step.value || 0) > 0;
        const isNegative = (step.value || 0) < 0;
        const widthPct = (Math.abs(step.cumulative) / maxValue) * 100;

        return (
          <div key={`${step.label}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-text-primary">
                {step.label}
              </span>
              <div className="flex items-center gap-2">
                {!isBaseline && (
                  <span
                    className={`text-[11px] font-semibold ${
                      isPositive
                        ? "text-status-success"
                        : isNegative
                          ? "text-status-critical"
                          : "text-text-muted"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {formatQty(step.value, unit)} {unit}
                  </span>
                )}
                <span className="text-text-muted">
                  = {formatQty(step.cumulative, unit)} {unit}
                </span>
              </div>
            </div>
            <div className="relative h-7 rounded-lg bg-surface-4 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-lg transition-all ${
                  isBaseline
                    ? "bg-text-muted/40"
                    : isPositive
                      ? "bg-status-success/60"
                      : isNegative
                        ? "bg-status-critical/60"
                        : "bg-surface-4"
                }`}
                style={{ width: `${Math.min(widthPct, 100)}%` }}
              />
              {step.modifier !== undefined && !isBaseline && (
                <div className="absolute inset-0 flex items-center px-2">
                  <span className="text-[10px] font-semibold text-white/90">
                    {isPositive ? "↑" : isNegative ? "↓" : "→"}{" "}
                    {Math.abs((step.modifier || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
