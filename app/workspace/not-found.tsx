"use client";

import { NotFoundState } from "@/components/dashboard/empty-states/not-found-state";

// Catches any unmatched route under /workspace/* (a stale bookmark, a typo'd
// link, a removed page). Rendered inside app/workspace/layout.tsx, so the
// sidebar and top nav stay mounted — the user can navigate away without the
// app shell disappearing out from under them.
export default function WorkspaceNotFound() {
  return (
    <div className="mt-8 max-w-2xl">
      <NotFoundState compact />
    </div>
  );
}
