"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CategoryCount } from "@/lib/catalysts/analytics";

/**
 * Horizontal bar chart of catalysts per event category. Amber only on the
 * top bar (echoing `MaterialityBadge`'s "amber only for High") - the rest
 * stay grayscale, matching the mono-desk category chips elsewhere.
 */
export function CategoryBreakdownChart({ data }: { data: CategoryCount[] }) {
  const top = data.slice(0, 8);

  if (top.length === 0) {
    return <EmptyChart label="No catalysts in this window yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, top.length * 34)}>
      <BarChart
        data={top}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
        barCategoryGap={10}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={132}
          tickLine={false}
          axisLine={false}
          tick={{
            fill: "var(--desk-text-secondary)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
          }}
        />
        <Tooltip
          cursor={{ fill: "var(--desk-overlay-soft)" }}
          contentStyle={{
            background: "var(--desk-panel)",
            border: "1px solid var(--desk-border-strong)",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--desk-text)",
          }}
          labelStyle={{ color: "var(--desk-text-dim)" }}
          formatter={(value) => [value, "Catalysts"]}
        />
        <Bar dataKey="count" radius={4} maxBarSize={18}>
          {top.map((entry, index) => (
            <Cell
              key={entry.category}
              fill={index === 0 ? "var(--desk-live)" : "var(--desk-text-dim)"}
              fillOpacity={index === 0 ? 1 : 0.35}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center font-mono text-xs text-[var(--desk-text-dim)]">
      {label}
    </div>
  );
}
