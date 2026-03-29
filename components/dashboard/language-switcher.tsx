"use client";

import { useTranslation } from "@/lib/i18n";
import { Globe } from "iconoir-react";
import { memo } from "react";

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

export const LanguageSwitcher = memo(function LanguageSwitcher({
  collapsed = false,
}: LanguageSwitcherProps) {
  const { language, changeLanguage, t } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = language === "en" ? "fr" : "en";
    changeLanguage(nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      title={collapsed ? (language === "en" ? "Français" : "English") : undefined}
      className={`w-full rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-[#1C1C1F] hover:text-text-primary flex items-center ${
        collapsed ? "justify-center" : "gap-3"
      }`}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#1C1C1F] text-text-muted">
        <Globe className="h-4 w-4 flex-shrink-0" />
      </span>
      {!collapsed && (
        <span className="truncate flex-1 text-left">
          {language === "en" ? "Français" : "English"}
        </span>
      )}
      {!collapsed && (
        <span className="text-[10px] font-bold uppercase text-brand-gold opacity-80">
          {language === "en" ? "FR" : "EN"}
        </span>
      )}
    </button>
  );
});
