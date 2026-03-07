// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface AchievementDataPoint {
  weekId: string;
  label: string;
  rate: number;
  isCurrent: boolean;
}

interface AchievementTrendChartProps {
  data: AchievementDataPoint[];
}

function dotColor(rate: number): string {
  if (rate >= 80) return "#22c55e";
  if (rate >= 50) return "#3b82f6";
  return "#ef4444";
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: AchievementDataPoint;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;

  const fill = dotColor(payload.rate);
  const r = payload.isCurrent ? 6 : 4;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={payload.isCurrent ? "#3b82f6" : "none"}
      strokeWidth={payload.isCurrent ? 2 : 0}
    />
  );
}

export function AchievementTrendChart({ data }: AchievementTrendChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
        <Tooltip
          formatter={(value) => [`${value}%`, "Achievement"]}
          labelFormatter={(label) => `Week ${label}`}
        />
        <ReferenceLine
          y={80}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          label={{ value: "80%", position: "right", fontSize: 10, fill: "#f59e0b" }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#6366f1"
          strokeWidth={2}
          name="Achievement"
          dot={<CustomDot />}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
