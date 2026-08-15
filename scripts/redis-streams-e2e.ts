import { randomUUID } from "node:crypto";

const suffix = randomUUID();
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";
process.env.REDIS_TELEMETRY_STREAM = `pipeflow:test:${suffix}`;
process.env.PIPEFLOW_INSTANCE_ID = `integration-${suffix}`;

const { asStreamEvent, publishTelemetryBatch, startTelemetryStreamWorker, stopTelemetryStreamWorker, telemetryStreamHealth } = await import("../server/redisTelemetry");

const received: string[] = [];
await startTelemetryStreamWorker(event => received.push(event.eventId));
const event = asStreamEvent("tenant-e2e", {
  source: "pump-e2e",
  metric: "pressure_kpa",
  value: 425.5,
  unit: "kPa",
  timestamp: new Date().toISOString(),
  quality: "good",
});

const result = await publishTelemetryBatch([event], () => { throw new Error("Redis fallback must not be used"); });
const deadline = Date.now() + 5000;
while (!received.includes(event.eventId) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
const health = telemetryStreamHealth();
await stopTelemetryStreamWorker();

if (result.mode !== "redis" || !received.includes(event.eventId) || health.acknowledged < 1) {
  console.error(JSON.stringify({ result, received, health }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: "passed", stream: health.stream, group: health.group, produced: health.produced, delivered: health.delivered, acknowledged: health.acknowledged }, null, 2));
