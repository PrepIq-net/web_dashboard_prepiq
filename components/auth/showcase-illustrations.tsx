/**
 * Small brand-styled line-art used by ShowcaseCarousel for slides that don't
 * (yet) have commissioned photography — see the "Analysis" and "Planning"
 * entries in components/auth/showcase-carousel.tsx.
 *
 * These are intentionally abstract ("visual starting point" per the auth
 * redesign brief) rather than literal screenshots, and are meant to be easy
 * to swap out once real illustration/photography lands for those two slides.
 */

export function AnalysisMotif() {
  return (
    <svg
      viewBox="0 0 400 500"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* scattered, noisy data on the left resolving into one clean line on the right */}
      <g className="stroke-text-primary/25" strokeWidth="1.5" strokeLinecap="round">
        <line x1="30" y1="120" x2="46" y2="132" />
        <line x1="55" y1="90" x2="68" y2="104" />
        <line x1="20" y1="200" x2="38" y2="192" />
        <line x1="70" y1="230" x2="84" y2="244" />
        <line x1="40" y1="300" x2="58" y2="292" />
        <line x1="90" y1="160" x2="104" y2="172" />
        <line x1="25" y1="360" x2="42" y2="352" />
        <line x1="75" y1="380" x2="90" y2="392" />
      </g>
      <g className="fill-brand-gold-hover/60">
        <circle cx="130" cy="180" r="2.5" />
        <circle cx="150" cy="260" r="2" />
        <circle cx="110" cy="330" r="2" />
      </g>
      <path
        d="M60 250 Q 180 250 260 220"
        className="stroke-brand-gold-hover"
        strokeWidth="1.6"
        strokeOpacity="0.7"
        fill="none"
        strokeDasharray="2 5"
      />
      <path
        d="M260 220 Q 320 205 400 190"
        className="stroke-brand-gold"
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="330" cy="205" r="4.5" className="fill-brand-gold" />
    </svg>
  );
}

export function PlanningMotif() {
  const cells = [
    { x: 0, y: 0, pin: false },
    { x: 1, y: 0, pin: true },
    { x: 2, y: 0, pin: false },
    { x: 0, y: 1, pin: false },
    { x: 1, y: 1, pin: false },
    { x: 2, y: 1, pin: true },
    { x: 0, y: 2, pin: true },
    { x: 1, y: 2, pin: false },
    { x: 2, y: 2, pin: false },
  ];
  const cellSize = 34;
  const gap = 8;
  const originX = 40;
  const originY = 140;

  return (
    <svg
      viewBox="0 0 400 500"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {cells.map((cell) => {
        const x = originX + cell.x * (cellSize + gap);
        const y = originY + cell.y * (cellSize + gap);
        return (
          <g key={`${cell.x}-${cell.y}`}>
            <rect
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx="4"
              className="stroke-text-primary/20"
              strokeWidth="1.2"
              fill="none"
            />
            {cell.pin ? (
              <circle
                cx={x + cellSize / 2}
                cy={y + cellSize / 2}
                r="3.5"
                className="fill-brand-gold"
              />
            ) : null}
          </g>
        );
      })}
      {/* signals converging into a single forecast curve */}
      <path
        d="M150 175 Q 230 260 260 300"
        className="stroke-brand-gold-hover"
        strokeWidth="1.4"
        strokeOpacity="0.55"
        strokeDasharray="3 4"
        fill="none"
      />
      <path
        d="M108 226 Q 200 270 260 300"
        className="stroke-brand-gold-hover"
        strokeWidth="1.4"
        strokeOpacity="0.55"
        strokeDasharray="3 4"
        fill="none"
      />
      <path
        d="M260 300 C 320 300 340 230 380 150"
        className="stroke-brand-gold"
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="380" cy="150" r="4.5" className="fill-brand-gold" />
    </svg>
  );
}
