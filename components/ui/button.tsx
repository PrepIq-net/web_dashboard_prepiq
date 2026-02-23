import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-gold text-background hover:bg-brand-gold-hover active:bg-brand-gold-pressed",
  secondary:
    "border border-border-default bg-transparent text-text-primary hover:bg-surface-4",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-3",
};

export function Button({
  variant = "primary",
  fullWidth = false,
  leftIcon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-button px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {leftIcon ? <span className="text-current">{leftIcon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
