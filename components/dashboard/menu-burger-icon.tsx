/**
 * Sidebar menu toggle glyph.
 *
 * At rest it is an ordinary three-line menu icon drawn in the Iconoir stroke
 * language (24-unit box, 1.5 stroke, round caps, `currentColor`) so it sits
 * flush with every other icon in the rail. On hover the stack opens into a
 * burger — the top line domes into a sesame bun, the middle becomes the patty,
 * the base line curves under. One wink, in a product about food.
 *
 * Two implementation notes worth keeping:
 *
 * 1. The straight and curved forms are separate paths cross-faded against each
 *    other, not a single morphing `d`. SVG path interpolation via CSS `d` is
 *    still unsupported in Firefox, and because both forms share their
 *    endpoints the cross-fade reads as a morph anyway.
 *
 * 2. Hover is driven off the *parent's* `group` class, not the SVG's own
 *    `:hover`, so the whole 32–36px button is the trigger rather than the 16px
 *    glyph inside it.
 *
 * Timings run through the design tokens: the wink is held back by 120ms so it
 * lands as a second beat after the button acknowledges the pointer, and every
 * hover-only delay/duration is scoped to the `group-hover:` variant so the
 * reverse transition exits fast instead of dragging the delay back out.
 * `prefers-reduced-motion` is handled globally in `globals.css`.
 */

const EASE = "ease-[var(--motion-ease-standard)]";

/** Bun separation and the straight↔curved cross-fade — the wink itself. */
const WINK = `${EASE} delay-0 duration-[var(--motion-duration-fast)] group-hover:delay-[120ms] group-hover:duration-[var(--motion-duration-standard)]`;

/** Sesame lands last, once the bun has finished doming. */
const SEEDS = `${EASE} delay-0 duration-[var(--motion-duration-fast)] group-hover:delay-[200ms] group-hover:duration-[var(--motion-duration-standard)]`;

export function MenuBurgerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Top bun — lifts away from the patty as it domes. */}
      <g className={`transition-transform ${WINK} group-hover:-translate-y-[2px]`}>
        <path d="M4 8h16" className={`transition-opacity ${WINK} group-hover:opacity-0`} />
        <path
          d="M4 8Q12 3.2 20 8"
          className={`opacity-0 transition-opacity ${WINK} group-hover:opacity-100`}
        />
        {/* Seeds sit just inside the crust, on the curve's own arc. */}
        <g
          fill="currentColor"
          stroke="none"
          className={`opacity-0 transition-opacity ${SEEDS} group-hover:opacity-100`}
        >
          <circle cx="9" cy="6.8" r="0.5" />
          <circle cx="12" cy="6.4" r="0.5" />
          <circle cx="15" cy="6.8" r="0.5" />
        </g>
      </g>

      {/* Patty — the only element that takes colour, and only while hovered. */}
      <path
        d="M4 12h16"
        className={`transition-colors ${WINK} group-hover:stroke-brand-gold`}
      />

      {/* Base bun — settles under the patty. */}
      <g className={`transition-transform ${WINK} group-hover:translate-y-[2px]`}>
        <path d="M4 16h16" className={`transition-opacity ${WINK} group-hover:opacity-0`} />
        <path
          d="M4 16Q12 19.2 20 16"
          className={`opacity-0 transition-opacity ${WINK} group-hover:opacity-100`}
        />
      </g>
    </svg>
  );
}
