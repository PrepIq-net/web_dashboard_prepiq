"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SIDEBAR_STORAGE_KEY = "prepiq_sidebar_collapsed";

type SidebarStateContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
};

const SidebarStateContext = createContext<SidebarStateContextValue | null>(null);

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "1") {
        setCollapsed(true);
      }
    } catch {
      // Ignore storage issues and default to expanded.
    }
  }, []);

  const value = useMemo<SidebarStateContextValue>(
    () => ({
      collapsed,
      setCollapsed: (next) => {
        setCollapsed(next);
        try {
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
        } catch {
          // Ignore storage issues.
        }
      },
      toggle: () => {
        setCollapsed((prev) => {
          const next = !prev;
          try {
            window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
          } catch {
            // Ignore storage issues.
          }
          return next;
        });
      },
    }),
    [collapsed],
  );

  return (
    <SidebarStateContext.Provider value={value}>
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState() {
  const context = useContext(SidebarStateContext);

  if (!context) {
    throw new Error("useSidebarState must be used within SidebarStateProvider");
  }

  return context;
}
