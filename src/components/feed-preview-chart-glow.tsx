/**
 * Decorative market-chart backdrop for the landing "Catalyst Feed preview"
 * card — a faint candlestick + trendline motif behind the header, echoing
 * the live tape the product actually ships instead of a plain flat panel.
 *
 * Purely illustrative: `aria-hidden`, uses the dedicated `--desk-chart-accent`
 * blue (decorative only — never used for text/actions, which stay on the
 * `--desk-live` gold). Kept deliberately subtle/low-opacity so it reads as
 * ambient texture behind the header, not a competing brand color, and is
 * masked out before it reaches the row content so it never competes with
 * real row text for contrast.
 */
export function FeedPreviewChartGlow() {
  const bars: { x: number; top: number }[] = [
    { x: 40, top: 62 },
    { x: 72, top: 70 },
    { x: 104, top: 54 },
    { x: 136, top: 58 },
    { x: 168, top: 44 },
    { x: 200, top: 48 },
    { x: 232, top: 34 },
    { x: 264, top: 38 },
    { x: 296, top: 22 },
    { x: 328, top: 26 },
    { x: 360, top: 10 },
    { x: 390, top: 15 },
  ];
  const baseline = 80;
  const linePoints = bars.map((b) => `${b.x},${b.top - 3}`).join(" ");

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-16 overflow-hidden sm:h-20"
      style={{
        maskImage: "linear-gradient(to bottom, black, transparent 92%)",
        WebkitMaskImage: "linear-gradient(to bottom, black, transparent 92%)",
      }}
    >
      <div className="feed-preview-chart-glow absolute -top-6 right-4 size-24 rounded-full bg-[var(--desk-chart-accent)] opacity-10 blur-2xl sm:right-10" />
      <svg
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {bars.map((bar) => (
          <rect
            key={bar.x}
            x={bar.x - 2.5}
            y={bar.top}
            width={5}
            height={Math.max(baseline - bar.top, 2)}
            rx={1}
            fill="var(--desk-chart-accent)"
            opacity={0.09}
          />
        ))}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--desk-chart-accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.28}
        />
      </svg>
    </div>
  );
}
