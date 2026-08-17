"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MapPin, NavArrowDown } from "iconoir-react";
import { useBranchOptions } from "@/services/context/use-branch-options";
import { useBranchStore } from "@/services/context/branch-store";
import { useTranslation } from "@/lib/i18n";

/**
 * Global location switcher.
 *
 * Staff can work at several branches — often with a different role at each —
 * so which branch you are looking at is a workspace-level choice, not a
 * per-page one. This writes to the shared branch store that every page already
 * reads from, so switching here changes the whole workspace at once.
 *
 * Renders nothing for single-branch orgs, where a switcher is just noise.
 */
export function BranchSwitcher() {
  const { t } = useTranslation();
  const { branchOptions, defaultBranch } = useBranchOptions();
  const branchId = useBranchStore((state) => state.branchId);
  const setBranchId = useBranchStore((state) => state.setBranchId);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleOutsideClick = useCallback((event: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [handleOutsideClick]);

  // `branchOptions` comes from client-fetched queries with nothing prefetched
  // on the server, so the server always renders this component at "no data
  // yet". On a fast backend those queries can resolve *during* hydration
  // rather than after it, so using live data on the very first client render
  // can hydrate a different tree than the server sent (a real, deterministic
  // mismatch — not the same race dev-only extensions can cause). Hold at the
  // server's shape for one tick so hydration always has something to match,
  // then let the real branch count in. Mirrors SidebarStateProvider's
  // localStorage-read-after-mount pattern for the same reason.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted || branchOptions.length < 2) return null;

  const activeId = branchId ?? defaultBranch?.id ?? "";
  const activeBranch =
    branchOptions.find((branch) => branch.id === activeId) ?? defaultBranch;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t("dashboard.topNav.switchLocation")}
        className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#232327] px-2.5 text-left transition-colors duration-150 hover:bg-[#2A2A2E]"
      >
        <MapPin className="h-4 w-4 shrink-0 text-[#8E8E93]" />
        <span className="hidden max-w-[140px] truncate text-[12px] font-medium text-[#F5F5F7] sm:block">
          {activeBranch?.name ?? t("dashboard.topNav.selectLocation")}
        </span>
        <NavArrowDown
          className={`h-4 w-4 shrink-0 text-[#8E8E93] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-[#2E2E33] bg-[#1C1C1F] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <p className="border-b border-[#2A2A2E] px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-[#8E8E93]">
            {t("dashboard.topNav.switchLocation")}
          </p>
          <div className="max-h-72 overflow-y-auto p-2 scrollbar-thin">
            {branchOptions.map((branch) => {
              const isActive = branch.id === activeId;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => {
                    setBranchId(branch.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
                    isActive
                      ? "bg-[#232327] text-[#F5F5F7]"
                      : "text-[#C7C7CC] hover:bg-[#232327] hover:text-[#F5F5F7]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{branch.name}</span>
                  {isActive ? (
                    <Check className="h-4 w-4 shrink-0 text-brand-gold" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
