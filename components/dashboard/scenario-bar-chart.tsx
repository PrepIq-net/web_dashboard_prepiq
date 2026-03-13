"use client";

type ScenarioPoint = {
  name?: string | null;
  scenario?: string | null;
  forecast?: number | null;
  change_pct?: number | null;
  description?: string | null;
};

type ScenarioRow = {
  label: string;
  value: number;
  changePct?: number;
  description?: string | null;
  isBase?: boolean;
};

type ScenarioBarChartProps = {
  baseValue?: number | null;
  scenarios?: ScenarioPoint[];
  unitLabel?: string;
  title?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function resolveLabel(scenario: ScenarioPoint) {
  return scenario.name || scenario.scenario || "Scenario";
}

function resolveScenarioValue(
  baseValue: number,
  scenario: ScenarioPoint,
): number | null {
  if (scenario.forecast != null) return Number(scenario.forecast);
  if (scenario.change_pct != null) {
    return baseValue * (1 + Number(scenario.change_pct) / 100);
  }
  return null;
}

export function ScenarioBarChart({
  baseValue,
  scenarios = [],
  unitLabel = "PCS",
  title = "Scenario Forecasts",
}: ScenarioBarChartProps) {
  if (baseValue == null) {
    return (
      <div className="rounded-xl border border-surface-4 bg-surface-3/30 px-4 py-4 text-xs text-text-muted">
        Scenario forecasts will appear once the model returns a base forecast.
      </div>
    );
  }

  const rows: ScenarioRow[] = [
    {
      label: "Base forecast",
      value: Number(baseValue),
      isBase: true,
    },
  ];

  scenarios.forEach((scenario) => {
    const value = resolveScenarioValue(Number(baseValue), scenario);
    if (value == null) return;
    rows.push({
      label: resolveLabel(scenario),
      value,
      changePct:
        scenario.change_pct != null ? Number(scenario.change_pct) : undefined,
      description: scenario.description ?? scenario.scenario ?? null,
    });
  });

  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="rounded-xl border border-surface-4 bg-surface-3/30 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const pct = Math.max(6, (row.value / maxValue) * 100);
          return (
            <div key={`${row.label}-${row.value}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <p className="font-semibold text-text-primary">{row.label}</p>
                <p className="text-text-secondary">
                  {formatNumber(row.value)} {unitLabel}
                  {row.changePct != null ? ` · ${row.changePct.toFixed(1)}%` : ""}
                </p>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${
                    row.isBase ? "bg-brand-gold" : "bg-status-info"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {row.description ? (
                <p className="text-[11px] text-text-muted">{row.description}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
