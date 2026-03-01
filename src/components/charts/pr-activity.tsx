// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { RepoPRSummary } from "@/lib/types";

interface PRActivityChartProps {
  repos: RepoPRSummary[];
}

export function PRActivityChart({ repos }: PRActivityChartProps) {
  const data = repos
    .filter((r) => r.totalMerged > 0 || r.totalOpen > 0)
    .map((r) => ({
      repo: r.repo,
      merged: r.totalMerged,
      open: r.totalOpen,
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No PR activity this week
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="repo" fontSize={12} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="merged" fill="#22c55e" name="Merged" />
        <Bar dataKey="open" fill="#f59e0b" name="Open" />
      </BarChart>
    </ResponsiveContainer>
  );
}
