"use client";

import type { PendingAction } from "@/services/assistant/types";

export function PendingActionConfirm({
  action,
  busy,
  onConfirm,
  onDismiss,
}: {
  action: PendingAction;
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="ml-1 max-w-[85%] rounded-xl border border-brand-gold/40 bg-surface-3 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">
        Proposed action
      </p>
      <p className="mt-1 text-sm text-text-primary">{action.summary}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover disabled:opacity-50"
        >
          {busy ? "Applying…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="rounded-lg border border-surface-4 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
