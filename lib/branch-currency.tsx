"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { formatMoney, formatSignedMoney } from "@/lib/format";

/**
 * The currency the surrounding screen's money is denominated in.
 *
 * `formatMoney` takes a currency argument and defaults to USD when it is
 * omitted. That default is the problem: currency is branch-scoped here, so a
 * screen that forgets to pass it does not fail loudly — it silently prints UGX
 * amounts with a dollar sign. Threading the code through every call site by
 * hand is what let the drift happen in the first place, so screens declare it
 * once at the top and formatters read it from context, the same way copy reads
 * from `useTranslation`.
 *
 * USD remains the fallback only for the case where the backend genuinely has
 * not told us the branch currency yet.
 */
const BranchCurrencyContext = createContext<string>("USD");

export function BranchCurrencyProvider({
  currency,
  children,
}: {
  currency: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <BranchCurrencyContext.Provider value={currency || "USD"}>
      {children}
    </BranchCurrencyContext.Provider>
  );
}

/**
 * Money formatters already bound to the current branch's currency.
 *
 * `currency` is exposed for the helper functions in `today-helpers` and
 * friends, which are plain functions and take the code as an argument the same
 * way they take the translator.
 */
export function useMoney() {
  const currency = useContext(BranchCurrencyContext);
  return useMemo(
    () => ({
      currency,
      money: (value: number) => formatMoney(value, currency),
      signedMoney: (value: number) => formatSignedMoney(value, currency),
    }),
    [currency],
  );
}
