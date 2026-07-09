/**
 * ISO 4217 currency reference — mirrors backend `payment/currencies.py`.
 * Keep the two in sync when adding a currency.
 *
 * `decimals` drives correct minor-unit formatting (UGX/RWF/XOF are 0-decimal).
 * Display formatting leans on Intl.NumberFormat; `symbol` is a fallback/hint.
 */

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
};

export const CURRENCIES: Currency[] = [
  // Africa (primary markets)
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", decimals: 0 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", decimals: 2 },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw", decimals: 0 },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu", decimals: 0 },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br", decimals: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimals: 2 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2 },
  { code: "CDF", name: "Congolese Franc", symbol: "FC", decimals: 2 },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA", decimals: 0 },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA", decimals: 0 },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", decimals: 2 },
  { code: "MAD", name: "Moroccan Dirham", symbol: "DH", decimals: 2 },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK", decimals: 2 },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK", decimals: 2 },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT", decimals: 2 },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", decimals: 2 },
  { code: "SSP", name: "South Sudanese Pound", symbol: "£", decimals: 2 },
  { code: "SDG", name: "Sudanese Pound", symbol: "£", decimals: 2 },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh", decimals: 2 },
  // Majors / global
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", decimals: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", decimals: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
];

export const COMMON_CODES = [
  "USD", "UGX", "KES", "TZS", "NGN", "GHS", "ZAR", "CDF", "EUR", "GBP",
];

const BY_CODE: Record<string, Currency> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

export function getCurrency(code: string | null | undefined): Currency {
  return BY_CODE[(code ?? "").toUpperCase()] ?? BY_CODE.USD;
}

/**
 * Convert a USD amount into `code` using a rates map ({ USD-per-unit } as
 * strings, from the fx-rates endpoint). Rounds to the currency's minor unit.
 * Falls back to the USD amount when the rate is unavailable.
 */
export function convertFromUsd(
  amountUsd: number,
  code: string | null | undefined,
  rates: Record<string, string> | undefined,
): number {
  const currency = getCurrency(code);
  if (currency.code === "USD") return amountUsd;
  const rate = rates?.[currency.code];
  if (!rate) return amountUsd;
  const value = amountUsd * Number(rate);
  if (!Number.isFinite(value)) return amountUsd;
  const factor = 10 ** currency.decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Format a numeric amount in the given currency. Uses Intl for symbol +
 * grouping + correct minor-unit digits; falls back gracefully for codes Intl
 * doesn't know.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  code: string | null | undefined,
  opts: { compact?: boolean } = {},
): string {
  const value = typeof amount === "string" ? Number(amount) : amount ?? 0;
  const safe = Number.isFinite(value) ? (value as number) : 0;
  const currency = getCurrency(code);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.code,
      maximumFractionDigits: currency.decimals,
      minimumFractionDigits: opts.compact ? 0 : undefined,
      notation: opts.compact ? "compact" : "standard",
    }).format(safe);
  } catch {
    // Intl doesn't recognise the code — fall back to symbol + grouped number.
    const n = safe.toLocaleString(undefined, {
      maximumFractionDigits: currency.decimals,
    });
    return `${currency.symbol} ${n}`;
  }
}
