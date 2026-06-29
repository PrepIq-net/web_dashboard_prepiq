"use client";

import { useEffect, useId, useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { useCreateAvailabilityOverride } from "@/services/inventory/hooks";

type Props = {
  open: boolean;
  onClose: () => void;
  branchId: string;
  item: { id: string; title: string } | null;
  onSuccess?: () => void;
};

type FormState = {
  reason: string;
  suppressed_demand: boolean;
  start_date: string;
  end_date: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function MarkUnavailableModal({ open, onClose, branchId, item, onSuccess }: Props) {
  const formId = useId();
  const [form, setForm] = useState<FormState>({
    reason: "",
    suppressed_demand: false,
    start_date: todayStr(),
    end_date: "",
  });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateAvailabilityOverride(branchId);

  useEffect(() => {
    if (open) {
      setForm({ reason: "", suppressed_demand: false, start_date: todayStr(), end_date: "" });
      setError(null);
    }
  }, [open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!item) return;

    if (!form.start_date) { setError("Start date is required."); return; }
    if (form.end_date && form.end_date < form.start_date) {
      setError("End date must be on or after the start date.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        item: item.id,
        start_date: form.start_date,
        end_date: form.end_date || null,
        reason: form.reason.trim(),
        suppressed_demand: form.suppressed_demand,
      });
      onSuccess?.();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  const fieldClass =
    "w-full h-11 rounded-lg border border-surface-4 bg-surface-3 px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Mark Item Unavailable"
      description={item ? `Configure an availability override for ${item.title}.` : ""}
      maxWidthClassName="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="inline-flex h-10 items-center rounded-lg border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={createMutation.isPending || !item}
            className="inline-flex h-10 items-center rounded-lg bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving…" : "Mark Unavailable"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        {/* Item name (read-only) */}
        {item && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Item
            </label>
            <div className="flex h-11 items-center rounded-lg border border-surface-4 bg-surface-3/50 px-4 text-sm font-semibold text-text-primary">
              {item.title}
            </div>
          </div>
        )}

        {/* Unavailability type */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
            Why is it unavailable?
          </label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => set("suppressed_demand", false)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-all duration-150 ${
                !form.suppressed_demand
                  ? "border-status-warning/50 bg-status-warning/10"
                  : "border-surface-4 bg-surface-3 hover:border-surface-4"
              }`}
            >
              <p className={`text-sm font-semibold ${!form.suppressed_demand ? "text-status-warning" : "text-text-secondary"}`}>
                Supply Constraint
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                We can't get stock, but customers still want it. Demand signal is preserved; prep qty is set to 0.
              </p>
            </button>
            <button
              type="button"
              onClick={() => set("suppressed_demand", true)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-all duration-150 ${
                form.suppressed_demand
                  ? "border-brand-gold/50 bg-brand-gold/10"
                  : "border-surface-4 bg-surface-3 hover:border-surface-4"
              }`}
            >
              <p className={`text-sm font-semibold ${form.suppressed_demand ? "text-brand-gold" : "text-text-secondary"}`}>
                Genuine Removal
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Item is off the menu entirely. Excluded from the prep plan and demand learning.
              </p>
            </button>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Reason <span className="font-normal normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={form.reason}
            onChange={(e) => set("reason", e.target.value)}
            placeholder="e.g. Out of stock — supplier delayed"
            className={fieldClass}
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              From
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Until <span className="font-normal normal-case">(leave blank = open-ended)</span>
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </p>
        )}
      </form>
    </ModalShell>
  );
}
