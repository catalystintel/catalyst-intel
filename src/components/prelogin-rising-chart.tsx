/**
 * Atmospheric rising chart for the prelogin landing hero — a line/area motif
 * over the square grid. Overall upward trend with a steeper climb near the end.
 *
 * Purely decorative (`aria-hidden`). Full-bleed behind the hero (escapes the
 * content max-width) so the rise reads across the visual plane without covering
 * CTA copy. CSS draw-on animation; static final state is the default (and under
 * `prefers-reduced-motion`).
 */
export function PreloginRisingChart() {
  // ViewBox y grows downward — smaller y = higher price. Gentle climb through
  // mid-path, then a sharper rise in the last quarter.
  const linePath =
    "M0 86 C 120 84, 180 82, 260 78 C 340 74, 390 80, 460 70 C 520 60, 560 66, 620 54 C 680 42, 720 46, 760 34 C 800 22, 830 24, 870 14 C 910 4, 940 8, 970 2.5 C 985 0.8, 995 0.4, 1000 0.2";
  const areaPath = `${linePath} L 1000 100 L 0 100 Z`;

  return (
    <div
      aria-hidden
      className="prelogin-rising-chart pointer-events-none absolute top-0 left-1/2 z-0 h-[min(72vh,580px)] w-screen max-w-none -translate-x-1/2 overflow-hidden"
    >
      <div className="absolute top-[20%] right-[10%] size-64 rounded-full bg-[var(--desk-chart-accent,#2563eb)] opacity-[0.18] blur-3xl sm:size-80" />
      <div className="absolute top-[10%] right-[28%] size-40 rounded-full bg-[color-mix(in_srgb,#7c3aed_55%,var(--desk-chart-accent,#2563eb))] opacity-[0.11] blur-3xl" />
      <div className="absolute right-[6%] bottom-[16%] size-32 rounded-full bg-[var(--desk-positive,#10b981)] opacity-[0.1] blur-2xl" />

      <svg
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="prelogin-rising-area" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--desk-chart-accent, #2563eb)"
              stopOpacity="0.48"
            />
            <stop
              offset="40%"
              stopColor="var(--desk-chart-accent, #2563eb)"
              stopOpacity="0.16"
            />
            <stop
              offset="100%"
              stopColor="var(--desk-chart-accent, #2563eb)"
              stopOpacity="0"
            />
          </linearGradient>
          <linearGradient
            id="prelogin-rising-stroke"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop
              offset="0%"
              stopColor="var(--desk-chart-accent, #2563eb)"
              stopOpacity="0.2"
            />
            <stop
              offset="45%"
              stopColor="var(--desk-chart-accent, #2563eb)"
              stopOpacity="0.7"
            />
            <stop
              offset="82%"
              stopColor="var(--desk-chart-accent, #2563eb)"
              stopOpacity="0.95"
            />
            <stop
              offset="100%"
              stopColor="var(--desk-positive, #10b981)"
              stopOpacity="1"
            />
          </linearGradient>
          <linearGradient id="prelogin-rising-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="12%" stopColor="white" stopOpacity="0.18" />
            <stop offset="28%" stopColor="white" stopOpacity="0.55" />
            <stop offset="48%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id="prelogin-rising-mask">
            <rect width="1000" height="100" fill="url(#prelogin-rising-fade)" />
          </mask>
        </defs>

        <g mask="url(#prelogin-rising-mask)">
          <path
            d={areaPath}
            fill="url(#prelogin-rising-area)"
            className="prelogin-rising-chart-area"
          />
          <path
            d={linePath}
            fill="none"
            stroke="url(#prelogin-rising-stroke)"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            className="prelogin-rising-chart-line"
          />
          <circle
            cx="1000"
            cy="0.2"
            r="3.8"
            fill="var(--desk-positive, #10b981)"
            className="prelogin-rising-chart-dot"
          />
        </g>
      </svg>
    </div>
  );
}
