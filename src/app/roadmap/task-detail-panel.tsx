// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import type { GoalStatus, WeeklyTask } from "@/lib/types";

const STATUS_ICON: Record<GoalStatus, string> = {
  done: "\u2713",
  in_progress: "\u25D0",
  not_started: "\u25CB",
};

const ICON_COLOR: Record<GoalStatus, string> = {
  done: "text-green-500",
  in_progress: "text-blue-500",
  not_started: "text-gray-400",
};

interface TaskDetailPanelProps {
  weekId: string;
  tasks: WeeklyTask[];
  onClose: () => void;
  onTaskStatusChange: (
    weekId: string,
    taskId: string,
    currentStatus: GoalStatus
  ) => void;
}

export function TaskDetailPanel({
  weekId,
  tasks,
  onClose,
  onTaskStatusChange,
}: TaskDetailPanelProps) {
  // Group by assignee
  const byAssignee = new Map<string, WeeklyTask[]>();
  for (const task of tasks) {
    if (!byAssignee.has(task.assignee)) {
      byAssignee.set(task.assignee, []);
    }
    byAssignee.get(task.assignee)!.push(task);
  }

  const now = new Date();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {weekId} Tasks
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Task list by assignee */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {[...byAssignee.entries()].map(([assignee, memberTasks]) => (
              <div key={assignee}>
                <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {assignee}
                </h3>
                <div className="space-y-2">
                  {memberTasks.map((task) => {
                    const isBlocking =
                      task.status !== "done" &&
                      task.deadline &&
                      new Date(task.deadline) < now;

                    return (
                      <div
                        key={task.id}
                        className={`rounded-lg border p-3 ${
                          isBlocking
                            ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                            : "border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() =>
                              onTaskStatusChange(weekId, task.id, task.status)
                            }
                            className={`mt-0.5 text-lg ${ICON_COLOR[task.status]} hover:opacity-70`}
                            title={`Click to cycle status (${task.status})`}
                          >
                            {STATUS_ICON[task.status]}
                          </button>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-white">
                              {task.content}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              {task.deadline && (
                                <span
                                  className={`text-xs ${
                                    isBlocking
                                      ? "font-medium text-red-600 dark:text-red-400"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {isBlocking && "! "}
                                  {task.deadline.slice(5)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
