"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavArrowDown, Search, Check } from "iconoir-react";
import { CURRENCIES, COMMON_CODES, getCurrency, type Currency } from "@/lib/currencies";

type CurrencySelectProps = {
  label?: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
};

/**
 * Searchable currency picker. Filters by code, name, or symbol; pins the most
 * common currencies at the top so the frequent choice is one glance away, with
 * the full list a keystroke behind.
 */
export function CurrencySelect({
  label,
  value,
  onChange,
  placeholder = "Select currency",
  disabled = false,
  error,
  className = "",
}: CurrencySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = getCurrency(value);

  const { common, rest } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c: Currency) =>
      !q ||
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q);
    const matched = CURRENCIES.filter(match);
    const commonSet = new Set(COMMON_CODES);
    return {
      common: COMMON_CODES.map((code) => matched.find((c) => c.code === code)).filter(
        (c): c is Currency => Boolean(c),
      ),
      rest: matched.filter((c) => !commonSet.has(c.code)),
    };
  }, [query]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node) &&
      !menuRef.current?.contains(e.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const MAX_H = 320;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const upward = spaceBelow < MAX_H && spaceAbove > spaceBelow;
    setMenuPos({
      top: upward ? rect.top - 8 - Math.min(MAX_H, spaceAbove) : rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onViewport = () => updateMenuPosition();
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    const focus = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
      clearTimeout(focus);
    };
  }, [isOpen, updateMenuPosition]);

  function open() {
    if (disabled) return;
    setQuery("");
    updateMenuPosition();
    setIsOpen(true);
  }

  function pick(code: string) {
    onChange(code);
    setIsOpen(false);
  }

  const renderRow = (c: Currency) => (
    <button
      key={c.code}
      type="button"
      onClick={() => pick(c.code)}
      className={`flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand-gold/10 hover:text-brand-gold ${
        c.code === value ? "bg-brand-gold/10 text-brand-gold font-medium" : "text-text-secondary"
      }`}
    >
      <span className="w-9 shrink-0 text-[13px] font-semibold tabular-nums text-text-muted">
        {c.symbol}
      </span>
      <span className="w-10 shrink-0 font-mono text-[12px] font-semibold">{c.code}</span>
      <span className="flex-1 truncate text-[13px]">{c.name}</span>
      {c.code === value && <Check className="h-4 w-4 shrink-0 text-brand-gold" />}
    </button>
  );

  return (
    <div className={`block ${label ? "space-y-2" : ""} ${className}`} ref={containerRef}>
      {label && <span className="text-sm font-medium text-text-secondary">{label}</span>}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => (isOpen ? setIsOpen(false) : open())}
          className={`flex h-12 w-full items-center gap-2 rounded-button border bg-surface-3 px-3 text-left transition-[border-color,box-shadow,background-color] duration-200 focus:outline-none focus:ring-1 hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
              : isOpen
                ? "border-brand-gold ring-brand-gold/20"
                : "border-border-default focus:border-brand-gold focus:ring-brand-gold/20"
          }`}
        >
          <span className="text-[13px] font-semibold text-text-muted w-7">{selected.symbol}</span>
          <span className="flex-1 truncate text-sm text-text-primary">
            {value ? `${selected.code} — ${selected.name}` : placeholder}
          </span>
          <NavArrowDown
            className={`h-4 w-4 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen &&
          menuPos &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[10050] rounded-card border border-border-default bg-surface-3 p-1 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
              style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            >
              <div className="flex items-center gap-2 border-b border-border-default px-2.5 pb-2 pt-1.5">
                <Search className="h-4 w-4 text-text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search currency, code, or symbol…"
                  className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>
              <div className="mt-1 max-h-[248px] overflow-y-auto space-y-0.5 [scrollbar-width:thin] [scrollbar-color:#2E2E33_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2E2E33]">
                {common.length > 0 && (
                  <>
                    <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      Common
                    </p>
                    {common.map(renderRow)}
                    {rest.length > 0 && <div className="my-1 h-px bg-border-default/60" />}
                  </>
                )}
                {rest.map(renderRow)}
                {common.length === 0 && rest.length === 0 && (
                  <p className="px-3 py-4 text-center text-[13px] text-text-muted">
                    No currency matches “{query}”.
                  </p>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
