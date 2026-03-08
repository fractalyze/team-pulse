// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ClaudeCodeModelAggregation } from "@/lib/types";

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "#8b5cf6",
  "claude-sonnet-4-6": "#3b82f6",
  "claude-haiku-4-5-20251001": "#22c55e",
};

const DEFAULT_COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

interface ModelBreakdownChartProps {
  byModel: ClaudeCodeModelAggregation[];
}

export function ModelBreakdownChart({ byModel }: ModelBreakdownChartProps) {
  const data = byModel.map((m) => ({
    model: m.model.replace(/^claude-/, ""),
    cost: Math.round(m.costCents) / 100,
    fullModel: m.model,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No model data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `$${v}`}
          fontSize={12}
        />
        <YAxis
          type="category"
          dataKey="model"
          fontSize={12}
          width={120}
        />
        <Tooltip
          formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "Cost"]}
        />
        <Bar dataKey="cost" name="Cost">
          {data.map((entry, index) => (
            <Cell
              key={entry.fullModel}
              fill={
                MODEL_COLORS[entry.fullModel] ??
                DEFAULT_COLORS[index % DEFAULT_COLORS.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
