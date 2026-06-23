"use client";

import { useLanguage } from "./language-context";
import en from "./en.json";
import fr from "./fr.json";

type Translations = typeof en;
const translations: Record<string, Translations> = { en, fr };

export function useTranslation() {
  const { language } = useLanguage();

  const messages = translations[language] ?? translations.en;

  function t(key: string, variables?: Record<string, string | number>): string {
    const keys = key.split(".");
    let value: unknown = messages;

    for (const k of keys) {
      if (value && typeof value === "object" && k in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fall back to English before giving up
        let fallback: unknown = translations.en;
        for (const fk of keys) {
          if (fallback && typeof fallback === "object" && fk in (fallback as Record<string, unknown>)) {
            fallback = (fallback as Record<string, unknown>)[fk];
          } else {
            return key;
          }
        }
        value = fallback;
        break;
      }
    }

    if (typeof value !== "string") return key;

    if (variables) {
      return Object.entries(variables).reduce((acc, [k, v]) => {
        const val = String(v);
        return acc.replace(`{{${k}}}`, val).replace(`{${k}}`, val);
      }, value);
    }

    return value;
  }

  return { t, language };
}

export { useLanguage } from "./language-context";
export type { Language } from "./language-context";
