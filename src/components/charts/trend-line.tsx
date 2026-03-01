// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { WeeklySnapshot } from "@/lib/types";

interface TrendLineChartProps {
  snapshots: WeeklySnapshot[];
}

export function PRTrendChart({ snapshots }: TrendLineChartProps) {
  const data = snapshots.map((s) => ({
    week: s.weekId.replace(/^\d{4}-/, ""),
    merged: s.github.totalMerged,
    open: s.github.totalOpen,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="merged"
          stroke="#22c55e"
          name="Merged PRs"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="open"
          stroke="#f59e0b"
          name="Open PRs"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VelocityTrendChart({ snapshots }: TrendLineChartProps) {
  const data = snapshots.map((s) => ({
    week: s.weekId.replace(/^\d{4}-/, ""),
    commits: s.github.totalCommits,
    merged: s.github.totalMerged,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis yAxisId="left" allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="commits"
          stroke="#3b82f6"
          name="Commits"
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="merged"
          stroke="#22c55e"
          name="Merged PRs"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ReviewLatencyTrendChart({ snapshots }: TrendLineChartProps) {
  const data = snapshots.map((s) => ({
    week: s.weekId.replace(/^\d{4}-/, ""),
    latency: s.github.reviewHealth.avgReviewLatencyHours ?? 0,
    unreviewed: s.github.reviewHealth.prsWithNoReview,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis yAxisId="left" allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="latency"
          stroke="#f59e0b"
          name="Avg Latency (h)"
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="unreviewed"
          stroke="#ef4444"
          name="Unreviewed Merges"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function KnowledgeTrendChart({ snapshots }: TrendLineChartProps) {
  let cumulative = 0;
  const data = snapshots.map((s) => {
    cumulative += s.knowledge.totalCreated;
    return {
      week: s.weekId.replace(/^\d{4}-/, ""),
      created: s.knowledge.totalCreated,
      updated: s.knowledge.totalUpdated,
      cumulative,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" fontSize={12} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="created"
          stroke="#3b82f6"
          name="New"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="updated"
          stroke="#8b5cf6"
          name="Updated"
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke="#6b7280"
          name="Cumulative"
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
