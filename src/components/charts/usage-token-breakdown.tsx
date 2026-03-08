// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TokenBreakdownChartProps {
  tokenBreakdown: {
    input: number;
    output: number;
    cacheCreation: number;
    cacheRead: number;
  };
}

const TOKEN_COLORS = {
  input: "#3b82f6",
  output: "#8b5cf6",
  cacheCreation: "#f59e0b",
  cacheRead: "#22c55e",
};

export function TokenBreakdownChart({
  tokenBreakdown,
}: TokenBreakdownChartProps) {
  const total =
    tokenBreakdown.input +
    tokenBreakdown.output +
    tokenBreakdown.cacheCreation +
    tokenBreakdown.cacheRead;

  if (total === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500">
        No token data
      </div>
    );
  }

  const data = [
    {
      name: "Tokens",
      input: tokenBreakdown.input,
      output: tokenBreakdown.output,
      cacheCreation: tokenBreakdown.cacheCreation,
      cacheRead: tokenBreakdown.cacheRead,
    },
  ];

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  return (
    <div>
      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={data} layout="vertical" stackOffset="expand">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => {
              const v = value ?? 0;
              const n = name ?? "";
              const labels: Record<string, string> = {
                input: "Input",
                output: "Output",
                cacheCreation: "Cache Creation",
                cacheRead: "Cache Read",
              };
              return [`${fmt(v)} (${pct(v)})`, labels[n] ?? n];
            }}
          />
          <Bar
            dataKey="input"
            stackId="tokens"
            fill={TOKEN_COLORS.input}
            name="input"
            radius={[4, 0, 0, 4]}
          />
          <Bar
            dataKey="output"
            stackId="tokens"
            fill={TOKEN_COLORS.output}
            name="output"
          />
          <Bar
            dataKey="cacheCreation"
            stackId="tokens"
            fill={TOKEN_COLORS.cacheCreation}
            name="cacheCreation"
          />
          <Bar
            dataKey="cacheRead"
            stackId="tokens"
            fill={TOKEN_COLORS.cacheRead}
            name="cacheRead"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: TOKEN_COLORS.input }}
          />
          Input {pct(tokenBreakdown.input)}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: TOKEN_COLORS.output }}
          />
          Output {pct(tokenBreakdown.output)}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: TOKEN_COLORS.cacheCreation }}
          />
          Cache Write {pct(tokenBreakdown.cacheCreation)}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: TOKEN_COLORS.cacheRead }}
          />
          Cache Read {pct(tokenBreakdown.cacheRead)}
        </span>
      </div>
    </div>
  );
}
