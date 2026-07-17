"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ModalShell } from "@/components/ui/modal-shell";

type RecordProductionModalProps = {
  open: boolean;
  itemTitle: string;
  unit: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (quantityProduced: number) => void;
};

/** Record what the kitchen actually cooked — a fact-entry fallback for
 * kitchens whose production isn't fed by POS/CSV/connector. Deliberately not
 * pre-filled from any suggestion: PrepIQ records decisions, it doesn't make
 * them. */
export function RecordProductionModal({
  open,
  itemTitle,
  unit,
  isSubmitting = false,
  onClose,
  onSubmit,
}: RecordProductionModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    if (!open) {
      setQuantity("");
    }
  }, [open]);

  const parsedQuantity = Number(quantity);
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
      title={t("today.record.title")}
      description={t("today.record.description", { item: itemTitle })}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full border border-surface-4 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-3"
          >
            {t("today.record.cancel")}
          </button>
          <button
            type="button"
            disabled={!isValid || isSubmitting}
            onClick={handleSubmit}
            className="inline-flex h-10 items-center rounded-full border border-brand-gold/50 px-4 text-sm font-semibold text-brand-gold transition-colors hover:bg-brand-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? t("today.record.saving") : t("today.record.submit")}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label
          className="text-sm font-medium text-text-secondary"
          htmlFor="record-production-qty-input"
        >
          {t("today.record.quantityLabel", { unit })}
        </label>
        <input
          id="record-production-qty-input"
          type="number"
          min="0"
          step="any"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder={t("today.record.placeholder", { unit })}
          className="h-11 w-full rounded-full border border-surface-4 bg-surface-3 px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-gold/20"
        />
        <p className="text-xs text-text-muted">{t("today.record.hint")}</p>
      </div>
    </ModalShell>
  );
}
