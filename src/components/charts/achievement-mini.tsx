// Copyright 2026 Fractalyze Inc. All rights reserved.

interface AchievementPoint {
  weekId: string;
  label: string;
  rate: number;
}

interface MiniAchievementBarsProps {
  data: AchievementPoint[];
  currentWeekId: string;
}

function barColor(rate: number): string {
  if (rate >= 80) return "bg-green-500 dark:bg-green-600";
  if (rate >= 50) return "bg-blue-500 dark:bg-blue-600";
  return "bg-red-400 dark:bg-red-500";
}

function textColor(rate: number): string {
  if (rate >= 80) return "text-green-600 dark:text-green-400";
  if (rate >= 50) return "text-blue-600 dark:text-blue-400";
  return "text-red-500 dark:text-red-400";
}

export function MiniAchievementBars({
  data,
  currentWeekId,
}: MiniAchievementBarsProps) {
  if (data.length === 0) return null;

  return (
    <div className="flex items-end gap-1.5">
      {data.map((d) => {
        const isCurrent = d.weekId === currentWeekId;
        const height = Math.max(d.rate, 4); // minimum visible height

        return (
          <div
            key={d.weekId}
            className="flex flex-1 flex-col items-center gap-0.5"
          >
            <span
              className={`text-[10px] font-medium ${textColor(d.rate)}`}
            >
              {d.rate}%
            </span>
            <div className="flex h-10 w-full items-end justify-center">
              <div
                className={`w-full max-w-6 rounded-t ${barColor(d.rate)} ${isCurrent ? "ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-900" : ""}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-500 dark:text-gray-400">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
