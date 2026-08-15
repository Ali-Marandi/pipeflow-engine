import { afterEach, describe, expect, it } from "vitest";
import { asStreamEvent } from "./redisTelemetry";
import {
  canDeliverTelemetryToClient,
  resolveRealtimeTenant,
  type RealtimeTelemetryEvent,
} from "./realtime";
import { assertTenantId, tenantRedisKey } from "./tenantIsolation";

const realtimeEnvironment = {
  token: process.env.REALTIME_SHARED_TOKEN,
  tenant: process.env.REALTIME_SHARED_TOKEN_TENANT_ID,
  allowLegacy: process.env.REALTIME_ALLOW_LEGACY_SHARED_TOKEN,
  nodeEnv: process.env.NODE_ENV,
};

function restoreEnvironment(
  name: keyof typeof realtimeEnvironment,
  value: string | undefined
) {
  const variable = {
    token: "REALTIME_SHARED_TOKEN",
    tenant: "REALTIME_SHARED_TOKEN_TENANT_ID",
    allowLegacy: "REALTIME_ALLOW_LEGACY_SHARED_TOKEN",
    nodeEnv: "NODE_ENV",
  }[name];
  if (value === undefined) delete process.env[variable];
  else process.env[variable] = value;
}

afterEach(() => {
  (
    Object.keys(realtimeEnvironment) as Array<keyof typeof realtimeEnvironment>
  ).forEach(key => restoreEnvironment(key, realtimeEnvironment[key]));
});

const alphaEvent: RealtimeTelemetryEvent = {
  tenantId: "alpha",
  source: "pump-alpha",
  metric: "pressure_kpa",
  value: 420,
  unit: "kPa",
  timestamp: "2026-08-16T00:00:00.000Z",
  quality: "good",
};

describe("tenant isolation chaos controls", () => {
  it("constructs Redis keys in tenant-specific namespaces and rejects ambiguous segments", () => {
    expect(tenantRedisKey("alpha", "telemetry-cache", "pressure_kpa")).toBe(
      "pipeflow:tenant:alpha:telemetry-cache:pressure_kpa"
    );
    expect(tenantRedisKey("beta", "telemetry-cache", "pressure_kpa")).not.toBe(
      tenantRedisKey("alpha", "telemetry-cache", "pressure_kpa")
    );
    expect(() => tenantRedisKey("alpha:beta", "cache", "record")).toThrow(
      "invalid tenant identifier"
    );
    expect(() =>
      tenantRedisKey("alpha", "cache", "record:other-tenant")
    ).toThrow("invalid tenant Redis key segment");
  });

  it("rejects malformed tenant identifiers before they enter a Redis telemetry event", () => {
    expect(() => assertTenantId("alpha\nadmin")).toThrow(
      "invalid tenant identifier"
    );
    expect(() =>
      asStreamEvent("alpha:beta", {
        source: "pump-alpha",
        metric: "pressure_kpa",
        value: 420,
        unit: "kPa",
        timestamp: "2026-08-16T00:00:00.000Z",
        quality: "good",
      })
    ).toThrow("invalid tenant identifier");
  });

  it("binds the legacy shared WebSocket token to its server-configured tenant", () => {
    process.env.NODE_ENV = "production";
    process.env.REALTIME_SHARED_TOKEN = "test-token";
    process.env.REALTIME_SHARED_TOKEN_TENANT_ID = "alpha";
    delete process.env.REALTIME_ALLOW_LEGACY_SHARED_TOKEN;

    expect(resolveRealtimeTenant("test-token", "alpha")).toBe("alpha");
    expect(resolveRealtimeTenant("test-token", "beta")).toBeUndefined();
    expect(resolveRealtimeTenant("wrong-token", "alpha")).toBeUndefined();
  });

  it("fails closed for an unbound shared token unless an explicit temporary legacy override is set", () => {
    process.env.NODE_ENV = "production";
    process.env.REALTIME_SHARED_TOKEN = "test-token";
    delete process.env.REALTIME_SHARED_TOKEN_TENANT_ID;
    delete process.env.REALTIME_ALLOW_LEGACY_SHARED_TOKEN;

    expect(resolveRealtimeTenant("test-token", "alpha")).toBeUndefined();
    process.env.REALTIME_ALLOW_LEGACY_SHARED_TOKEN = "true";
    expect(resolveRealtimeTenant("test-token", "alpha")).toBe("alpha");
  });

  it("does not deliver an Alpha telemetry event to Beta even when the metric subscription matches", () => {
    expect(
      canDeliverTelemetryToClient(
        "alpha",
        new Set(["pressure_kpa"]),
        alphaEvent
      )
    ).toBe(true);
    expect(
      canDeliverTelemetryToClient("alpha", new Set(["flow_m3h"]), alphaEvent)
    ).toBe(false);
    expect(
      canDeliverTelemetryToClient("beta", new Set(["*"]), alphaEvent)
    ).toBe(false);
  });
});
