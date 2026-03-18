// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { getRedis } from "@/lib/store/kv";

/**
 * One-time migration: rename `deadline` → `estimatedDeadline` (and copy to `actualDeadline`)
 * in all `goal:week:*` keys, and rename `deadline` → `estimatedDeadline` in `ghoverride:*` keys.
 *
 * POST /api/migrate/deadline
 * Requires CRON_SECRET header for auth.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret") ?? "";
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getRedis();
  let weekKeysMigrated = 0;
  let overrideKeysMigrated = 0;

  // Migrate goal:week:* keys
  const weekKeys = await redis.keys("goal:week:*");
  for (const key of weekKeys) {
    const raw = await redis.get<string>(key);
    if (!raw) continue;
    const tasks = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(tasks)) continue;

    let changed = false;
    for (const task of tasks) {
      if ("deadline" in task && !("estimatedDeadline" in task)) {
        task.estimatedDeadline = task.deadline;
        task.actualDeadline = task.deadline;
        delete task.deadline;
        changed = true;
      }
    }

    if (changed) {
      await redis.set(key, JSON.stringify(tasks));
      weekKeysMigrated++;
    }
  }

  // Migrate ghoverride:* keys
  const overrideKeys = await redis.keys("ghoverride:*");
  for (const key of overrideKeys) {
    const raw = await redis.get<string>(key);
    if (!raw) continue;
    const fields = typeof raw === "string" ? JSON.parse(raw) : raw;

    if ("deadline" in fields && !("estimatedDeadline" in fields)) {
      fields.estimatedDeadline = fields.deadline;
      delete fields.deadline;
      await redis.set(key, JSON.stringify(fields));
      overrideKeysMigrated++;
    }
  }

  return NextResponse.json({
    status: "done",
    weekKeysMigrated,
    overrideKeysMigrated,
  });
}
