/**
 * Spinner – brand-compliant loading indicator.
 *
 * Follows the PrepIQ Brand System:
 *  - Motion: 200ms cubic-bezier(0.4,0,0.2,1) — no bounce, no elastic
 *  - Stroke: 1.5px weight, matches Iconoir icon system
 *  - Color: defaults to brand gold (#A8821F); overridable via `color`
 *  - Shape: single leading arc (engineered, not playful)
 *
 * Usage:
 *   <Spinner />
 *   <Spinner size="lg" color="#F5F5F7" />
 *   <Spinner size="sm" className="text-brand-gold" />
 */

interface SpinnerProps {
  /**
   * Visual size of the spinner.
   *  sm  → 16px  (inline with small labels)
   *  md  → 20px  (default — fits inside buttons)
   *  lg  → 32px  (page-level loading)
   *  xl  → 48px  (full-screen skeleton)
   */
  size?: "sm" | "md" | "lg" | "xl";
  /** Stroke color. Defaults to brand gold. Accepts any CSS color value. */
  color?: string;
  /** Additional classes for layout / positioning. */
  className?: string;
}

const SIZE_MAP: Record<NonNullable<SpinnerProps["size"]>, number> = {
  sm: 16,
  md: 20,
  lg: 32,
  xl: 48,
};

const STROKE_MAP: Record<NonNullable<SpinnerProps["size"]>, number> = {
  sm: 1.5,
  md: 1.5,
  lg: 2,
  xl: 2.5,
};

export function Spinner({
  size = "md",
  color = "#A8821F",
  className = "",
}: SpinnerProps) {
  const px = SIZE_MAP[size];
  const stroke = STROKE_MAP[size];
  const r = (px - stroke * 2) / 2;
  const cx = px / 2;
  const circumference = 2 * Math.PI * r;
  // Show ~75% of the circle as the "arc"
  const dash = circumference * 0.75;
  const gap = circumference * 0.25;

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      aria-label="Loading"
      role="status"
      className={`shrink-0 ${className}`}
      style={{
        animation: "prepiq-spin 700ms cubic-bezier(0.4,0,0.2,1) infinite",
      }}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeOpacity={0.15}
      />
      {/* Arc */}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={circumference * 0.25}
        transform={`rotate(-90 ${cx} ${cx})`}
      />

      {/* Keyframe injected once via a style tag — avoids Tailwind purge issues */}
      <style>{`
        @keyframes prepiq-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}
