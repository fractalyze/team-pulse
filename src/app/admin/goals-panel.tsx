// Copyright 2026 Fractalyze Inc. All rights reserved.

"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  GoalStatus,
  HalfYearObjective,
  MonthlyGoal,
  WeeklyTask,
  TeamMember,
} from "@/lib/types";

type Tab = "half" | "month" | "week";

const STATUS_CYCLE: GoalStatus[] = ["not_started", "in_progress", "done"];
const STATUS_ICON: Record<GoalStatus, string> = {
  done: "\u2713",
  in_progress: "\u25D0",
  not_started: "\u25CB",
};
const STATUS_COLOR: Record<GoalStatus, string> = {
  done: "text-green-500",
  in_progress: "text-blue-500",
  not_started: "text-gray-400",
};

function currentHalf(): string {
  const now = new Date();
  const year = now.getFullYear();
  const half = now.getMonth() < 6 ? "H1" : "H2";
  return `${year}-${half}`;
}

function currentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function currentWeekId(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function prevWeekId(weekId: string): string {
  const [yearStr, weekStr] = weekId.split("-W");
  let year = parseInt(yearStr, 10);
  let week = parseInt(weekStr, 10) - 1;
  if (week < 1) {
    year -= 1;
    const dec28 = new Date(Date.UTC(year, 11, 28));
    const d = new Date(
      Date.UTC(dec28.getFullYear(), dec28.getMonth(), dec28.getDate())
    );
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    week = Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7);
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function GoalsPanel() {
  const [tab, setTab] = useState<Tab>("half");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Goals
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          반기 / 월간 / 주간 목표 관리
        </p>
      </div>

      <div className="flex gap-1">
        {(["half", "month", "week"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {t === "half" ? "반기" : t === "month" ? "월간" : "주간"}
          </button>
        ))}
      </div>

      {tab === "half" && <HalfYearTab />}
      {tab === "month" && <MonthlyTab />}
      {tab === "week" && <WeeklyTab />}
    </div>
  );
}

// --- Half-Year Tab ---

function HalfYearTab() {
  const [period, setPeriod] = useState(currentHalf());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/goals?tier=half&period=${period}`);
    const { data } = await res.json();
    if (data) {
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
    } else {
      setTitle("");
      setDescription("");
    }
    setLoaded(true);
  }, [period]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "half", period, title, description }),
    });
    setSaving(false);
  }

  const year = new Date().getFullYear();
  const periods = [
    `${year}-H1`,
    `${year}-H2`,
    `${year + 1}-H1`,
    `${year + 1}-H2`,
  ];

  if (!loaded) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Period
        </label>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="반기 목표 제목"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (선택)"
        rows={2}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />
      <button
        onClick={save}
        disabled={saving || !title.trim()}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// --- Monthly Tab ---

function MonthlyTab() {
  const [month, setMonth] = useState(currentMonth());
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/goals?tier=month&month=${month}`);
    const { data } = await res.json();
    setGoals(data ?? []);
    setLoaded(true);
  }, [month]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  async function save(updatedGoals: MonthlyGoal[]) {
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "month", month, goals: updatedGoals }),
    });
    setSaving(false);
  }

  function addGoal() {
    const newGoal: MonthlyGoal = {
      id: crypto.randomUUID(),
      month,
      title: "",
      status: "not_started",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setGoals([...goals, newGoal]);
  }

  function updateGoal(id: string, updates: Partial<MonthlyGoal>) {
    setGoals(
      goals.map((g) =>
        g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
      )
    );
  }

  function removeGoal(id: string) {
    setGoals(goals.filter((g) => g.id !== id));
  }

  function cycleStatus(id: string) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    const nextIdx =
      (STATUS_CYCLE.indexOf(goal.status) + 1) % STATUS_CYCLE.length;
    updateGoal(id, { status: STATUS_CYCLE[nextIdx] });
  }

  if (!loaded) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Month
        </label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      <div className="space-y-2">
        {goals.map((goal) => (
          <div key={goal.id} className="flex items-center gap-2">
            <button
              onClick={() => cycleStatus(goal.id)}
              className={`text-lg ${STATUS_COLOR[goal.status]}`}
              title={goal.status}
            >
              {STATUS_ICON[goal.status]}
            </button>
            <input
              type="text"
              value={goal.title}
              onChange={(e) => updateGoal(goal.id, { title: e.target.value })}
              placeholder="목표 제목"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              onClick={() => removeGoal(goal.id)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={addGoal}
          className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
        >
          + Add
        </button>
        <button
          onClick={() => save(goals)}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

// --- Weekly Tab ---

function WeeklyTab() {
  const [weekId, setWeekId] = useState(currentWeekId());
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [tasksRes, teamRes] = await Promise.all([
      fetch(`/api/goals?tier=week&weekId=${weekId}`),
      fetch("/api/goals?tier=team"),
    ]);
    const { data: tasksData } = await tasksRes.json();
    const { data: teamData } = await teamRes.json();
    setTasks(tasksData ?? []);
    setTeam(teamData ?? []);
    setLoaded(true);
  }, [weekId]);

  useEffect(() => {
    setLoaded(false);
    load();
  }, [load]);

  async function save(updatedTasks: WeeklyTask[]) {
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "week", weekId, tasks: updatedTasks }),
    });
    setSaving(false);
  }

  function addTask(assignee: string) {
    const newTask: WeeklyTask = {
      id: crypto.randomUUID(),
      weekId,
      assignee,
      content: "",
      deadline: "",
      status: "not_started",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks([...tasks, newTask]);
  }

  function updateTask(id: string, updates: Partial<WeeklyTask>) {
    setTasks(
      tasks.map((t) =>
        t.id === id
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t
      )
    );
  }

  function removeTask(id: string) {
    setTasks(tasks.filter((t) => t.id !== id));
  }

  function cycleStatus(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const nextIdx =
      (STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length;
    updateTask(id, { status: STATUS_CYCLE[nextIdx] });
  }

  async function copyFromPrevWeek() {
    const prev = prevWeekId(weekId);
    const res = await fetch(`/api/goals?tier=week&weekId=${prev}`);
    const { data } = await res.json();
    if (!data || data.length === 0) return;
    const incomplete = (data as WeeklyTask[]).filter(
      (t) => t.status !== "done"
    );
    const copied = incomplete.map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      weekId,
      status: "not_started" as GoalStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    setTasks([...tasks, ...copied]);
  }

  if (!loaded) return <p className="text-sm text-gray-500">Loading...</p>;

  const memberNames = team.map((m) => m.name);
  const tasksByMember = new Map<string, WeeklyTask[]>();
  for (const name of memberNames) {
    tasksByMember.set(
      name,
      tasks.filter((t) => t.assignee === name)
    );
  }
  // Also include tasks for members not in current team list
  const knownNames = new Set(memberNames);
  for (const t of tasks) {
    if (!knownNames.has(t.assignee)) {
      if (!tasksByMember.has(t.assignee)) {
        tasksByMember.set(t.assignee, []);
        memberNames.push(t.assignee);
      }
      tasksByMember.get(t.assignee)!.push(t);
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Week
        </label>
        <input
          type="text"
          value={weekId}
          onChange={(e) => setWeekId(e.target.value)}
          placeholder="2026-W10"
          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
        <button
          onClick={copyFromPrevWeek}
          className="rounded bg-yellow-100 px-3 py-1 text-sm text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300"
        >
          Copy incomplete from prev week
        </button>
      </div>

      {memberNames.map((name) => {
        const memberTasks = tasksByMember.get(name) ?? [];
        return (
          <div
            key={name}
            className="rounded border border-gray-200 p-3 dark:border-gray-700"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-white">
                {name}
              </h3>
              <button
                onClick={() => addTask(name)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add task
              </button>
            </div>
            <div className="space-y-1.5">
              {memberTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <button
                    onClick={() => cycleStatus(task.id)}
                    className={`text-lg ${STATUS_COLOR[task.status]}`}
                    title={task.status}
                  >
                    {STATUS_ICON[task.status]}
                  </button>
                  <input
                    type="text"
                    value={task.content}
                    onChange={(e) =>
                      updateTask(task.id, { content: e.target.value })
                    }
                    placeholder="Task content"
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <input
                    type="date"
                    value={task.deadline}
                    onChange={(e) =>
                      updateTask(task.id, { deadline: e.target.value })
                    }
                    className="w-36 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    x
                  </button>
                </div>
              ))}
              {memberTasks.length === 0 && (
                <p className="text-xs text-gray-400">No tasks</p>
              )}
            </div>
          </div>
        );
      })}

      <button
        onClick={() => save(tasks)}
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
