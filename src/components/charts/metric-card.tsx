// Copyright 2026 Fractalyze Inc. All rights reserved.

interface MetricCardProps {
  title: string;
  value: number | string;
  delta?: number | null;
  subtitle?: string;
  color?: "green" | "yellow" | "red" | "blue" | "purple";
}

const colorMap = {
  green: "border-green-500 bg-green-50 dark:bg-green-950",
  yellow: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
  red: "border-red-500 bg-red-50 dark:bg-red-950",
  blue: "border-blue-500 bg-blue-50 dark:bg-blue-950",
  purple: "border-purple-500 bg-purple-50 dark:bg-purple-950",
};

export function MetricCard({
  title,
  value,
  delta,
  subtitle,
  color = "blue",
}: MetricCardProps) {
  const deltaText =
    delta !== undefined && delta !== null
      ? `${delta >= 0 ? "+" : ""}${delta}`
      : null;
  const deltaColor =
    delta !== undefined && delta !== null
      ? delta > 0
        ? "text-green-600"
        : delta < 0
          ? "text-red-600"
          : "text-gray-500"
      : "";

  return (
    <div
      className={`rounded-lg border-l-4 p-4 shadow-sm ${colorMap[color]} bg-white dark:bg-gray-900`}
    >
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {title}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        {deltaText && (
          <span className={`text-sm font-medium ${deltaColor}`}>
            {deltaText}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}
