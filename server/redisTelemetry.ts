import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { createClient, type RedisClientType } from "redis";
import type { RealtimeTelemetryEvent } from "./realtime";

export interface StreamTelemetryEvent extends RealtimeTelemetryEvent {
  eventId: string;
  traceId: string;
}

export interface TelemetryStreamHealth {
  mode: "redis" | "memory";
  stream: string;
  group: string;
  consumer: string;
  connected: boolean;
  produced: number;
  delivered: number;
  acknowledged: number;
  failures: number;
  lastError?: string;
}

type TelemetryDispatcher = (event: RealtimeTelemetryEvent) => void;

const streamKey = process.env.REDIS_TELEMETRY_STREAM ?? "pipeflow:telemetry:v1";
const instanceId = process.env.PIPEFLOW_INSTANCE_ID ?? `${hostname()}-${process.pid}`;
// A dedicated group per gateway replica guarantees fanout to WebSocket clients connected to every pod.
const groupName = process.env.REDIS_TELEMETRY_GROUP ?? `pipeflow-realtime-v1:${instanceId}`;
const consumerName = process.env.REDIS_CONSUMER_NAME ?? instanceId;
const maxLen = Number.parseInt(process.env.REDIS_TELEMETRY_MAXLEN ?? "100000", 10);
const blockMs = Number.parseInt(process.env.REDIS_TELEMETRY_BLOCK_MS ?? "1000", 10);
const claimIdleMs = Number.parseInt(process.env.REDIS_TELEMETRY_CLAIM_IDLE_MS ?? "30000", 10);

let commandClient: RedisClientType | undefined;
let blockingClient: RedisClientType | undefined;
let workerRunning = false;
let workerPromise: Promise<void> | undefined;
const health: TelemetryStreamHealth = {
  mode: process.env.REDIS_URL ? "redis" : "memory",
  stream: streamKey,
  group: groupName,
  consumer: consumerName,
  connected: false,
  produced: 0,
  delivered: 0,
  acknowledged: 0,
  failures: 0,
};

function redisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

function toEvent(fields: Record<string, string>): StreamTelemetryEvent {
  const value = Number(fields.value);
  if (!Number.isFinite(value) || !fields.tenantId || !fields.source || !fields.metric || !fields.unit || !fields.timestamp) {
    throw new Error("invalid telemetry stream event");
  }
  const quality = fields.quality;
  if (quality !== "good" && quality !== "uncertain" && quality !== "bad") throw new Error("invalid telemetry quality");
  return {
    eventId: fields.eventId || randomUUID(),
    traceId: fields.traceId || fields.eventId || randomUUID(),
    tenantId: fields.tenantId,
    source: fields.source,
    metric: fields.metric,
    value,
    unit: fields.unit,
    timestamp: fields.timestamp,
    quality,
  };
}

function toFields(event: StreamTelemetryEvent): Record<string, string> {
  return {
    eventId: event.eventId,
    traceId: event.traceId,
    tenantId: event.tenantId,
    source: event.source,
    metric: event.metric,
    value: String(event.value),
    unit: event.unit,
    timestamp: event.timestamp,
    quality: event.quality,
  };
}

async function getCommandClient() {
  if (commandClient?.isOpen) return commandClient;
  commandClient = createClient({ url: process.env.REDIS_URL });
  commandClient.on("error", error => {
    health.connected = false;
    health.lastError = error instanceof Error ? error.message : String(error);
  });
  await commandClient.connect();
  health.connected = true;
  return commandClient;
}

async function getBlockingClient() {
  if (blockingClient?.isOpen) return blockingClient;
  const client = await getCommandClient();
  blockingClient = client.duplicate();
  blockingClient.on("error", error => {
    health.connected = false;
    health.lastError = error instanceof Error ? error.message : String(error);
  });
  await blockingClient.connect();
  return blockingClient;
}

async function ensureGroup(client: RedisClientType) {
  try {
    await client.xGroupCreate(streamKey, groupName, "$", { MKSTREAM: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) throw error;
  }
}

export function asStreamEvent(tenantId: string, event: Omit<RealtimeTelemetryEvent, "tenantId">): StreamTelemetryEvent {
  return { ...event, tenantId, eventId: randomUUID(), traceId: randomUUID() };
}

export async function publishTelemetryBatch(events: StreamTelemetryEvent[], fallbackDispatch: TelemetryDispatcher) {
  if (events.length === 0) return { accepted: 0, mode: health.mode };
  if (!redisConfigured()) {
    events.forEach(fallbackDispatch);
    health.produced += events.length;
    health.delivered += events.length;
    health.acknowledged += events.length;
    return { accepted: events.length, mode: "memory" as const };
  }

  const client = await getCommandClient();
  const pipeline = client.multi();
  for (const event of events) {
    pipeline.xAdd(streamKey, "*", toFields(event), {
      TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: Math.max(1000, maxLen) },
    });
  }
  await pipeline.execAsPipeline();
  health.produced += events.length;
  return { accepted: events.length, mode: "redis" as const };
}

async function consumeOnce(dispatch: TelemetryDispatcher) {
  const reader = await getBlockingClient();
  const result = await reader.xReadGroup(groupName, consumerName, [{ key: streamKey, id: ">" }], { COUNT: 100, BLOCK: Math.max(100, blockMs) });
  for (const stream of result ?? []) {
    for (const entry of stream.messages) {
      try {
        const event = toEvent(entry.message);
        dispatch(event);
        await reader.xAck(streamKey, groupName, entry.id);
        health.delivered += 1;
        health.acknowledged += 1;
      } catch (error) {
        health.failures += 1;
        health.lastError = error instanceof Error ? error.message : String(error);
      }
    }
  }
}

async function reclaimIdle(dispatch: TelemetryDispatcher) {
  const client = await getCommandClient();
  const claimed = await client.xAutoClaim(streamKey, groupName, consumerName, Math.max(1000, claimIdleMs), "0-0", { COUNT: 100 });
  for (const entry of claimed.messages) {
    if (!entry) continue;
    try {
      const event = toEvent(entry.message);
      dispatch(event);
      await client.xAck(streamKey, groupName, entry.id);
      health.delivered += 1;
      health.acknowledged += 1;
    } catch (error) {
      health.failures += 1;
      health.lastError = error instanceof Error ? error.message : String(error);
    }
  }
}

export async function startTelemetryStreamWorker(dispatch: TelemetryDispatcher) {
  if (!redisConfigured() || workerRunning) return health;
  const client = await getCommandClient();
  await ensureGroup(client);
  workerRunning = true;
  workerPromise = (async () => {
    let lastClaim = 0;
    while (workerRunning) {
      try {
        await consumeOnce(dispatch);
        if (Date.now() - lastClaim >= Math.max(5000, claimIdleMs)) {
          await reclaimIdle(dispatch);
          lastClaim = Date.now();
        }
      } catch (error) {
        health.failures += 1;
        health.lastError = error instanceof Error ? error.message : String(error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  })();
  return health;
}

export async function stopTelemetryStreamWorker() {
  workerRunning = false;
  await workerPromise?.catch(() => undefined);
  await blockingClient?.quit().catch(() => undefined);
  await commandClient?.quit().catch(() => undefined);
  blockingClient = undefined;
  commandClient = undefined;
  health.connected = false;
}

export function telemetryStreamHealth() {
  return { ...health, mode: redisConfigured() ? "redis" : "memory" };
}
