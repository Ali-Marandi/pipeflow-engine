import { randomUUID } from "node:crypto";
import { hydraulic_design, type FittingLoss, type HydraulicDesignResult } from "./advancedHydraulics";

export type EnterpriseRole = "owner" | "engineer" | "viewer";
export type NetworkNodeKind = "junction" | "reservoir" | "tank" | "pump";

export interface NetworkNode {
  id: string;
  kind: NetworkNodeKind;
  label: string;
  elevationM: number;
}

export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  diameterM: number;
  lengthM: number;
  roughnessM: number;
  flowM3s: number;
  fittings: FittingLoss[];
}

export interface NetworkModel {
  id: string;
  ownerUserId: number;
  name: string;
  version: number;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  updatedAt: string;
}

export interface TelemetryPoint {
  source: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  quality: "good" | "uncertain" | "bad";
}

export interface AuditEvent {
  id: string;
  actorUserId: number;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface HydraulicJob {
  id: string;
  ownerUserId: number;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  result?: Record<string, HydraulicDesignResult>;
  error?: string;
}

const networks = new Map<string, NetworkModel>();
const jobs = new Map<string, HydraulicJob>();
const telemetry = new Map<number, TelemetryPoint[]>();
const auditEvents = new Map<number, AuditEvent[]>();

function now() { return new Date().toISOString(); }

export function assertRole(role: EnterpriseRole | "admin" | "user" | undefined, minimum: EnterpriseRole): void {
  const rank: Record<string, number> = { viewer: 1, engineer: 2, owner: 3, admin: 3 };
  if ((rank[role ?? ""] ?? 0) < rank[minimum]) throw new Error(`enterprise permission denied: requires ${minimum}`);
}

export function recordAudit(actorUserId: number, action: string, resource: string, resourceId: string, metadata: Record<string, unknown> = {}) {
  const event: AuditEvent = { id: randomUUID(), actorUserId, action, resource, resourceId, metadata, timestamp: now() };
  const list = auditEvents.get(actorUserId) ?? [];
  list.unshift(event);
  auditEvents.set(actorUserId, list.slice(0, 500));
  return event;
}

export function upsertNetwork(input: Omit<NetworkModel, "id" | "version" | "updatedAt"> & { id?: string; version?: number }) {
  const id = input.id ?? randomUUID();
  const current = networks.get(id);
  const network: NetworkModel = { ...input, id, version: (current?.version ?? input.version ?? 0) + 1, updatedAt: now() };
  networks.set(id, network);
  return network;
}

export function getNetworks(ownerUserId: number) { return Array.from(networks.values()).filter(n => n.ownerUserId === ownerUserId); }
export function getNetwork(ownerUserId: number, id: string) {
  const network = networks.get(id);
  if (!network || network.ownerUserId !== ownerUserId) throw new Error("network not found");
  return network;
}

export function createHydraulicJob(ownerUserId: number, network: NetworkModel, fluidDensity: number, frictionFactor: number, pumpEfficiency: number) {
  const job: HydraulicJob = { id: randomUUID(), ownerUserId, status: "queued", createdAt: now() };
  jobs.set(job.id, job);
  queueMicrotask(() => {
    job.status = "running";
    try {
      const result: Record<string, HydraulicDesignResult> = {};
      for (const edge of network.edges) {
        result[edge.id] = hydraulic_design(edge.flowM3s, edge.diameterM, edge.lengthM, frictionFactor, fluidDensity, edge.fittings, 0, pumpEfficiency, 0, 0);
      }
      job.result = result;
      job.status = "completed";
      job.completedAt = now();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "hydraulic job failed";
    }
  });
  return job;
}

export function getHydraulicJob(ownerUserId: number, id: string) {
  const job = jobs.get(id);
  if (!job || job.ownerUserId !== ownerUserId) throw new Error("job not found");
  return job;
}

export function ingestTelemetry(ownerUserId: number, points: TelemetryPoint[]) {
  const accepted = points.filter(p => Number.isFinite(p.value) && p.source.length > 0 && p.metric.length > 0);
  const list = telemetry.get(ownerUserId) ?? [];
  telemetry.set(ownerUserId, [...accepted, ...list].slice(0, 1000));
  return accepted.length;
}
export function getTelemetry(ownerUserId: number, source?: string, limit = 100) {
  return (telemetry.get(ownerUserId) ?? []).filter(p => !source || p.source === source).slice(0, Math.min(limit, 500));
}
export function getAuditEvents(ownerUserId: number, limit = 100) { return (auditEvents.get(ownerUserId) ?? []).slice(0, Math.min(limit, 500)); }

export function resetEnterpriseStores() { networks.clear(); jobs.clear(); telemetry.clear(); auditEvents.clear(); }
