"use client";

import { useEffect, useId, useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { useCreateIngredient, useUpdateIngredient } from "@/services/inventory/hooks";
import type { Ingredient } from "@/services/inventory/types";

const UNIT_OPTIONS = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "ml", label: "Millilitres (ml)" },
  { value: "L", label: "Litres (L)" },
  { value: "piece", label: "Piece" },
  { value: "unit", label: "Unit" },
  { value: "tsp", label: "Teaspoon (tsp)" },
  { value: "tbsp", label: "Tablespoon (tbsp)" },
  { value: "cup", label: "Cup" },
  { value: "oz", label: "Ounce (oz)" },
  { value: "lb", label: "Pound (lb)" },
];

const CATEGORY_OPTIONS = [
  { value: "protein", label: "Protein" },
  { value: "vegetable", label: "Vegetable" },
  { value: "fruit", label: "Fruit" },
  { value: "dairy", label: "Dairy" },
  { value: "dry_goods", label: "Dry Goods" },
  { value: "spice", label: "Spice" },
  { value: "sauce", label: "Sauce" },
  { value: "oil", label: "Oil" },
  { value: "beverage", label: "Beverage" },
  { value: "bakery", label: "Bakery" },
  { value: "seafood", label: "Seafood" },
  { value: "other", label: "Other" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  ingredient?: Ingredient | null; // null = create mode, Ingredient = edit mode
};

type FormState = {
  name: string;
  category: string;
  unit: string;
  shelf_life_days: string;
  is_perishable: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "other",
  unit: "kg",
  shelf_life_days: "",
  is_perishable: true,
};

function ingredientToForm(ingredient: Ingredient): FormState {
  return {
    name: ingredient.name,
    category: ingredient.category || "other",
    unit: ingredient.unit,
    shelf_life_days: ingredient.shelf_life_days?.toString() ?? "",
    is_perishable: ingredient.is_perishable,
  };
}

export function IngredientModal({ open, onClose, organizationId, ingredient }: Props) {
  const isEdit = Boolean(ingredient);
  const formId = useId();

  const [form, setForm] = useState<FormState>(
    ingredient ? ingredientToForm(ingredient) : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateIngredient(organizationId);
  const updateMutation = useUpdateIngredient(organizationId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Sync form when ingredient prop changes (switching between edit targets)
  useEffect(() => {
    if (open) {
      setForm(ingredient ? ingredientToForm(ingredient) : EMPTY_FORM);
      setError(null);
    }
  }, [open, ingredient]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) { setError("Ingredient name is required."); return; }
    if (!form.unit) { setError("Unit is required."); return; }

    const payload = {
      name,
      category: form.category,
      unit: form.unit,
      shelf_life_days: form.shelf_life_days ? parseInt(form.shelf_life_days, 10) : null,
      is_perishable: form.is_perishable,
    };

    try {
      if (isEdit && ingredient) {
        await updateMutation.mutateAsync({ id: ingredient.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Ingredient" : "Add Ingredient"}
      description={
        isEdit
          ? "Update this ingredient's details. Changes apply across all branches."
          : "Add a new ingredient to your org-wide catalog. It will be available to all branches."
      }
      maxWidthClassName="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-lg border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isPending}
            className="inline-flex h-10 items-center rounded-lg bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Ingredient"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Chicken Breast"
            autoFocus
            className="w-full h-11 rounded-lg border border-surface-4 bg-surface-3 px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors"
          />
        </div>

        {/* Category + Unit — side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full h-11 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Unit
            </label>
            <select
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              className="w-full h-11 rounded-lg border border-surface-4 bg-surface-3 px-3 text-sm text-text-primary focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors"
            >
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Shelf life */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Shelf Life <span className="normal-case font-normal text-text-muted">(days, optional)</span>
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            value={form.shelf_life_days}
            onChange={(e) => set("shelf_life_days", e.target.value)}
            placeholder="e.g. 5"
            className="w-full h-11 rounded-lg border border-surface-4 bg-surface-3 px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors"
          />
          <p className="mt-1.5 text-xs text-text-muted">
            Used for waste-risk modelling. Leave blank if not applicable.
          </p>
        </div>

        {/* Perishable toggle */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">
            Perishable
          </label>
          <div className="flex gap-3">
            {[
              { value: true, label: "Yes — needs daily tracking" },
              { value: false, label: "No — stable shelf item" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => set("is_perishable", opt.value)}
                className={`flex-1 h-11 rounded-lg border text-sm font-medium transition-all duration-150 ${
                  form.is_perishable === opt.value
                    ? opt.value
                      ? "border-status-warning/50 bg-status-warning/10 text-status-warning"
                      : "border-status-success/50 bg-status-success/10 text-status-success"
                    : "border-surface-4 bg-surface-3 text-text-muted hover:text-text-secondary hover:border-surface-4"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-lg border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
            {error}
          </p>
        )}
      </form>
    </ModalShell>
  );
}
