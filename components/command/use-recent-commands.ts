"use client";

import { useCallback, useState } from "react";
import type { NavPageId } from "@/lib/command/navigation";

const STORAGE_KEY = "prepiq.command-recents";
const MAX_RECENTS = 5;

export type RecentCommand = { pageId: NavPageId };

function readRecents(): RecentCommand[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is RecentCommand => Boolean(entry?.pageId))
      : [];
  } catch {
    return [];
  }
}

/** Most-recently navigated palette destinations, persisted per browser. */
export function useRecentCommands() {
  const [recents, setRecents] = useState<RecentCommand[]>(readRecents);

  const addRecent = useCallback((pageId: NavPageId) => {
    setRecents((current) => {
      const next = [
        { pageId },
        ...current.filter((entry) => entry.pageId !== pageId),
      ].slice(0, MAX_RECENTS);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage full/blocked — recents just stop persisting.
      }
      return next;
    });
  }, []);

  return { recents, addRecent };
}
