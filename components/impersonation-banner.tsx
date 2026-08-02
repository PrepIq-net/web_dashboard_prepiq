"use client";

/**
 * Persistent notice that the current session is a read-only support session.
 *
 * Rendered above everything from the root layout, so there is no route where an
 * admin can forget whose account they are looking at. `warning` is used rather
 * than `critical` deliberately: nothing is broken, but nothing here is the
 * admin's own data either.
 *
 * The bar is fixed rather than sticky, and it pushes the page down instead of
 * floating over it. The workspace sidebar is `fixed top-0 h-screen`, so a bar
 * that only participated in normal flow got covered by the sidebar and sat on
 * top of the page heading. It publishes its measured height as
 * `--impersonation-bar` on <html> and marks the document with
 * `data-impersonating`; globals.css uses those to inset the body and the
 * sidebar by exactly that much.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "iconoir-react";

import type { ImpersonationContext } from "@/lib/auth/cookies";

/** Under this many seconds the countdown starts warning rather than informing. */
const ENDING_SOON_SECONDS = 5 * 60;

function secondsLeft(expiresAt: number): number {
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

function remainingLabel(seconds: number): string {
  if (seconds <= 0) return "Session ended";
  const minutes = Math.floor(seconds / 60);
  // Spelled out rather than "29 min left": the admin needs to read this as a
  // deadline they are approaching, not as a stat.
  if (minutes >= 2) return `Signs out in ${minutes} min`;
  if (minutes === 1) return `Signs out in 1 min ${seconds % 60}s`;
  return `Signs out in ${seconds}s`;
}

export function ImpersonationBanner({
  context,
}: {
  context: ImpersonationContext;
}) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [seconds, setSeconds] = useState(() => secondsLeft(context.expiresAt));
  const [ending, setEnding] = useState(false);

  // Layout effect so the page is never painted once at the wrong offset.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const node = barRef.current;
    if (!node) return;

    function publishHeight() {
      if (!node) return;
      root.style.setProperty(
        "--impersonation-bar",
        `${Math.ceil(node.getBoundingClientRect().height)}px`,
      );
    }

    root.setAttribute("data-impersonating", "true");
    publishHeight();

    // The message wraps on narrow viewports, so the height is not a constant.
    const observer = new ResizeObserver(publishHeight);
    observer.observe(node);

    return () => {
      observer.disconnect();
      root.removeAttribute("data-impersonating");
      root.style.removeProperty("--impersonation-bar");
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const left = secondsLeft(context.expiresAt);
      setSeconds(left);
      if (left <= 0) {
        // The token is dead; every request from here would 401. Refreshing
        // sends the user to the login screen rather than a broken shell.
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [context.expiresAt, router]);

  async function endSession() {
    setEnding(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  const endingSoon = seconds <= ENDING_SOON_SECONDS;

  return (
    <div
      ref={barRef}
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-status-warning/40 bg-status-warning/15 px-4 py-2 backdrop-blur-sm"
    >
      <Eye className="h-4 w-4 shrink-0 text-status-warning" aria-hidden />
      <p className="text-sm text-text-primary">
        Read-only support session — viewing as{" "}
        <span className="font-semibold">{context.fullName || context.email}</span>{" "}
        <span className="text-text-secondary">({context.email})</span>. Changes
        are blocked.
      </p>
      <span
        // Tinted pill rather than coloured 12px type once it matters: warning on
        // surface passes AA, but the pill is what makes it read as urgent.
        className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
          endingSoon
            ? "bg-status-warning/25 text-text-primary"
            : "text-text-secondary"
        }`}
      >
        {remainingLabel(seconds)}
      </span>
      <button
        type="button"
        onClick={endSession}
        disabled={ending}
        className="ml-auto rounded-md border border-border-default bg-surface-2 px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
      >
        {ending ? "Ending…" : "End session"}
      </button>
    </div>
  );
}
