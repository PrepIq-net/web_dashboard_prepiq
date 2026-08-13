"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Xmark } from "iconoir-react";

// Legacy ModalShell call sites passed max-w-* to size the centered dialog;
// the same classes now map onto drawer widths so the swap was one import.
const LEGACY_WIDTHS: Record<string, string> = {
  "max-w-md": "w-[480px]",
  "max-w-lg": "w-[560px]",
  "max-w-xl": "w-[680px]",
  "max-w-2xl": "w-[720px]",
  "max-w-3xl": "w-[896px]",
};

type DrawerShellProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  /** Drawer width — a Tailwind class like "w-[640px]", or a legacy
      "max-w-*" value which is mapped onto a matching drawer width. */
  widthClassName?: string;
};

export function DrawerShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  widthClassName,
}: DrawerShellProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  // Track client mount so we can safely call createPortal
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

  const updateScrollIndicators = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const canScroll = scrollHeight - clientHeight > 4;
    if (!canScroll) {
      setShowScrollUp(false);
      setShowScrollDown(false);
      return;
    }
    setShowScrollUp(scrollTop > 4);
    setShowScrollDown(scrollTop + clientHeight < scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    // The page behind stays scrollable: when the drawer's content reaches its
    // scroll boundary the wheel flows to the page (native scroll chaining),
    // matching the assistant drawer.
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => updateScrollIndicators(), 0);
    return () => window.clearTimeout(timer);
  }, [open, updateScrollIndicators, children]);

  if (!open || !mounted) return null;

  const width = widthClassName?.startsWith("max-w-")
    ? (LEGACY_WIDTHS[widthClassName] ?? "w-[640px]")
    : (widthClassName ?? "w-[640px]");

  const drawer = (
    <div className="fixed inset-0 z-9999 flex">
      <div
        className="flex-1 bg-black/50"
        onClick={onClose}
        role="presentation"
      />

      <div
        className={`flex h-full min-h-0 flex-col border-l border-surface-4 bg-surface-1 animate-in slide-in-from-right duration-200 ${width} max-w-[96vw]`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-4 px-6 py-5">
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
          <div className="relative flex-1 min-h-0">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto overscroll-contain px-6 py-6 scrollbar-thin"
              onScroll={updateScrollIndicators}
            >
              {children}
            </div>
            {showScrollUp ? (
              <button
                type="button"
                onClick={() => {
                  scrollRef.current?.scrollBy({
                    top: -160,
                    behavior: "smooth",
                  });
                }}
                aria-label="Scroll up"
                className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center justify-center rounded-full border border-surface-4 bg-surface-2/90 px-3 py-1 text-[11px] font-semibold text-text-secondary shadow-sm transition-colors hover:bg-surface-3"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="mr-1 h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 15l6-6 6 6" />
                </svg>
                Scroll
              </button>
            ) : null}
            {showScrollDown ? (
              <button
                type="button"
                onClick={() => {
                  scrollRef.current?.scrollBy({ top: 160, behavior: "smooth" });
                }}
                aria-label="Scroll down"
                className="pointer-events-auto absolute left-1/2 bottom-2 flex -translate-x-1/2 items-center justify-center rounded-full border border-surface-4 bg-surface-2/90 px-3 py-1 text-[11px] font-semibold text-text-secondary shadow-sm transition-colors hover:bg-surface-3"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="mr-1 h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
                Scroll
              </button>
            ) : null}
          </div>
        ) : null}
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-surface-4 px-6 py-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );

  // Portal renders at document.body — escapes any ancestor transform/filter/backdrop-filter
  // that would otherwise trap position:fixed inside a sub-stacking-context.
  return createPortal(drawer, document.body);
}