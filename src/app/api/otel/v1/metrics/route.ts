// Copyright 2026 Fractalyze Inc. All rights reserved.

import { NextResponse } from "next/server";
import { parseOtlpMetrics } from "@/lib/otel/parser";
import { accumulateOtelMetrics } from "@/lib/store/claude-code";

/**
 * POST /api/otel/v1/metrics
 *
 * OTLP HTTP/JSON receiver for Claude Code telemetry.
 * Auth: Authorization: Bearer ${OTEL_INGEST_TOKEN}
 * Body: ExportMetricsServiceRequest (JSON)
 * Response: { partialSuccess: {} }
 */
export async function POST(request: Request) {
  // 1. Validate bearer token
  const token = process.env.OTEL_INGEST_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "OTEL_INGEST_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // 3. Parse OTLP metrics
  const entries = parseOtlpMetrics(body);

  // 4. Accumulate into KV
  if (entries.length > 0) {
    await accumulateOtelMetrics(entries);
  }

  // 5. Return OTLP-compliant response
  return NextResponse.json({ partialSuccess: {} });
}
