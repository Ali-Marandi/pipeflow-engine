import { describe, expect, it, beforeEach } from "vitest";
import { assertRole, createHydraulicJob, getAuditEvents, getHydraulicJob, getTelemetry, ingestTelemetry, recordAudit, resetEnterpriseStores, upsertNetwork } from "./enterprise";

describe("enterprise foundation", () => {
  beforeEach(() => resetEnterpriseStores());

  it("enforces role hierarchy", () => {
    expect(() => assertRole("viewer", "engineer")).toThrow("enterprise permission denied");
    expect(() => assertRole("engineer", "engineer")).not.toThrow();
    expect(() => assertRole("admin", "owner")).not.toThrow();
  });

  it("versions networks and scopes them to an owner", () => {
    const first = upsertNetwork({ ownerUserId: 7, name: "Plant A", nodes: [], edges: [] });
    const second = upsertNetwork({ id: first.id, ownerUserId: 7, name: "Plant A revised", nodes: [], edges: [] });
    expect(second.version).toBe(2);
    expect(second.ownerUserId).toBe(7);
  });

  it("runs an asynchronous hydraulic job to completion", async () => {
    const network = upsertNetwork({ ownerUserId: 7, name: "Test", nodes: [], edges: [{ id: "e1", from: "a", to: "b", diameterM: 0.1, lengthM: 10, roughnessM: 0.00001, flowM3s: 0.01, fittings: [] }] });
    const job = createHydraulicJob(7, network, 998, 0.02, 0.8);
    expect(job.status).toBe("queued");
    await new Promise(resolve => setTimeout(resolve, 0));
    const completed = getHydraulicJob(7, job.id);
    expect(completed.status).toBe("completed");
    expect(completed.result?.e1.totalHead).toBeGreaterThan(0);
  });

  it("accepts valid telemetry and keeps an audit trail", () => {
    const accepted = ingestTelemetry(7, [{ source: "pump-1", metric: "pressure", value: 2.4, unit: "bar", timestamp: new Date().toISOString(), quality: "good" }]);
    recordAudit(7, "telemetry.ingest", "telemetry", "batch", { accepted });
    expect(accepted).toBe(1);
    expect(getTelemetry(7, "pump-1")).toHaveLength(1);
    expect(getAuditEvents(7)).toHaveLength(1);
  });
});
