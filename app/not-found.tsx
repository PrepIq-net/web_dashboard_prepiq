"use client";

import { NotFoundState } from "@/components/dashboard/empty-states/not-found-state";

// Catches an unmatched route outside /workspace/* — rare in practice, since
// the proxy (proxy.ts) already sends unauthenticated requests to /login
// before Next's router gets this far. No sidebar/topnav shell exists at this
// level (nothing under /workspace/layout.tsx wraps this route), so this
// centers the same card on a bare surface instead.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1 px-6 py-16">
      <div className="w-full max-w-2xl">
        <NotFoundState />
      </div>
    </div>
  );
}
