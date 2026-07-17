"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Shared form styling for workspace modals/forms. These classes were
 * previously copy-pasted (INPUT_CLS / LABEL_CLS) across pages.
 */
export const fieldInputClass =
  "w-full rounded-xl border border-surface-4 bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-brand-gold/50 focus:outline-none";

export const fieldLabelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <label className={fieldLabelClass}>{label}</label>
      {hint ? <p className="mb-2 text-[11px] text-text-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${fieldInputClass} ${className}`} />;
}

export function NativeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select {...rest} className={`${fieldInputClass} ${className}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea {...rest} className={`${fieldInputClass} resize-none ${className}`} />
  );
}

/** Labelled on/off pill, brand-gold when active. */
export function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-brand-gold" : "bg-surface-4"}`}
        />
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </div>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}
