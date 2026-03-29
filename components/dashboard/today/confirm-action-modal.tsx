"use client";

import { ModalShell } from "@/components/ui/modal-shell";
import { useTranslation } from "@/lib/i18n";

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isConfirming?: boolean;
  tone?: "brand" | "critical";
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  isConfirming = false,
  tone = "brand",
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  const { t } = useTranslation();
  return (
    <ModalShell
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full border border-surface-4 px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-3"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={isConfirming}
            onClick={onConfirm}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              tone === "critical"
                ? "border-status-critical/50 text-status-critical hover:bg-status-critical/10"
                : "border-brand-gold/45 text-brand-gold hover:bg-brand-gold/10"
            }`}
          >
            {isConfirming ? t("setup.common.processing") : confirmLabel}
          </button>
        </>
      }
    />
  );
}
