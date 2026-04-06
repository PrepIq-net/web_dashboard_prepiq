"use client";

import { useEffect, useState } from "react";
import en from "./en.json";
import fr from "./fr.json";

type Translations = typeof en;
const translations: Record<string, Translations> = { en, fr };

export function useTranslation() {
  const [lang, setLang] = useState<string>("en");

  useEffect(() => {
    const htmlLang = document.documentElement.lang;
    if (htmlLang && translations[htmlLang]) {
      setLang(htmlLang);
    }
  }, []);

  const t = (key: string, variables?: Record<string, string | number>) => {
    const keys = key.split(".");
    let value: any = translations[lang] || translations.en;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // Return the key if not found
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    if (variables) {
      return Object.entries(variables).reduce((acc, [k, v]) => {
        const val = typeof v === "number" ? String(v) : v;
        return acc.replace(`{{${k}}}`, val).replace(`{${k}}`, val);
      }, value);
    }

    return value;
  };

  return { t, lang };
}
