"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useProductionIntelligenceAccessScope } from "@/services/production-intelligence/hooks";

/**
 * Shared, cross-navigation branch selection.
 *
 * Previously every workspace page held its own `useState(defaultBranch?.id)`,
 * so the selected branch reset to the default on every navigation (part of the
 * "everything reloads" feeling). This store is a module-level singleton that
 * survives client-side navigation, and persists to localStorage so the choice
 * also survives a full reload. The branch id is not sensitive (a UUID), and a
 * stored id that doesn't belong to the current user's branches is ignored by
 * `useSelectedBranch` below, so switching users/orgs self-corrects.
 */
type BranchState = {
  branchId: string;
  setBranchId: (id: string) => void;
  reset: () => void;
};

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branchId: "",
      setBranchId: (id) => set({ branchId: id }),
      reset: () => set({ branchId: "" }),
    }),
    {
      name: "prepiq.selected-branch",
      storage: createJSONStorage(() => localStorage),
      // Without this, persist reads localStorage synchronously while the
      // store module initializes on the client, so the client's very first
      // render can already have a real branchId while the server (no
      // localStorage) rendered "" — a hydration mismatch on every
      // /workspace/* page. skipHydration defers that read to an explicit
      // `rehydrate()` call inside an effect (see `useHasHydrated` below),
      // which only runs after mount, guaranteeing the first client render
      // matches the server's.
      skipHydration: true,
    },
  ),
);

/**
 * True once the persisted branch selection has been read from localStorage.
 * Triggers that read (it's a no-op after the first call) and stays false for
 * the SSR pass and the first client render, so components that gate on it
 * hydrate cleanly before switching to the real persisted value.
 */
let hydrationStarted = false;
function useHasHydrated(): boolean {
  // Always start false — this must match the server, which never runs this
  // effect at all, so the persist store's `.persist` API (client-only, since
  // it touches localStorage) is never read during the render that gets
  // diffed against the server output.
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (!hydrationStarted) {
      hydrationStarted = true;
      void useBranchStore.persist.rehydrate();
    }
    if (useBranchStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }
    return useBranchStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, []);

  return hasHydrated;
}

/** Clear persisted branch selection (call on logout). */
export function clearSelectedBranch() {
  useBranchStore.getState().reset();
}

/**
 * The branch global surfaces (e.g. the command palette) should act on:
 * the user's persisted selection when present, else the org's default
 * branch from the (already cached) access scope — the same fallback the
 * workspace layout uses. Returns "" while nothing is resolvable yet.
 */
export function useActiveBranchId(): string {
  const hasHydrated = useHasHydrated();
  const branchId = useBranchStore((s) => s.branchId);
  const accessScopeQuery = useProductionIntelligenceAccessScope();
  if (!hasHydrated) return accessScopeQuery.data?.default_branch_id || "";
  return branchId || accessScopeQuery.data?.default_branch_id || "";
}

type Branchy = { id: string };

/**
 * Resolve the effective branch for a page and keep it in the shared store.
 *
 * Priority: a valid `?branch=` URL param > a still-valid stored selection >
 * the page's default branch. Returns `[branchId, setBranchId]` as a drop-in
 * replacement for the old `useState` pair.
 */
export function useSelectedBranch(params: {
  branches: Branchy[];
  defaultBranchId?: string | null;
  urlBranchId?: string | null;
}): readonly [string, (id: string) => void] {
  const { branches, defaultBranchId, urlBranchId } = params;
  const hasHydrated = useHasHydrated();
  const branchId = useBranchStore((s) => s.branchId);
  const setBranchId = useBranchStore((s) => s.setBranchId);

  useEffect(() => {
    // Don't act on the store's pre-hydration "" placeholder — it isn't a
    // real "no selection" yet, just the not-yet-read-from-localStorage
    // state, and resolving against it here would stomp a real persisted
    // selection with `defaultBranchId` for one tick.
    if (!hasHydrated) return;

    const isValid = (id: string) => branches.some((b) => b.id === id);

    if (urlBranchId && isValid(urlBranchId)) {
      if (urlBranchId !== branchId) setBranchId(urlBranchId);
      return;
    }
    // Stored selection no longer belongs to the available branches (e.g. after
    // switching org) — fall back to this page's default.
    if ((!branchId || !isValid(branchId)) && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [hasHydrated, urlBranchId, branches, defaultBranchId, branchId, setBranchId]);

  // Before hydration (SSR pass + first client render), always resolve to the
  // page's default so the client's first paint matches what the server sent
  // — the persisted value only takes over once we know it's been read.
  const effective =
    !hasHydrated
      ? defaultBranchId ?? ""
      : branchId && branches.some((b) => b.id === branchId)
        ? branchId
        : defaultBranchId ?? branchId;

  return [effective, setBranchId] as const;
}
