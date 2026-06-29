"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Xmark } from "iconoir-react";

export function AssistantDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const drawer = (
    <div className="fixed inset-0 z-9999 flex">
      <div
        className="flex-1 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="assistant-drawer-panel flex h-full w-[460px] max-w-[88vw] flex-col border-l border-surface-4 bg-surface-1 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-start justify-between border-b border-surface-4 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
