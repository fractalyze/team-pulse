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
import type { ClaudeCodeUserAggregation } from "@/lib/types";

interface EfficiencyChartProps {
  byUser: ClaudeCodeUserAggregation[];
  teamMap?: Record<string, string>;
}

function getEfficiencyColor(cache: number, accept: number): string {
  if (cache > 0.5 && accept > 0.8) return "#22c55e"; // green
  if (cache > 0.3 && accept > 0.6) return "#f59e0b"; // yellow
  return "#ef4444"; // red
}

export function EfficiencyChart({ byUser, teamMap }: EfficiencyChartProps) {
  if (byUser.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No user data
      </div>
    );
  }

  const data = byUser.map((u) => {
    const displayName = teamMap?.[u.email] ?? u.email.split("@")[0];
    return {
      name: displayName,
      cache: Math.round(u.cacheReadRatio * 100),
      accept: Math.round(u.acceptanceRate * 100),
      color: getEfficiencyColor(u.cacheReadRatio, u.acceptanceRate),
    };
  });

  return (
    <div className="space-y-4">
      {/* Cache Read % bar chart */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          Cache Read % (higher = more efficient)
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
            <YAxis type="category" dataKey="name" fontSize={12} width={100} />
            <Tooltip formatter={(value: number | undefined) => [`${value ?? 0}%`, "Cache Read"]} />
            <Bar dataKey="cache" name="Cache Read %">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Accept % bar chart */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          Tool Acceptance % (higher = better prompts)
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
            <YAxis type="category" dataKey="name" fontSize={12} width={100} />
            <Tooltip formatter={(value: number | undefined) => [`${value ?? 0}%`, "Acceptance"]} />
            <Bar dataKey="accept" name="Acceptance %">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
