"use client";

import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavArrowDown } from "iconoir-react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  leadingIcon?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function Select({
  label,
  options,
  value,
  onChange,
  leadingIcon,
  placeholder = "Select an option",
  disabled = false,
  error,
  className = "",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.target as Node) &&
      !menuRef.current?.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 8,
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
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  function handleSelect(val: string) {
    onChange(val);
    setIsOpen(false);
  }

  return (
    <div
      className={`block ${label ? "space-y-2" : ""} ${className}`}
      ref={containerRef}
    >
      {label && (
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      )}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!isOpen) updateMenuPosition();
            setIsOpen(!isOpen);
          }}
          className={`flex h-12 w-full items-center gap-2 rounded-button border bg-surface-3 px-3 text-left transition-[border-color,box-shadow,background-color] duration-200 focus:outline-none focus:ring-1 hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
              : isOpen
                ? "border-brand-gold ring-brand-gold/20"
                : "border-border-default focus:border-brand-gold focus:ring-brand-gold/20"
          }`}
        >
          {leadingIcon ? (
            <span className="text-text-muted">{leadingIcon}</span>
          ) : null}
          <span
            className={`flex-1 truncate text-sm ${selectedOption ? "text-text-primary" : "text-text-muted"}`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <NavArrowDown
            className={`h-4 w-4 text-text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen &&
          menuPosition &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[1000] rounded-card border border-border-default bg-surface-3 p-1 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
            >
              <div className="max-h-[240px] overflow-y-auto space-y-0.5 [scrollbar-width:thin] [scrollbar-color:#2E2E33_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2E2E33] hover:[&::-webkit-scrollbar-thumb]:bg-[#3A3A40]">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`flex w-full items-center rounded-[8px] px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand-gold/10 hover:text-brand-gold ${
                      option.value === value
                        ? "bg-brand-gold/10 text-brand-gold font-medium"
                        : "text-text-secondary"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )}
      </div>
      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
