"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  NavArrowLeft,
  NavArrowRight,
  ArrowRight,
} from "iconoir-react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  isToday,
  startOfDay,
} from "date-fns";

interface OperationalCalendarProps {
  label: string;
  value: string; // ISO date string YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * OperationalCalendar
 * A premium, space-efficient date picker designed for high-frequency kitchen operations.
 * Follows the PrepIQ Brand System: Precise, Structured, and Premium.
 */
export function OperationalCalendar({
  label,
  value,
  onChange,
  className = "",
  disabled = false,
}: OperationalCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse the input value safely. Value is YYYY-MM-DD
  const parseValue = (val: string) => {
    const [year, month, day] = val.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const selectedDate = parseValue(value);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const popoverWidth = 340;

    let left = rect.left;
    // If it would go off the right edge, align to right of trigger
    if (left + popoverWidth > viewportWidth) {
      left = rect.right - popoverWidth;
    }

    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.max(16, left),
      width: popoverWidth,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      updateMenuPosition();
      window.addEventListener("resize", updateMenuPosition);
      window.addEventListener("scroll", updateMenuPosition, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleDateSelect = (date: Date) => {
    const isoString = format(date, "yyyy-MM-dd");
    onChange(isoString);
    setIsOpen(false);
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between px-1 pb-4">
      <h2 className="font-display text-sm font-semibold tracking-tight text-text-primary">
        {format(currentMonth, "MMMM yyyy")}
      </h2>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-button border border-border-default bg-surface-3 text-text-secondary transition-all hover:border-brand-gold hover:text-brand-gold active:scale-95"
        >
          <NavArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-button border border-border-default bg-surface-3 text-text-secondary transition-all hover:border-brand-gold hover:text-brand-gold active:scale-95"
        >
          <NavArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const renderDays = () => {
    const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    return (
      <div className="grid grid-cols-7 mb-2">
        {dayLabels.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-bold uppercase tracking-widest text-text-muted/60"
          >
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const d = day;
        const isSelected = isSameDay(d, selectedDate);
        const isCurrMonth = isSameMonth(d, monthStart);
        const isTod = isToday(d);

        days.push(
          <button
            key={d.getTime()}
            type="button"
            onClick={() => handleDateSelect(d)}
            className={`group relative flex h-10 w-full items-center justify-center rounded-lg text-sm transition-all duration-150 ${
              !isCurrMonth
                ? "opacity-20 pointer-events-none"
                : "hover:bg-brand-gold/10"
            } ${
              isSelected
                ? "bg-brand-gold text-surface-1 font-bold shadow-lg shadow-brand-gold/20"
                : "text-text-primary"
            }`}
          >
            <span className="relative z-10">{format(d, "d")}</span>
            {isTod && !isSelected && (
              <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand-gold" />
            )}
            {!isSelected && isCurrMonth && (
              <div className="absolute inset-0 rounded-lg border border-transparent group-hover:border-brand-gold/30 transition-colors" />
            )}
          </button>,
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 gap-1" key={day.getTime()}>
          {days}
        </div>,
      );
      days = [];
    }
    return <div className="space-y-1">{rows}</div>;
  };

  return (
    <div className={`block space-y-2 ${className}`} ref={containerRef}>
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-12 w-full items-center gap-3 rounded-button border bg-surface-3 px-3 text-left transition-all duration-200 hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-50 ${
            isOpen
              ? "border-brand-gold ring-2 ring-brand-gold/15"
              : "border-border-default focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/15"
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-4 text-brand-gold">
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold tracking-tight text-text-primary">
              {format(selectedDate, "EEE, MMM d, yyyy")}
            </span>
            {isToday(selectedDate) && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold/80 animate-pulse">
                Live Now
              </span>
            )}
          </div>
          <div className="flex h-5 w-5 items-center justify-center text-text-muted">
            <ArrowRight
              className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            />
          </div>
        </button>

        {isOpen &&
          menuPosition &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[1000] overflow-hidden rounded-card border border-border-default bg-surface-2 shadow-2xl animate-fade-in"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
            >
              <div className="p-4 bg-surface-2">
                {renderHeader()}
                {renderDays()}
                {renderCells()}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border-default bg-surface-3/50 p-3 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => handleDateSelect(new Date())}
                  className="flex items-center justify-center gap-2 rounded-button border border-border-default bg-surface-2 py-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary transition-all hover:border-brand-gold/50 hover:text-brand-gold active:scale-[0.98]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleDateSelect(addDays(new Date(), 1))}
                  className="flex items-center justify-center gap-2 rounded-button border border-border-default bg-surface-2 py-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary transition-all hover:border-brand-gold/50 hover:text-brand-gold active:scale-[0.98]"
                >
                  Tomorrow
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
