import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Input({
  label,
  leadingIcon,
  trailingIcon,
  className = "",
  ...props
}: InputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-button border border-border-default bg-surface-3 px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-brand-gold focus-within:shadow-[0_0_0_1px_rgba(168,130,31,0.45)]">
        {leadingIcon ? <span className="text-text-muted">{leadingIcon}</span> : null}
        <input
          className={`w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed disabled:text-text-disabled ${className}`}
          {...props}
        />
        {trailingIcon ? <span className="text-text-muted">{trailingIcon}</span> : null}
      </span>
    </label>
  );
}
