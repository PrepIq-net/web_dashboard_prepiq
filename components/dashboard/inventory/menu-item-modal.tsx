"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { ModalShell } from "@/components/ui/modal-shell";
import { useCreateMenuItem, useUpdateMenuItem } from "@/services/inventory/hooks";
import type { MenuItem } from "@/services/inventory/types";

const CATEGORY_OPTIONS = [
  "Pastries", "Beverages", "Mains", "Sides",
  "Retail", "Breakfast", "Desserts", "Uncategorized",
];

type Props = {
  open: boolean;
  onClose: () => void;
  branchId: string;
  menuItem?: MenuItem | null;
};

type FormState = {
  name: string;
  category: string;
  image: File | null;
  image_preview: string | null;
  instructions: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "Uncategorized",
  image: null,
  image_preview: null,
  instructions: "",
  is_active: true,
};

function toForm(item: MenuItem): FormState {
  return {
    name: item.name,
    category: item.category || "Uncategorized",
    image: null,
    image_preview: item.image || null,
    instructions: item.instructions || "",
    is_active: item.is_active,
  };
}

export function MenuItemModal({ open, onClose, branchId, menuItem }: Props) {
  const isEdit = Boolean(menuItem);
  const formId = useId();

  const [form, setForm] = useState<FormState>(menuItem ? toForm(menuItem) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateMenuItem(branchId);
  const updateMutation = useUpdateMenuItem(branchId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      setForm(menuItem ? toForm(menuItem) : EMPTY_FORM);
      setError(null);
    }
  }, [open, menuItem]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      set("image", file);
      set("image_preview", URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    if (!name) { setError("Name is required."); return; }

    const payload = {
      name,
      category: form.category,
      image: form.image,
      instructions: form.instructions.trim() || undefined,
      is_active: form.is_active,
    };

    try {
      if (isEdit && menuItem) {
        await updateMutation.mutateAsync({ id: menuItem.id, data: payload });
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
      title={isEdit ? "Edit Menu Item" : "Add Menu Item"}
      description={
        isEdit
          ? "Update this menu item. Upload a new image to replace the current one."
          : "Add a new menu item to this branch."
      }
      maxWidthClassName="max-w-lg"
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
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
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
            placeholder="e.g. Grilled Chicken Bowl"
            autoFocus
            className="w-full h-11 rounded-lg border border-surface-4 bg-surface-3 px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors"
          />
        </div>

        {/* Category + Status */}
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
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
              Status
            </label>
            <div className="flex gap-2 h-11">
              {[
                { value: true, label: "Active" },
                { value: false, label: "Inactive" },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => set("is_active", opt.value)}
                  className={`flex-1 rounded-lg border text-sm font-medium transition-all duration-150 ${
                    form.is_active === opt.value
                      ? opt.value
                        ? "border-status-success/50 bg-status-success/10 text-status-success"
                        : "border-surface-4 bg-surface-3 text-text-muted"
                      : "border-surface-4 bg-surface-3 text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Image
          </label>
          <div className="flex flex-col gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-surface-4 bg-surface-3 px-4 text-sm text-text-secondary transition-colors hover:border-brand-gold/60 hover:text-brand-gold"
            >
              {form.image ? "Change Image" : "Upload Image"}
            </label>

            {form.image_preview && (
              <div className="relative h-28 w-full overflow-hidden rounded-lg border border-surface-4 bg-surface-3">
                <img
                  src={form.image_preview}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted mb-2">
            Instructions <span className="normal-case font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            value={form.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="Basic prep notes..."
            rows={3}
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
