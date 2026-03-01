// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import {
  getDashboardSummary,
  getSnapshots,
  getAllWeekIds,
} from "@/lib/store/kv";

/** GET /api/data?type=summary&weekId=2026-W10 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "summary";

  try {
    switch (type) {
      case "summary": {
        const weekId = searchParams.get("weekId") ?? undefined;
        const data = await getDashboardSummary(weekId);
        if (!data)
          return NextResponse.json(
            { error: "No data found" },
            { status: 404 }
          );
        return NextResponse.json(data);
      }
      case "trends": {
        const count = parseInt(searchParams.get("count") ?? "8", 10);
        const snapshots = await getSnapshots(count);
        return NextResponse.json(snapshots);
      }
      case "weeks": {
        const weeks = await getAllWeekIds();
        return NextResponse.json(weeks);
      }
      default:
        return NextResponse.json(
          { error: "Unknown type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Data API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
