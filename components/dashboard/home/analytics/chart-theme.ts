/**
 * Chart color + mark constants, derived from BRAND_SYSTEM.md tokens.
 *
 * Palette validated (dataviz six-checks, dark surface #141416):
 * actual=#A8821F vs forecast=#C7C7CC — CVD ΔE 23.2, normal-vision ΔE 24.0,
 * both ≥3:1 contrast. The forecast gray intentionally carries no chroma
 * (brand: "Baseline: gray"), so series identity never rides on hue alone —
 * the dash pattern, legend, and tooltips carry it.
 *
 * Status colors are reserved (never used as series identity) and always
 * paired with an icon + label.
 */

export const CHART = {
  // Series
  actual: "#A8821F", // brand gold — primary metric
  forecast: "#C7C7CC", // baseline gray — always dashed
  // Chrome
  grid: "#2A2A2E", // hairline, solid, recessive
  axisText: "#8E8E93",
  surface: "#141416",
  tooltipBg: "#232327",
  tooltipBorder: "#2A2A2E",
  // Reserved status colors (icon + label always accompany)
  critical: "#C44949",
  warning: "#C48B2A",
  success: "#3F8F68",
  neutralCell: "#232327",
  // Marks
  lineWidth: 2,
  areaOpacity: 0.1,
  barRadius: 4,
  barMaxWidth: 24,
} as const;

/** Compact axis ticks: 1284 → "1.3K", 4200000 → "4.2M". */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value * 10) / 10}`;
}
