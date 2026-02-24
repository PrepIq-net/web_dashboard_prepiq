"use client";

interface ProgressItem {
  label: string;
  value: number;
  color: "gold" | "success" | "warning" | "critical" | "info";
}

interface ProgressChartProps {
  items: ProgressItem[];
  title?: string;
}

const colorMap = {
  gold: "bg-brand-gold",
  success: "bg-status-success",
  warning: "bg-status-warning",
  critical: "bg-status-critical",
  info: "bg-status-info",
};

export function ProgressChart({ items, title }: ProgressChartProps) {
  return (
    <div className="rounded-card bg-surface-2 border border-border-default p-6 shadow-[var(--shadow-level-1)]">
      {title && (
        <h3 className="font-display text-lg font-semibold text-text-primary">
          {title}
        </h3>
      )}

      <div className={`mt-${title ? "6" : "0"} flex flex-col gap-6`}>
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-secondary">
                {item.label}
              </p>
              <p className="text-sm font-semibold text-text-primary">
                {item.value}%
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full transition-all duration-300 ${
                  colorMap[item.color]
                }`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
