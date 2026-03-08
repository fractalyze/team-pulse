// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CostTrendChartProps {
  dailyCosts: { date: string; costCents: number }[];
}

export function CostTrendChart({ dailyCosts }: CostTrendChartProps) {
  const data = dailyCosts.map((d) => ({
    date: d.date.slice(5), // MM-DD
    cost: Math.round(d.costCents) / 100,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No cost data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis
          allowDecimals={true}
          tickFormatter={(v: number) => `$${v}`}
          fontSize={12}
        />
        <Tooltip
          formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "Cost"]}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#8b5cf6"
          name="Daily Cost"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
