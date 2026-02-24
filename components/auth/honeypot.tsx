"use client";

import { InputHTMLAttributes } from "react";

type HoneypotProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * A Honeypot component to deter bots.
 * Renders a hidden field that should be left empty by humans.
 * If filled, the form submission should be rejected.
 */
export function Honeypot({ ...props }: HoneypotProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: "-9999px",
        top: "-9999px",
        opacity: 0,
        height: 0,
        width: 0,
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <input type="text" tabIndex={-1} autoComplete="new-password" {...props} />
    </div>
  );
}
