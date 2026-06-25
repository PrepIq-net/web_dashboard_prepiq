"use client";

import { useTranslation } from "@/lib/i18n";

export function AuthHeaderBadge({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="hidden md:block">
      <p className="text-sm font-medium text-text-muted">{t(labelKey)}</p>
    </div>
  );
}
