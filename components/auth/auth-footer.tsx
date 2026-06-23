"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function AuthFooter() {
  const { t } = useTranslation();
  return (
    <footer className="relative z-10 mt-20 pt-8 border-t border-border-default/50 flex justify-between items-center">
      <p className="text-xs text-text-muted">
        {t("auth.infrastructure")} &copy; 2026.
      </p>
      <div className="flex gap-6">
        <Link href="/terms" className="text-xs text-text-muted hover:text-text-primary">
          {t("auth.terms")}
        </Link>
        <Link href="/privacy" className="text-xs text-text-muted hover:text-text-primary">
          {t("auth.privacy")}
        </Link>
      </div>
    </footer>
  );
}
