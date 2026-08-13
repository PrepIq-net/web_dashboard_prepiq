"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The things every modal-ish surface in this app has to get right, extracted
 * so a surface that cannot use `DrawerShell` does not quietly ship without
 * them. Both consume this:
 *
 * - Escape closes.
 * - `mounted` gates `createPortal`, which cannot run during SSR.
 *
 * Body scroll is deliberately NOT locked: drawers overlay the page and the
 * page stays scrollable behind them, consistent with the assistant drawer.
 * When the drawer's own content reaches its scroll boundary the wheel keeps
 * flowing to the page behind (native scroll chaining).
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
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  return { mounted };
}
