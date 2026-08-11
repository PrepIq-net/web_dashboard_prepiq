"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, PageSearch } from "iconoir-react";
import { useCurrentUserProfile } from "@/services";
import { canAccessDashboard, resolvePermissions } from "@/lib/permissions";

type NotFoundStateProps = {
  compact?: boolean;
};

/**
 * Shared 404 content, used from two places:
 * - `app/workspace/not-found.tsx` (compact) — an unmatched route inside
 *   `/workspace/*` bubbles here, rendered inside the normal sidebar/topnav
 *   shell via `app/workspace/layout.tsx`. This is the common case.
 * - `app/not-found.tsx` — an unmatched route outside `/workspace/*`
 *   (rare: the proxy already sends unauthenticated requests to `/login`
 *   before routing gets this far). No shell available, so that page
 *   centers this on a bare surface instead.
 */
export function NotFoundState({ compact = false }: NotFoundStateProps) {
  const pathname = usePathname();
  const { data: user, isPending, isError } = useCurrentUserProfile();
  const hasDashboardAccess = canAccessDashboard(resolvePermissions(user));

  // The proxy (proxy.ts) already redirects anyone without a session cookie
  // to /login before this ever renders, so reaching this component IS proof
  // of an authenticated session — a profile fetch that's merely pending or
  // errored (a blip, a cold compile) is not proof of the opposite. Only
  // claim a role-specific destination once the fetch has genuinely
  // succeeded; otherwise fall back to a neutral "Return to Workspace" that's
  // never wrong, rather than a misleading "Go to Login" for someone who is.
  const profileResolved = !isPending && !isError && Boolean(user);
  const homeHref = profileResolved
    ? hasDashboardAccess
      ? "/workspace/dashboard"
      : "/workspace/today"
    : "/";
  const homeLabel = profileResolved
    ? hasDashboardAccess
      ? "Return to Dashboard"
      : "Return to Today"
    : "Return to Workspace";

  return (
    <section
      className={`rounded-[14px] border border-border-default bg-surface-2 ${
        compact ? "p-6" : "p-8 md:p-10"
      }`}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-surface-3">
        <PageSearch className="h-5 w-5 text-text-muted" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
        404
      </p>
      <h1
        className={`mt-3 font-display font-semibold text-text-primary ${
          compact ? "text-[24px] leading-8" : "text-[34px] leading-10.5"
        }`}
      >
        Page not found.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-5.5 text-text-muted">
        The page you requested isn&apos;t part of PrepIQ, or the link is out of
        date.
      </p>
      {pathname && (
        <p className="mt-2 font-mono text-[12px] text-text-disabled">
          Requested route: {pathname}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Link
          href={homeHref}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-gold px-5 text-sm font-semibold text-surface-1 transition-colors hover:bg-brand-gold-hover active:bg-brand-gold-pressed"
        >
          {homeLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/workspace/support"
          className="text-sm text-text-muted transition-colors hover:text-text-secondary"
        >
          Contact support
        </Link>
      </div>
    </section>
  );
}
