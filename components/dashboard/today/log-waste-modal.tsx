"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";

type LogWasteModalProps = {
  open: boolean;
  itemTitle: string;
  unit: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (wasteQuantity: number) => void;
};

export function LogWasteModal({
  open,
  itemTitle,
  unit,
  isSubmitting = false,
  onClose,
  onSubmit,
}: LogWasteModalProps) {
  const [wasteQuantity, setWasteQuantity] = useState("");

  useEffect(() => {
    if (!open) {
      setWasteQuantity("");
    }
  }, [open]);

  const parsedQuantity = Number(wasteQuantity);
  const isValid = useMemo(
    () => Number.isFinite(parsedQuantity) && parsedQuantity > 0,
    [parsedQuantity],
  );

  const handleSubmit = () => {
    if (!isValid || isSubmitting) return;
    onSubmit(parsedQuantity);
  };

  return (
    <ModalShell
      open={open}
      title="Log Waste"
      description={`Record waste for ${itemTitle}.`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full border border-surface-4 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-3"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid || isSubmitting}
            onClick={handleSubmit}
            className="inline-flex h-10 items-center rounded-full border border-status-critical/50 px-4 text-sm font-semibold text-status-critical transition-colors hover:bg-status-critical/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Log Waste"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary" htmlFor="waste-qty-input">
          Waste quantity ({unit})
        </label>
        <input
          id="waste-qty-input"
          type="number"
          min="0"
          step="any"
          value={wasteQuantity}
          onChange={(event) => setWasteQuantity(event.target.value)}
          placeholder={`Enter waste in ${unit}`}
          className="h-11 w-full rounded-full border border-surface-4 bg-surface-3 px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-status-critical/20"
        />
      </div>
    </ModalShell>
  );
}
