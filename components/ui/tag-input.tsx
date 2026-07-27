"use client";

import { useState, type KeyboardEvent } from "react";
import { Xmark } from "iconoir-react";

type TagInputProps = {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  hint?: string;
  maxTags?: number;
  disabled?: boolean;
  /** Accessible name for each entry's remove button; `{tag}` is substituted. */
  removeLabel?: string;
};

/**
 * Free-text list editor for demand-context fields (venues, teams, keywords).
 * Enter or comma commits an entry; Backspace on an empty field removes the last
 * one. Duplicates are dropped rather than rejected with an error — a repeated
 * venue name is a slip, not something worth blocking a save over.
 */
export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxTags = 25,
  disabled = false,
  removeLabel = "Remove {tag}",
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const atCapacity = value.length >= maxTags;

  function commit(raw: string) {
    const entry = raw.trim();
    if (!entry || atCapacity) return;
    if (value.some((tag) => tag.toLowerCase() === entry.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, entry]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-button border border-border-default bg-surface-3 px-3 py-2 transition-colors focus-within:border-brand-gold focus-within:ring-1 focus-within:ring-brand-gold/20">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-surface-4 bg-surface-2 pl-2.5 pr-1 text-xs text-text-secondary"
          >
            {tag}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((entry) => entry !== tag))}
              aria-label={removeLabel.replace("{tag}", tag)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-muted transition-colors hover:text-status-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 disabled:opacity-50"
            >
              <Xmark className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          // The visible label sits outside the bordered wrapper, so the input
          // needs its own accessible name.
          aria-label={label}
          disabled={disabled || atCapacity}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="h-7 min-w-[120px] flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed"
        />
      </div>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
