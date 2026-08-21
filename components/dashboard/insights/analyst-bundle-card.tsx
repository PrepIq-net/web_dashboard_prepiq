"use client";

import { useTranslation } from "@/lib/i18n";
import type { PendingBundleItem } from "@/services/insights/types";

/**
 * The Analyst's "do the work" moment — task.md's Review & approve. Extends
 * `components/assistant/pending-action-confirm.tsx`'s single-action card to
 * a list: every write the Analyst prepared this turn, reviewed and applied
 * together, never silently applied on its own (see
 * `ai_assistant.engine.run_tool_loop`'s `bundle_mode`).
 */
export function AnalystBundleCard({
  items,
  busy,
  onApproveAll,
  onDeclineAll,
}: {
  items: PendingBundleItem[];
  busy?: boolean;
  onApproveAll: () => void;
  onDeclineAll: () => void;
}) {
  const { t } = useTranslation();
  const hasDestructive = items.some((item) => item.destructive);

  return (
    <div
      className={`max-w-[92%] rounded-xl border p-3 ${
        hasDestructive ? "border-status-critical/40 bg-status-critical/5" : "border-brand-gold/40 bg-surface-3"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          hasDestructive ? "text-status-critical" : "text-brand-gold"
        }`}
      >
        {t("workspace.insights.analysis.bundleTitle", { count: String(items.length) })}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.action_log_id} className="text-sm text-text-primary">
            <span className="text-text-primary">{item.summary}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onApproveAll}
          disabled={busy}
          className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
        >
          {busy ? t("workspace.insights.analysis.bundleApplying") : t("workspace.insights.analysis.bundleApproveAll")}
        </button>
        <button
          type="button"
          onClick={onDeclineAll}
          disabled={busy}
          className="rounded-lg border border-surface-4 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {t("workspace.insights.analysis.bundleDeclineAll")}
        </button>
      </div>
    </div>
  );
}
