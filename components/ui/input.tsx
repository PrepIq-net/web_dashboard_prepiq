import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  error?: string;
};

export function Input({
  label,
  leadingIcon,
  trailingIcon,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="block space-y-2">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <label
        className={`flex h-12 items-center gap-2 rounded-button border bg-surface-3 px-3 transition-[border-color,box-shadow] duration-200 focus-within:ring-1 ${
          error
            ? "border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20"
            : "border-border-default focus-within:border-brand-gold focus-within:ring-brand-gold/20"
        }`}
      >
        {leadingIcon ? (
          <span className="text-text-muted">{leadingIcon}</span>
        ) : null}
        <input
          className={`w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:text-text-disabled ${className}`}
          {...props}
        />
        {trailingIcon ? (
          <span className="text-text-muted">{trailingIcon}</span>
        ) : null}
      </label>
      {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}
    </div>
  );
}
