"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { EmptyChart } from "@/components/analytics/category-breakdown-chart";
import type { AnalyticsWindow } from "@/lib/catalysts/analytics-window";
import type { VolumePoint } from "@/lib/catalysts/analytics";

function formatBucketLabel(iso: string, window: AnalyticsWindow): string {
  const d = new Date(iso);
  if (window === "24h") {
    return d.toLocaleTimeString("en-US", { hour: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Catalyst volume over the selected window - hourly buckets for 24h, daily otherwise. */
export function VolumeTrendChart({
  data,
  window,
}: {
  data: VolumePoint[];
  window: AnalyticsWindow;
}) {
  if (data.every((p) => p.count === 0)) {
    return <EmptyChart label="No catalysts in this window yet." />;
  }

  const chartData = data.map((p) => ({
    ...p,
    label: formatBucketLabel(p.bucketStart, window),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={chartData}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--desk-live)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--desk-live)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--desk-border)" }}
          tick={{
            fill: "var(--desk-text-dim)",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <Tooltip
          cursor={{ stroke: "var(--desk-border-strong)" }}
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
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--desk-live)"
          strokeWidth={2}
          fill="url(#volumeFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
