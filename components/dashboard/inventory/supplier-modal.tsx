"use client";

import { useEffect, useId, useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { useCreateIngredientSupplier } from "@/services/inventory/hooks";
import type { Ingredient } from "@/services/inventory/types";

const UNIT_OPTIONS = ["g", "kg", "ml", "L", "piece", "unit", "oz", "lb", "box", "case", "bag"];

type Props = {
  open: boolean;
  onClose: () => void;
  branchId: string;
  ingredients: Ingredient[];
};

type FormState = {
  ingredient: string;
  supplier_name: string;
  pack_size: string;
  pack_unit: string;
  cost_per_pack: string;
  lead_time_days: string;
  is_primary: boolean;
};

const EMPTY_FORM: FormState = {
  ingredient: "",
  supplier_name: "",
  pack_size: "",
  pack_unit: "kg",
  cost_per_pack: "",
  lead_time_days: "1",
  is_primary: true,
};

export function SupplierModal({ open, onClose, branchId, ingredients }: Props) {
  const formId = useId();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateIngredientSupplier(branchId);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.ingredient) { setError("Select an ingredient."); return; }
    const supplierName = form.supplier_name.trim();
    if (!supplierName) { setError("Supplier name is required."); return; }

    try {
      await createMutation.mutateAsync({
        ingredient_id: form.ingredient,
        supplier_name: supplierName,
        pack_size: form.pack_size ? parseFloat(form.pack_size) : null,
        pack_unit: form.pack_unit,
        cost_per_pack: form.cost_per_pack ? parseFloat(form.cost_per_pack) : null,
        lead_time_days: form.lead_time_days ? parseInt(form.lead_time_days, 10) : 1,
        is_primary: form.is_primary,
      });
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
      title="Add Ingredient Supplier"
      description="Configure pack size, cost, and lead time for an ingredient supplier."
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
            disabled={createMutation.isPending}
            className="inline-flex h-10 items-center rounded-lg bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving…" : "Add Supplier"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {/* Ingredient */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Ingredient
          </label>
          <select
            value={form.ingredient}
            onChange={(e) => set("ingredient", e.target.value)}
            className={fieldClass}
          >
            <option value="">— Select ingredient —</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>{ing.name}</option>
            ))}
          </select>
        </div>

        {/* Supplier name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Supplier Name
          </label>
          <input
            type="text"
            value={form.supplier_name}
            onChange={(e) => set("supplier_name", e.target.value)}
            placeholder="e.g. Sysco Metro"
            className={fieldClass}
          />
        </div>

        {/* Pack size + unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Pack Size <span className="font-normal normal-case">(optional)</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.pack_size}
              onChange={(e) => set("pack_size", e.target.value)}
              placeholder="e.g. 5"
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Pack Unit
            </label>
            <select
              value={form.pack_unit}
              onChange={(e) => set("pack_unit", e.target.value)}
              className={fieldClass}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cost + lead time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Cost / Pack ($) <span className="font-normal normal-case">(optional)</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.cost_per_pack}
              onChange={(e) => set("cost_per_pack", e.target.value)}
              placeholder="e.g. 24.50"
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Lead Time (days)
            </label>
            <input
              type="number"
              min={0}
              max={90}
              value={form.lead_time_days}
              onChange={(e) => set("lead_time_days", e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {/* Primary toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
            Primary Supplier
          </label>
          <div className="flex gap-3">
            {[
              { value: true, label: "Yes — use for purchase forecast" },
              { value: false, label: "No — secondary supplier" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => set("is_primary", opt.value)}
                className={`flex-1 h-11 rounded-lg border text-sm font-medium transition-all duration-150 ${
                  form.is_primary === opt.value
                    ? "border-brand-gold/50 bg-brand-gold/10 text-brand-gold"
                    : "border-surface-4 bg-surface-3 text-text-muted hover:text-text-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
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
