// Copyright 2026 Fractalyze Inc. All rights reserved.

import type { ParsedOtelEntry } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Parse an OTLP ExportMetricsServiceRequest (JSON) into flat entries.
 *
 * OTLP structure:
 *   resourceMetrics[] →
 *     resource.attributes[] (user.email 추출) →
 *     scopeMetrics[] →
 *       metrics[] →
 *         name →
 *         sum.dataPoints[] →
 *           asInt | asDouble, timeUnixNano, attributes[]
 */
export function parseOtlpMetrics(body: unknown): ParsedOtelEntry[] {
  const entries: ParsedOtelEntry[] = [];
  const root = body as any;

  const resourceMetrics = root?.resourceMetrics;
  if (!Array.isArray(resourceMetrics)) return entries;

  for (const rm of resourceMetrics) {
    const email = getResourceAttr(rm.resource, "user.email") ?? "unknown";
    const scopeMetrics = rm.scopeMetrics;
    if (!Array.isArray(scopeMetrics)) continue;

    for (const sm of scopeMetrics) {
      const metrics = sm.metrics;
      if (!Array.isArray(metrics)) continue;

      for (const metric of metrics) {
        const metricName: string = metric.name ?? "";
        const dataPoints = metric.sum?.dataPoints ?? metric.gauge?.dataPoints;
        if (!Array.isArray(dataPoints)) continue;

        for (const dp of dataPoints) {
          const value = getDataPointValue(dp);
          const date = nanoToDate(dp.timeUnixNano ?? "0");

          const attributes: Record<string, string> = {};
          if (Array.isArray(dp.attributes)) {
            for (const attr of dp.attributes) {
              attributes[attr.key] = attr.value?.stringValue ?? "";
            }
          }

          entries.push({ email, date, metric: metricName, value, attributes });
        }
      }
    }
  }

  return entries;
}

/** Extract an attribute value from a resource's attributes array. */
function getResourceAttr(
  resource: any,
  key: string
): string | undefined {
  const attrs = resource?.attributes;
  if (!Array.isArray(attrs)) return undefined;
  const attr = attrs.find((a: any) => a.key === key);
  return attr?.value?.stringValue;
}

/** Extract the numeric value from an OTLP data point. */
function getDataPointValue(dp: any): number {
  if (dp.asInt !== undefined) {
    return typeof dp.asInt === "string" ? parseInt(dp.asInt, 10) : Number(dp.asInt);
  }
  if (dp.asDouble !== undefined) {
    return Number(dp.asDouble);
  }
  return 0;
}

/** Convert a nanosecond Unix timestamp string to a "YYYY-MM-DD" date string (UTC). */
export function nanoToDate(timeUnixNano: string): string {
  const ms = Math.floor(Number(BigInt(timeUnixNano) / BigInt(1_000_000)));
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
