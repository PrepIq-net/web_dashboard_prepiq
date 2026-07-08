"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Query } from "@tanstack/react-query";

/**
 * Short-lived React Query persistence.
 *
 * The in-memory cache is wiped by a full page reload (F5) or reopening the tab,
 * which is a big part of the "everything reloads" feeling. Persisting the cache
 * to localStorage lets a reload paint instantly from the last snapshot, after
 * which `staleTime` triggers a background revalidation — fast, not stale.
 *
 * Safety: identity/auth, the subscription gate, and live-polling queries are
 * NEVER written to disk (see the denylist), so a reload can't surface another
 * user's profile or a stale gate. `clearPersistedCache()` is also called on
 * logout. Remaining persisted data is branch-scoped and access-controlled by
 * the backend.
 */
export const PERSIST_KEY = "prepiq.rq-cache";
export const PERSIST_MAX_AGE = 10 * 60_000; // 10 minutes
// Bump when a cached response shape changes in a breaking way — invalidates all
// persisted caches on the next load.
export const PERSIST_BUSTER = "v1";

// Query-key roots that must never be persisted.
const DENYLIST_ROOTS: readonly (readonly string[])[] = [
  ["users"], // profile / identity / session
  ["payment"], // subscription gate must always be evaluated live
  ["assistant"], // conversation contents
];

function isDenied(queryKey: readonly unknown[]): boolean {
  return DENYLIST_ROOTS.some((root) =>
    root.every((part, i) => queryKey[i] === part),
  );
}

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  // Only successful, non-sensitive queries are written. Live/polling queries
  // are safe to persist: on restore they show the last value and their own
  // interval refetches immediately. maxAge + staleTime bound any staleness.
  return !isDenied(query.queryKey as readonly unknown[]);
}

export function createPersister() {
  return createSyncStoragePersister({
    // undefined on the server → persister no-ops (safe during SSR).
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    key: PERSIST_KEY,
  });
}

export function clearPersistedCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Ignore storage errors (private mode, quota, disabled).
  }
}
