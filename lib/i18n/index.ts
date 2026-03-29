"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import en from "./en.json";
import fr from "./fr.json";

const translations: Record<string, any> = { en, fr };

export type Language = "en" | "fr";

interface TranslationContextType {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: Language;
  changeLanguage: (newLang: Language) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

function getNestedValue(obj: any, path: string): string {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return path; // Return the path if the key is missing
    }
  }

  return typeof current === "string" ? current : path;
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;

  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`{${key}}`, "g"), String(value));
  }, text);
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    // 1. Check if language is stored in a cookie (shared with backend)
    const match = document.cookie.match(/(^|;)\s*PREPIQ_LANGUAGE\s*=\s*([^;]+)/);
    const cookieLang = match ? (match[2] as Language) : null;

    if (cookieLang && (cookieLang === "en" || cookieLang === "fr")) {
      setLanguage(cookieLang);
      document.documentElement.lang = cookieLang;
    } else {
      // 2. Fallback to HTML lang attribute (resolved by RootLayout from Accept-Language)
      const htmlLang = document.documentElement.lang as Language;
      if (htmlLang === "en" || htmlLang === "fr") {
        setLanguage(htmlLang);
      }
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const translationSet = translations[language] || translations.en;
      const text = getNestedValue(translationSet, key);
      return interpolate(text, params);
    },
    [language],
  );

  const changeLanguage = useCallback((newLang: Language) => {
    setLanguage(newLang);
    document.documentElement.lang = newLang;
    // Set cookie for backend and persistence
    document.cookie = `PREPIQ_LANGUAGE=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  const value = useMemo(() => ({
    t,
    language,
    changeLanguage,
  }), [t, language, changeLanguage]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
}
