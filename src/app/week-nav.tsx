// Copyright 2026 Fractalyze Inc. All rights reserved.

import Link from "next/link";
import type { DashboardSummary } from "@/lib/types";

interface WeekNavProps {
  summary: DashboardSummary;
}

export function WeekNav({ summary }: WeekNavProps) {
  const { current, previousWeekId, nextWeekId, allWeekIds } = summary;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {previousWeekId ? (
          <Link
            href={`/week/${previousWeekId}`}
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title={previousWeekId}
          >
            &larr;
          </Link>
        ) : (
          <span className="px-2 py-1 text-gray-300 dark:text-gray-600">
            &larr;
          </span>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {current.weekId}
        </h1>
        {nextWeekId ? (
          <Link
            href={`/week/${nextWeekId}`}
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title={nextWeekId}
          >
            &rarr;
          </Link>
        ) : (
          <span className="px-2 py-1 text-gray-300 dark:text-gray-600">
            &rarr;
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {allWeekIds.slice(0, 8).map((id) => (
          <Link
            key={id}
            href={id === allWeekIds[0] ? "/" : `/week/${id}`}
            className={`rounded px-2.5 py-1 text-sm ${
              id === current.weekId
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {id.replace(/^\d{4}-/, "")}
          </Link>
        ))}
      </div>
    </div>
  );
}
