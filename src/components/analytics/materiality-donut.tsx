"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { MaterialityCounts } from "@/lib/catalysts/analytics";
import { EmptyChart } from "@/components/analytics/category-breakdown-chart";

/** Same High/Med/Low colors as `MaterialityBadge` - amber only for High. */
const TIER_COLORS: Record<"high" | "medium" | "low", string> = {
  high: "var(--desk-live)",
  medium: "var(--desk-text-secondary)",
  low: "var(--desk-text-dim)",
};

const TIER_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function MaterialityDonut({ counts }: { counts: MaterialityCounts }) {
  const data = (["high", "medium", "low"] as const).map((tier) => ({
    tier,
    label: TIER_LABELS[tier],
    value: counts[tier],
  }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <EmptyChart label="No catalysts in this window yet." />;
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={58}
            outerRadius={80}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--desk-panel)",
              border: "1px solid var(--desk-border-strong)",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--desk-text)",
            }}
            formatter={(value, label) => [value, label]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-2xl font-semibold text-[var(--desk-text)] tabular-nums">
          {total}
        </p>
        <p className="font-mono text-[0.6rem] tracking-[0.12em] text-[var(--desk-text-dim)] uppercase">
          Total
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {data.map((entry) => (
          <span
            key={entry.tier}
            className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] text-[var(--desk-text-secondary)]"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: TIER_COLORS[entry.tier] }}
            />
            {entry.label}
            <span className="text-[var(--desk-text-dim)] tabular-nums">
              {entry.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
