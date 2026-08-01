"use client";

/**
 * Persistent notice that the current session is a read-only support session.
 *
 * Rendered above everything from the root layout, so there is no route where an
 * admin can forget whose account they are looking at. `warning` is used rather
 * than `critical` deliberately: nothing is broken, but nothing here is the
 * admin's own data either.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "iconoir-react";

import type { ImpersonationContext } from "@/lib/auth/cookies";

function remainingLabel(expiresAt: number): string {
  const seconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) return `${minutes} min left`;
  return `${seconds}s left`;
}

export function ImpersonationBanner({
  context,
}: {
  context: ImpersonationContext;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(() => remainingLabel(context.expiresAt));
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setLabel(remainingLabel(context.expiresAt));
      if (context.expiresAt <= Date.now()) {
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

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-status-warning/40 bg-status-warning/15 px-4 py-2"
    >
      <Eye className="h-4 w-4 shrink-0 text-status-warning" aria-hidden />
      <p className="text-sm text-text-primary">
        Read-only support session — viewing as{" "}
        <span className="font-semibold">{context.fullName || context.email}</span>{" "}
        <span className="text-text-secondary">({context.email})</span>. Changes
        are blocked.
      </p>
      <span className="text-xs tabular-nums text-text-secondary">{label}</span>
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
