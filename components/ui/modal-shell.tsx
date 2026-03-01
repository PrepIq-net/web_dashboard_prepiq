"use client";

import { useEffect, type ReactNode } from "react";
import { Xmark } from "iconoir-react";

type ModalShellProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
};

export function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-lg",
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full ${maxWidthClassName} rounded-xl border border-surface-4 bg-surface-2 shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between border-b border-surface-4 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-text-primary">{title}</h2>
            {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </header>
        {children ? <div className="px-5 py-4">{children}</div> : null}
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-surface-4 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
