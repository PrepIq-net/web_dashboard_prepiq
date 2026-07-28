import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

/**
 * Small status pill.
 *
 * The label is text-primary on every tinted variant except the gold one:
 * per docs/DESIGN.md §8 the status hues fail AA below 18.66px, and this is
 * 10px type. brand-gold is one of the few that passes at this size.
 */
export function Badge({
  className = "",
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-brand-gold/10 text-brand-gold",
    secondary: "border-transparent bg-surface-2 text-text-muted",
    destructive: "border-status-critical/40 bg-status-critical/10 text-text-primary",
    outline: "border-surface-4 text-text-muted",
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}
