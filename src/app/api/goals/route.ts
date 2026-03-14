// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getHalfYearObjective,
  saveHalfYearObjective,
  deleteHalfYearObjective,
  getAllHalfYearPeriods,
  getMonthlyGoals,
  saveMonthlyGoals,
  deleteMonthlyGoals,
  getWeeklyTasks,
  saveWeeklyTasks,
  deleteWeeklyTasks,
  getAllGoalWeekIds,
} from "@/lib/store/goals";
import { getAllWeekIds } from "@/lib/store/kv";
import { getTeam } from "@/lib/team";
import { getWeekId } from "@/lib/week";
import type { HalfYearObjective, MonthlyGoal, WeeklyTask } from "@/lib/types";

async function checkAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user || session.user.orgRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tier = searchParams.get("tier");

  if (tier === "half") {
    const period = searchParams.get("period");
    if (period) {
      const obj = await getHalfYearObjective(period);
      return NextResponse.json({ data: obj });
    }
    const periods = await getAllHalfYearPeriods();
    const objectives = await Promise.all(
      periods.map((p) => getHalfYearObjective(p))
    );
    return NextResponse.json({
      data: objectives.filter(Boolean),
    });
  }

  if (tier === "month") {
    const month = searchParams.get("month");
    if (!month) {
      return NextResponse.json(
        { error: "month parameter required" },
        { status: 400 }
      );
    }
    const goals = await getMonthlyGoals(month);
    return NextResponse.json({ data: goals });
  }

  if (tier === "week") {
    const weekId = searchParams.get("weekId");
    if (!weekId) {
      return NextResponse.json(
        { error: "weekId parameter required" },
        { status: 400 }
      );
    }
    const tasks = await getWeeklyTasks(weekId);
    return NextResponse.json({ data: tasks });
  }

  if (tier === "weeks") {
    const [goalWeeks, snapshotWeeks] = await Promise.all([
      getAllGoalWeekIds(),
      getAllWeekIds(),
    ]);
    const currentWk = getWeekId();
    const allWeeks = [...new Set([currentWk, ...goalWeeks, ...snapshotWeeks])];
    allWeeks.sort().reverse();
    return NextResponse.json({ data: allWeeks });
  }

  if (tier === "team") {
    const team = await getTeam();
    return NextResponse.json({ data: team });
  }

  return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tier, id, status } = body;

  const validStatuses = ["not_started", "in_progress", "done"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (tier === "month") {
    const { month } = body;
    if (!month || !id) {
      return NextResponse.json(
        { error: "month and id required" },
        { status: 400 }
      );
    }
    const goals = await getMonthlyGoals(month);
    const goal = goals.find((g) => g.id === id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    goal.status = status;
    goal.updatedAt = new Date().toISOString();
    await saveMonthlyGoals(month, goals);
    return NextResponse.json({ status: "updated", data: goal });
  }

  if (tier === "week") {
    const { weekId } = body;
    if (!weekId || !id) {
      return NextResponse.json(
        { error: "weekId and id required" },
        { status: 400 }
      );
    }
    const tasks = await getWeeklyTasks(weekId);
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    task.status = status;
    task.updatedAt = new Date().toISOString();
    await saveWeeklyTasks(weekId, tasks);
    return NextResponse.json({ status: "updated", data: task });
  }

  return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
}

export async function POST(request: Request) {
  const forbidden = await checkAdmin();
  if (forbidden) return forbidden;

  const body = await request.json();
  const { tier } = body;

  if (tier === "half") {
    const obj: HalfYearObjective = {
      id: body.period,
      period: body.period,
      title: body.title,
      description: body.description,
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveHalfYearObjective(obj);
    return NextResponse.json({ status: "saved", data: obj });
  }

  if (tier === "month") {
    const goals: MonthlyGoal[] = body.goals;
    await saveMonthlyGoals(body.month, goals);
    return NextResponse.json({ status: "saved", month: body.month });
  }

  if (tier === "week") {
    const tasks: WeeklyTask[] = body.tasks;
    await saveWeeklyTasks(body.weekId, tasks);
    return NextResponse.json({ status: "saved", weekId: body.weekId });
  }

  return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const forbidden = await checkAdmin();
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const tier = searchParams.get("tier");

  if (tier === "half") {
    const period = searchParams.get("period");
    if (!period) {
      return NextResponse.json(
        { error: "period parameter required" },
        { status: 400 }
      );
    }
    await deleteHalfYearObjective(period);
    return NextResponse.json({ status: "deleted", period });
  }

  if (tier === "month") {
    const month = searchParams.get("month");
    if (!month) {
      return NextResponse.json(
        { error: "month parameter required" },
        { status: 400 }
      );
    }
    await deleteMonthlyGoals(month);
    return NextResponse.json({ status: "deleted", month });
  }

  if (tier === "week") {
    const weekId = searchParams.get("weekId");
    if (!weekId) {
      return NextResponse.json(
        { error: "weekId parameter required" },
        { status: 400 }
      );
    }
    await deleteWeeklyTasks(weekId);
    return NextResponse.json({ status: "deleted", weekId });
  }

  return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
}
