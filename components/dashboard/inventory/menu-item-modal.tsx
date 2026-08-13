"use client";

import { useEffect, useId, useState, useCallback } from "react";
import Cropper, { type Point, type Area } from "react-easy-crop";
import { MediaImage, NavArrowDown, NavArrowUp } from "iconoir-react";
import { ModalShell } from "@/components/ui/modal-shell";
import { getCroppedImg } from "@/lib/utils/image";
import {
  useCreateMenuItem,
  useUpdateMenuItem,
  useMenuItemPrice,
  useUpdateMenuItemPrice,
} from "@/services/inventory/hooks";
import type { MenuItem } from "@/services/inventory/types";
import { formatMoney } from "@/lib/format";

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

function formatChangedAt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

// Selling price, cost, margin, currency, last change, and full history for
// one menu item at this branch. A deliberately separate save action from
// the rest of the form, mirroring the backend: PATCHing name/category/image
// and PATCHing price are two different endpoints, because a price change is
// an event to record, not a field alongside the others to overwrite.
function MenuItemPricingSection({ branchId, menuItemId }: { branchId: string; menuItemId: string }) {
  const { data, isLoading } = useMenuItemPrice(branchId, menuItemId);
  const updatePrice = useUpdateMenuItemPrice(branchId, menuItemId);

  const [priceInput, setPriceInput] = useState("");
  const [reason, setReason] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (data?.selling_price != null) setPriceInput(String(data.selling_price));
  }, [data?.selling_price]);

  async function handleSavePrice() {
    setPriceError(null);
    const value = Number(priceInput);
    if (!priceInput.trim() || Number.isNaN(value) || value < 0) {
      setPriceError("Enter a valid price.");
      return;
    }
    try {
      await updatePrice.mutateAsync({ new_price: value, reason: reason.trim() || undefined });
      setReason("");
    } catch {
      setPriceError("Couldn't save the price. Please try again.");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-surface-4 bg-surface-3 px-4 py-3 text-sm text-text-muted">
        Loading pricing…
      </div>
    );
  }

  const currency = data?.currency || "";

  return (
    <div className="space-y-3 rounded-lg border border-surface-4 bg-surface-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Pricing
        </span>
        {data?.last_changed_at && (
          <span className="text-[11px] text-text-muted">
            Last changed {formatChangedAt(data.last_changed_at)}
          </span>
        )}
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-text-muted mb-1">
            Selling price {currency ? `(${currency})` : ""}
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="0.00"
            className="w-full h-10 rounded-lg border border-surface-4 bg-surface-2 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handleSavePrice}
          disabled={updatePrice.isPending}
          className="inline-flex h-10 shrink-0 items-center rounded-lg border border-brand-gold/50 bg-brand-gold/10 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20 disabled:opacity-50"
        >
          {updatePrice.isPending ? "Saving…" : "Update Price"}
        </button>
      </div>

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why this change? (optional)"
        className="w-full h-9 rounded-lg border border-surface-4 bg-surface-2 px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-gold/60 focus:outline-none focus:ring-1 focus:ring-brand-gold/30 transition-colors"
      />

      {priceError && <p className="text-xs text-status-critical">{priceError}</p>}

      {data?.has_catalog_link && (data.standard_cost != null || data.margin_pct != null) && (
        <div className="grid grid-cols-3 gap-3 border-t border-surface-4/60 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Cost</p>
            <p className="text-sm font-semibold text-text-primary">
              {data.standard_cost != null ? formatMoney(data.standard_cost, currency) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Gross margin</p>
            <p className="text-sm font-semibold text-status-success">
              {data.gross_margin != null ? formatMoney(data.gross_margin, currency) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-text-muted">Margin %</p>
            <p className="text-sm font-semibold text-brand-gold">
              {data.margin_pct != null ? `${data.margin_pct.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      )}

      {data && data.history.length > 0 && (
        <div className="border-t border-surface-4/60 pt-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-text-secondary hover:text-brand-gold"
          >
            <span>Price history ({data.history.length})</span>
            {historyOpen ? <NavArrowUp className="h-3.5 w-3.5" /> : <NavArrowDown className="h-3.5 w-3.5" />}
          </button>
          {historyOpen && (
            <ul className="mt-2 space-y-1.5">
              {data.history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary">
                    {entry.old_price != null ? formatMoney(entry.old_price, entry.currency) : "—"}
                    {" → "}
                    <span className="font-semibold text-text-primary">
                      {formatMoney(entry.new_price, entry.currency)}
                    </span>
                    {entry.change_pct != null && (
                      <span className={entry.change_pct >= 0 ? "text-status-success" : "text-status-critical"}>
                        {" "}({entry.change_pct >= 0 ? "+" : ""}{entry.change_pct.toFixed(1)}%)
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-text-muted">
                    {formatChangedAt(entry.occurred_at)} · {entry.changed_by || (entry.source_type === "POS_SYNC" ? "POS sync" : "System")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function MenuItemModal({ open, onClose, branchId, menuItem }: Props) {
  const isEdit = Boolean(menuItem);
  const formId = useId();

  const [form, setForm] = useState<FormState>(menuItem ? toForm(menuItem) : EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // Crop step state
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const createMutation = useCreateMenuItem(branchId);
  const updateMutation = useUpdateMenuItem(branchId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      setForm(menuItem ? toForm(menuItem) : EMPTY_FORM);
      setError(null);
      setCropperSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [open, menuItem]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropperSrc(URL.createObjectURL(file));
    }
    e.target.value = "";
  }

  const onCropAreaChange = useCallback((_: Area, pixelCrop: Area) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  async function handleApplyCrop() {
    if (!croppedAreaPixels || !cropperSrc) return;
    setIsApplying(true);
    const blob = await getCroppedImg(cropperSrc, croppedAreaPixels);
    if (blob) {
      const file = new File([blob], "image.jpg", { type: "image/jpeg" });
      set("image", file);
      set("image_preview", URL.createObjectURL(blob));
    }
    setIsApplying(false);
    setCropperSrc(null);
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

  // ── Crop step — replaces form content inside same modal ──
  if (cropperSrc) {
    return (
      <ModalShell
        open={open}
        onClose={() => setCropperSrc(null)}
        title="Adjust framing"
        description="Drag to reposition · scroll or pinch to zoom"
        maxWidthClassName="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCropperSrc(null)}
              className="inline-flex h-10 items-center rounded-lg border border-surface-4 px-4 text-sm text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={isApplying}
              className="inline-flex h-10 items-center rounded-lg bg-brand-gold px-5 text-sm font-semibold text-[#141416] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isApplying ? "Applying…" : "Apply crop"}
            </button>
          </>
        }
      >
        {/* Crop canvas */}
        <div className="relative overflow-hidden rounded-xl bg-[#141416]" style={{ height: 320 }}>
          <Cropper
            image={cropperSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaChange}
            classes={{ containerClassName: "rounded-xl" }}
          />
        </div>

        {/* Zoom slider */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Zoom</span>
            <span className="text-xs font-semibold tabular-nums text-text-secondary">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            aria-label="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-0.75 cursor-pointer appearance-none rounded-full bg-surface-4 accent-brand-gold"
          />
        </div>
      </ModalShell>
    );
  }

  // ── Normal form step ──
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
          <label className="block text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
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
            <label className="block text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
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
            <label className="block text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
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

        {/* Pricing — its own save action; only meaningful once the item exists */}
        {isEdit && menuItem && (
          <MenuItemPricingSection branchId={branchId} menuItemId={menuItem.id} />
        )}

        {/* Image Upload */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
            Image <span className="normal-case font-normal text-text-muted">(square crop applied on upload)</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            id="image-upload"
          />

          {form.image_preview ? (
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-surface-4 bg-surface-3">
                <img
                  src={form.image_preview}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="image-upload"
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-surface-4 bg-surface-3 px-4 text-sm text-text-secondary transition-colors hover:border-brand-gold/60 hover:text-brand-gold"
                >
                  Replace
                </label>
                <button
                  type="button"
                  onClick={() => { set("image", null); set("image_preview", null); }}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-surface-4 px-4 text-sm text-text-muted transition-colors hover:border-status-critical/40 hover:text-status-critical"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label
              htmlFor="image-upload"
              className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-surface-4 bg-surface-3 text-text-muted transition-colors hover:border-brand-gold/60 hover:text-brand-gold"
            >
              <MediaImage className="h-5 w-5" />
              <span className="text-xs font-medium">Click to upload image</span>
              <span className="text-[11px] text-text-muted">Will be cropped to square</span>
            </label>
          )}
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">
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
