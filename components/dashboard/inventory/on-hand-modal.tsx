"use client";

import { useEffect, useId, useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { useLogOnHand } from "@/services/inventory/hooks";
import type { Ingredient } from "@/services/inventory/types";

type Props = {
  open: boolean;
  onClose: () => void;
  branchId: string;
  ingredients: Ingredient[];
  prefilledIngredientId?: string;
};

type FormState = {
  ingredient: string;
  quantity: string;
  unit: string;
  as_of_date: string;
  notes: string;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function OnHandModal({ open, onClose, branchId, ingredients, prefilledIngredientId }: Props) {
  const formId = useId();
  const [form, setForm] = useState<FormState>({
    ingredient: prefilledIngredientId ?? "",
    quantity: "",
    unit: "",
    as_of_date: todayStr(),
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const logMutation = useLogOnHand(branchId);

  useEffect(() => {
    if (open) {
      const ing = ingredients.find((i) => i.id === prefilledIngredientId);
      setForm({
        ingredient: prefilledIngredientId ?? "",
        quantity: "",
        unit: ing?.unit ?? "",
        as_of_date: todayStr(),
        notes: "",
      });
      setError(null);
    }
  }, [open, prefilledIngredientId, ingredients]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleIngredientChange(id: string) {
    const ing = ingredients.find((i) => i.id === id);
    setForm((prev) => ({ ...prev, ingredient: id, unit: ing?.unit ?? prev.unit }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.ingredient) { setError("Select an ingredient."); return; }
    const qty = parseFloat(form.quantity);
    if (!form.quantity || isNaN(qty) || qty < 0) { setError("Enter a valid quantity (≥ 0)."); return; }
    if (!form.unit.trim()) { setError("Unit is required."); return; }
    if (!form.as_of_date) { setError("Date is required."); return; }

    try {
      await logMutation.mutateAsync({
        ingredient_id: form.ingredient,
        quantity: qty,
        unit: form.unit.trim(),
        as_of_date: form.as_of_date,
        notes: form.notes.trim(),
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
      title="Log On-Hand Stock"
      description="Record the current stock level for an ingredient. Used by the purchase forecast to calculate net need."
      maxWidthClassName="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={logMutation.isPending}
            className="inline-flex h-10 items-center rounded-lg border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={logMutation.isPending}
            className="inline-flex h-10 items-center rounded-lg bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {logMutation.isPending ? "Saving…" : "Log Stock"}
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
            onChange={(e) => handleIngredientChange(e.target.value)}
            className={fieldClass}
          >
            <option value="">— Select ingredient —</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>{ing.name}</option>
            ))}
          </select>
        </div>

        {/* Quantity + unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Quantity On Hand
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              placeholder="e.g. 12.5"
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Unit
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="kg"
              className={fieldClass}
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            As of Date
          </label>
          <input
            type="date"
            value={form.as_of_date}
            onChange={(e) => set("as_of_date", e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Notes <span className="font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            placeholder="e.g. Counted after delivery"
            className="w-full rounded-lg border border-surface-4 bg-surface-3 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors resize-none"
          />
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
