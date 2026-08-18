"use client";

import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Xmark } from "iconoir-react";
import { useModalBehaviour } from "./use-modal-behaviour";

type ModalShellProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  /** Panel width — a Tailwind `max-w-*` class. Defaults to a compact size
      appropriate for a short decision; pass a wider one if there's real
      content, though DrawerShell is usually the better fit at that point. */
  widthClassName?: string;
};

/**
 * Centered dialog for a short decision that should interrupt the user until
 * they answer it — "start service?", "enable notifications?" — as opposed to
 * DrawerShell, which is for content-rich flows (a form, a list, a record)
 * meant to be worked *within*, not just answered. The two are deliberately
 * different shapes for that reason.
 *
 * This distinction existed once: this file was `modal-shell.tsx` before an
 * app-wide pass on 2026-08-13 replaced every modal with a drawer for
 * consistency (see git history on `components/ui/drawer-shell.tsx`). It's
 * back, deliberately scoped to phase-transition confirms and similar quick
 * asks — reach for it there, not by default; DrawerShell is still correct
 * for anything with real content.
 */
export function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  widthClassName = "max-w-md",
}: ModalShellProps) {
  const { mounted } = useModalBehaviour(open, onClose);

  if (!open || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex w-full flex-col ${widthClassName} max-h-[calc(100vh-6rem)] min-h-0 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 shadow-2xl animate-fade-in`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-4 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-text-primary">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-text-secondary">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </header>
        {children ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-thin">
            {children}
          </div>
        ) : null}
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-surface-4 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );

  // Portal renders at document.body — escapes any ancestor transform/filter/backdrop-filter
  // that would otherwise trap position:fixed inside a sub-stacking-context.
  return createPortal(modal, document.body);
}
