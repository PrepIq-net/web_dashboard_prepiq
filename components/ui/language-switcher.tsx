"use client";

import { useLanguage, type Language } from "@/lib/i18n/language-context";

const LABELS: Record<Language, string> = { en: "EN", fr: "FR" };
const LANGUAGES: Language[] = ["en", "fr"];

interface LanguageSwitcherProps {
  /** "compact" — pill pair (default). "select" — native <select>. */
  variant?: "compact" | "select";
  className?: string;
  /** Optional extra handler called after the language state is updated. */
  onChange?: (lang: Language) => void;
}

export function LanguageSwitcher({
  variant = "compact",
  className = "",
  onChange,
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  function handleChange(lang: Language) {
    setLanguage(lang);
    onChange?.(lang);
  }

  if (variant === "select") {
    return (
      <select
        value={language}
        onChange={(e) => handleChange(e.target.value as Language)}
        className={`rounded-lg border border-[#2A2A2E] bg-[#1C1C1F] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-gold/50 transition-colors ${className}`}
        aria-label="Select language"
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className={`inline-flex items-center rounded-lg border border-[#2A2A2E] bg-[#0E0E10] p-0.5 ${className}`}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => handleChange(lang)}
          aria-pressed={language === lang}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-150 ${
            language === lang
              ? "bg-brand-gold text-[#141416] shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
