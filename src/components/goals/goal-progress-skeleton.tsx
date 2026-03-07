// Copyright 2026 Fractalyze Inc. All rights reserved.

export function GoalProgressSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900">
      {/* Hero header skeleton */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-6 w-64 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        {/* Progress ring placeholder */}
        <div className="h-20 w-20 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Progress bar */}
      <div className="mt-5 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />

      {/* Goal card skeletons */}
      <div className="mt-5 space-y-3">
        <div className="h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Mini trend skeleton */}
      <div className="mt-5 flex gap-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-8 flex-1 rounded bg-gray-200 dark:bg-gray-700"
          />
        ))}
      </div>
    </div>
  );
}
