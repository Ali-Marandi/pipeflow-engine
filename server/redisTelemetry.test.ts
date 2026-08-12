import { afterEach, describe, expect, it } from "vitest";
import { asStreamEvent, publishTelemetryBatch, stopTelemetryStreamWorker, telemetryStreamHealth } from "./redisTelemetry";

const previousRedisUrl = process.env.REDIS_URL;

afterEach(async () => {
  if (previousRedisUrl) process.env.REDIS_URL = previousRedisUrl;
  else delete process.env.REDIS_URL;
  await stopTelemetryStreamWorker();
});

describe("Redis Streams telemetry adapter", () => {
  it("creates an idempotency-friendly event envelope", () => {
    const event = asStreamEvent("42", {
      source: "pump-A",
      metric: "pressure_kpa",
      value: 415.2,
      unit: "kPa",
      timestamp: "2026-08-12T18:00:00.000Z",
      quality: "good",
    });
    expect(event.tenantId).toBe("42");
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("uses in-process dispatch when Redis is not configured", async () => {
    delete process.env.REDIS_URL;
    const received: string[] = [];
    const event = asStreamEvent("42", {
      source: "pump-A",
      metric: "flow_m3h",
      value: 12.5,
      unit: "m3/h",
      timestamp: "2026-08-12T18:00:00.000Z",
      quality: "good",
    });
    const result = await publishTelemetryBatch([event], value => received.push(`${value.tenantId}:${value.metric}`));
    expect(result).toEqual({ accepted: 1, mode: "memory" });
    expect(received).toEqual(["42:flow_m3h"]);
    expect(telemetryStreamHealth().mode).toBe("memory");
  });
});
