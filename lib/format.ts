/**
 * Shared formatting helpers for workspace pages.
 *
 * These were previously re-declared per page (today, planning, production,
 * dashboard home) with slightly diverging behavior. All quantity/currency/
 * percent rendering should go through here so the whole workspace reads the
 * same way.
 */

import { format } from "date-fns";
import { getCurrency } from "@/lib/currencies";

// Currency is branch-scoped; every money value must be rendered in the
// currency it was measured in (or the summary currency an aggregate endpoint
// reports), never a hardcoded one.
const moneyFormatters = new Map<string, Intl.NumberFormat | null>();

function moneyFormatter(code: string): Intl.NumberFormat | null {
  if (!moneyFormatters.has(code)) {
    let formatter: Intl.NumberFormat | null = null;
    try {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 0,
      });
    } catch {
      formatter = null; // Intl doesn't know the code — fall back to symbol.
    }
    moneyFormatters.set(code, formatter);
  }
  return moneyFormatters.get(code) ?? null;
}

/**
 * Today's date in the viewer's timezone, as the backend keys days.
 *
 * `new Date().toISOString().slice(0, 10)` gives the *UTC* date, so a branch
 * behind UTC asks for tomorrow's day all evening while the server resolves
 * `timezone.localdate()`. Always go through here.
 */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** A Date as a `YYYY-MM-DD` day key, in local time. See `todayIso`. */
export function toDayIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatMoney(value: number, currency: string = "USD"): string {
  const code = getCurrency(currency).code;
  const formatter = moneyFormatter(code);
  if (formatter) return formatter.format(value);
  const symbol = getCurrency(code).symbol;
  return `${symbol} ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatSignedMoney(value: number, currency: string = "USD"): string {
  const base = formatMoney(Math.abs(value), currency);
  return value >= 0 ? `+${base}` : `-${base}`;
}

/**
 * "USh 1,200,000 · ₦50,000 · $350" — per-currency subtotals for org-level
 * aggregates that span branches operating in different currencies.
 */
export function formatCurrencyBreakdown(
  entries: Array<{ currency: string; amount: number }>,
): string {
  return entries
    .map((entry) => formatMoney(entry.amount, entry.currency))
    .join(" · ");
}

/** Units that only make sense as whole numbers. */
export function isDiscreteUnit(unit: string): boolean {
  return ["PCS", "PLATES", "BOXES", "TRAYS", "SERVINGS"].includes(
    (unit || "").toUpperCase(),
  );
}

export function formatQuantity(value: number, unit: string): string {
  if (isDiscreteUnit(unit)) {
    return `${Math.round(value)} ${unit}`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

export function signedQuantity(value: number, unit: string): string {
  const prefix = value > 0 ? "+" : "";
  if (isDiscreteUnit(unit)) {
    return `${prefix}${Math.round(value)} ${unit}`;
  }
  return `${prefix}${value.toFixed(2)} ${unit}`;
}

/** Signed percent from a percentage value: 12.34 → "+12.3%". */
export function toPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Unsigned percent from a 0..1 ratio: 0.45 → "45%". */
export function percent01(value: number): string {
  const normalized = Math.max(0, Math.min(1, value));
  return `${(normalized * 100).toFixed(0)}%`;
}

/** Signed percent from a fraction impact: 0.12 → "+12%". */
export function formatImpact(impact: number | null | undefined): string {
  if (impact == null) return "";
  const sign = impact >= 0 ? "+" : "";
  return `${sign}${(impact * 100).toFixed(0)}%`;
}

/** Tone class for a demand-impact fraction (±0.1 thresholds). */
export function impactTone(impact: number): string {
  if (impact <= -0.1) return "text-status-critical";
  if (impact >= 0.1) return "text-status-success";
  return "text-text-muted";
}
