"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SIDEBAR_STORAGE_KEY = "prepiq_sidebar_collapsed";

type SidebarStateContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
  /** Mobile (<lg) drawer visibility. The fixed rail is replaced by an
   *  overlay drawer below `lg`; this state is only meaningful there. */
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
};

const SidebarStateContext = createContext<SidebarStateContextValue | null>(null);

const MOBILE_BREAKPOINT = "(min-width: 1024px)";

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Crossing to desktop with the drawer open would leave it lingering in
  // state for the next time the viewport shrinks.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
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
      mobileOpen,
      setMobileOpen,
    }),
    [collapsed, mobileOpen],
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
