// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { getOtelStatuses } from "@/lib/store/claude-code";

/**
 * GET /api/otel/status
 *
 * Returns OTel connection status for the admin panel.
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = !!process.env.OTEL_INGEST_TOKEN;
  const statuses = await getOtelStatuses();

  return NextResponse.json({ configured, statuses });
}
