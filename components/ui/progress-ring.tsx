"use client";

type ProgressRingProps = {
  /** 0-1 under the estimate, above 1 once it is overrun. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Rendered inside the ring. Keep it to three or four characters. */
  label?: string;
  /** Screen-reader description; the ring is meaningless without one. */
  ariaLabel: string;
  className?: string;
};

/**
 * A small progress ring. Inline SVG — the repo has no charting or animation
 * library on the client, and this needs neither.
 *
 * Overrun is shown, not hidden: past 1.0 the arc completes and turns to the
 * warning tone rather than clamping, because a task at 130% of its estimate
 * and one at exactly 100% are different facts for whoever is reading the board.
 */
export function ProgressRing({
  value,
  size = 28,
  strokeWidth = 3,
  label,
  ariaLabel,
  className = "",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(value, 1));
  const overrun = value > 1;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={overrun ? "stroke-status-warning" : "stroke-status-info"}
          style={{
            transition: "stroke-dashoffset var(--motion-duration-standard) var(--motion-ease-standard)",
          }}
        />
      </svg>
      {label ? (
        <span
          className={`absolute text-[9px] font-semibold tabular-nums ${
            overrun ? "text-status-warning" : "text-text-secondary"
          }`}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
