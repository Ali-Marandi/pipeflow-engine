import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const suffix = randomUUID();
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";
process.env.REDIS_TELEMETRY_STREAM = `pipeflow:chaos:${suffix}`;
process.env.PIPEFLOW_INSTANCE_ID = `chaos-${suffix}`;
process.env.REDIS_TELEMETRY_GROUP = `pipeflow-chaos:${suffix}`;

const {
  asStreamEvent,
  publishTelemetryBatch,
  startTelemetryStreamWorker,
  stopTelemetryStreamWorker,
  telemetryStreamHealth,
} = await import("../../server/redisTelemetry");

const delivered = new Map<
  string,
  { tenantId: string; metric: string; traceId: string }
>();
const alpha = asStreamEvent("alpha", {
  source: "pump-alpha",
  metric: "pressure_kpa",
  value: 420,
  unit: "kPa",
  timestamp: new Date().toISOString(),
  quality: "good",
});
const beta = asStreamEvent("beta", {
  source: "pump-beta",
  metric: "pressure_kpa",
  value: 390,
  unit: "kPa",
  timestamp: new Date().toISOString(),
  quality: "good",
});

async function writeReport(report: unknown) {
  const reportPath = process.env.CHAOS_REPORT_PATH;
  if (!reportPath) return;
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

try {
  await startTelemetryStreamWorker(event => {
    delivered.set(event.eventId, {
      tenantId: event.tenantId,
      metric: event.metric,
      traceId: event.traceId,
    });
  });
  const result = await publishTelemetryBatch([alpha, beta], () => {
    throw new Error(
      "Redis fallback is not permitted in the Redis chaos E2E test"
    );
  });
  const deadline = Date.now() + 5_000;
  while (delivered.size < 2 && Date.now() < deadline)
    await new Promise(resolve => setTimeout(resolve, 50));

  const alphaObserved = delivered.get(alpha.eventId);
  const betaObserved = delivered.get(beta.eventId);
  const health = telemetryStreamHealth();
  const passed =
    result.mode === "redis" &&
    alphaObserved?.tenantId === "alpha" &&
    betaObserved?.tenantId === "beta" &&
    alphaObserved.traceId === alpha.traceId &&
    betaObserved.traceId === beta.traceId &&
    health.acknowledged >= 2;

  const report = {
    status: passed ? "passed" : "failed",
    scenario: "redis-tenant-isolation",
    result,
    stream: health.stream,
    produced: health.produced,
    delivered: health.delivered,
    acknowledged: health.acknowledged,
    observedTenants: [
      alphaObserved?.tenantId ?? null,
      betaObserved?.tenantId ?? null,
    ],
    failureCount: health.failures,
  };
  await writeReport(report);
  if (!passed) {
    console.error(
      JSON.stringify(
        { ...report, alphaObserved, betaObserved, health },
        null,
        2
      )
    );
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  await stopTelemetryStreamWorker();
}
