"use client";

import { useEffect } from "react";
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
    },
  ),
);

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
  const branchId = useBranchStore((s) => s.branchId);
  const accessScopeQuery = useProductionIntelligenceAccessScope();
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
  const branchId = useBranchStore((s) => s.branchId);
  const setBranchId = useBranchStore((s) => s.setBranchId);

  useEffect(() => {
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
  }, [urlBranchId, branches, defaultBranchId, branchId, setBranchId]);

  // While resolving, prefer a valid stored value, else the default, so callers
  // never see an empty string when a branch is actually available.
  const effective =
    branchId && branches.some((b) => b.id === branchId)
      ? branchId
      : defaultBranchId ?? branchId;

  return [effective, setBranchId] as const;
}
