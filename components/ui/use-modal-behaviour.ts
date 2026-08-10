"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The three things every modal in this app has to get right, extracted so a
 * modal that cannot use `ModalShell` does not quietly ship without them.
 *
 * `ModalShell` owns its own backdrop, panel and entrance, which is right for
 * the 23 dialogs that use it and wrong for a surface doing a shared-element
 * morph. Rather than let such a surface hand-roll its chrome and lose the
 * behaviour along with it, both consume this:
 *
 * - Escape closes.
 * - Body scroll locks, compensating for the scrollbar width so the page
 *   underneath does not visibly jump sideways as it disappears.
 * - `mounted` gates `createPortal`, which cannot run during SSR.
 *
 * Focus containment is deliberately NOT here: it depends on the panel's own
 * DOM, so it belongs to the component that owns the panel.
 */
export function useModalBehaviour(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  return { mounted };
}
