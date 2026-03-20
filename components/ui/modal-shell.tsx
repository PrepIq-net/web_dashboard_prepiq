"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => updateScrollIndicators(), 0);
    return () => window.clearTimeout(timer);
  }, [open, updateScrollIndicators, children]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`flex w-full flex-col ${maxWidthClassName} max-h-[calc(100vh-6rem)] min-h-0 overflow-hidden rounded-xl border border-surface-4 bg-surface-2 shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between border-b border-surface-4 px-5 py-4">
          <div>
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </header>
        {children ? (
          <div className="relative flex-1 min-h-0">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto overscroll-contain px-5 py-4"
              onScroll={updateScrollIndicators}
            >
              {children}
            </div>
            {showScrollUp ? (
              <button
                type="button"
                onClick={() => {
                  scrollRef.current?.scrollBy({ top: -160, behavior: "smooth" });
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
          <footer className="flex items-center justify-end gap-2 border-t border-surface-4 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
