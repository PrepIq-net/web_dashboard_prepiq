"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CommandPalette } from "@/components/command/command-palette";

type CommandPaletteContextValue = {
  enabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  enabled: false,
  open: false,
  setOpen: () => {},
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

const PALETTE_ENABLED = process.env.NEXT_PUBLIC_COMMAND_PALETTE_ENABLED !== "false";

/**
 * Owns the palette's open state and the global Cmd/Ctrl+K shortcut.
 * Mounted once in the workspace layout so the palette is reachable from
 * every page; the top-nav search trigger opens it through this context.
 */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);

  const setOpen = useCallback((next: boolean) => {
    if (PALETTE_ENABLED) setOpenState(next);
  }, []);

  useEffect(() => {
    if (!PALETTE_ENABLED) return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpenState((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ enabled: PALETTE_ENABLED, open, setOpen }),
    [open, setOpen],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {PALETTE_ENABLED && open ? <CommandPalette onClose={() => setOpen(false)} /> : null}
    </CommandPaletteContext.Provider>
  );
}
