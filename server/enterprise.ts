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

export type AlertOperator = "gt" | "gte" | "lt" | "lte";
export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertRule {
  id: string;
  ownerUserId: number;
  name: string;
  metric: string;
  source?: string;
  operator: AlertOperator;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownSeconds: number;
  updatedAt: string;
}

export interface AlertIncident {
  id: string;
  ruleId: string;
  ownerUserId: number;
  source: string;
  metric: string;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  status: "open" | "acknowledged";
  timestamp: string;
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
const alertRules = new Map<number, AlertRule[]>();
const alertIncidents = new Map<number, AlertIncident[]>();
const alertCooldowns = new Map<string, number>();

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

export function upsertAlertRule(input: Omit<AlertRule, "id" | "updatedAt"> & { id?: string }) {
  const list = alertRules.get(input.ownerUserId) ?? [];
  const existing = input.id ? list.find(rule => rule.id === input.id) : undefined;
  const rule: AlertRule = { ...input, id: existing?.id ?? randomUUID(), updatedAt: now() };
  const next = existing ? list.map(item => item.id === rule.id ? rule : item) : [rule, ...list];
  alertRules.set(input.ownerUserId, next.slice(0, 200));
  return rule;
}

export function getAlertRules(ownerUserId: number) { return alertRules.get(ownerUserId) ?? []; }
export function getAlertIncidents(ownerUserId: number, limit = 100) { return (alertIncidents.get(ownerUserId) ?? []).slice(0, Math.min(limit, 500)); }
export function acknowledgeAlertIncident(ownerUserId: number, id: string) {
  const list = alertIncidents.get(ownerUserId) ?? [];
  const incident = list.find(item => item.id === id);
  if (!incident) throw new Error("alert incident not found");
  incident.status = "acknowledged";
  return incident;
}

function ruleMatches(rule: AlertRule, point: TelemetryPoint) {
  if (!rule.enabled || rule.metric !== point.metric || (rule.source && rule.source !== point.source)) return false;
  if (rule.operator === "gt") return point.value > rule.threshold;
  if (rule.operator === "gte") return point.value >= rule.threshold;
  if (rule.operator === "lt") return point.value < rule.threshold;
  return point.value <= rule.threshold;
}

export function evaluateTelemetryAlerts(ownerUserId: number, points: TelemetryPoint[]) {
  const rules = getAlertRules(ownerUserId);
  const incidents: AlertIncident[] = [];
  for (const point of points) for (const rule of rules) {
    if (!ruleMatches(rule, point)) continue;
    const key = `${ownerUserId}:${rule.id}:${point.source}`;
    const previous = alertCooldowns.get(key) ?? 0;
    if (Date.now() - previous < Math.max(0, rule.cooldownSeconds) * 1000) continue;
    alertCooldowns.set(key, Date.now());
    incidents.push({ id: randomUUID(), ruleId: rule.id, ownerUserId, source: point.source, metric: point.metric, value: point.value, threshold: rule.threshold, severity: rule.severity, status: "open", timestamp: now() });
  }
  if (incidents.length) alertIncidents.set(ownerUserId, [...incidents, ...(alertIncidents.get(ownerUserId) ?? [])].slice(0, 1000));
  return incidents;
}
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
  evaluateTelemetryAlerts(ownerUserId, accepted);
  return accepted.length;
}
export function getTelemetry(ownerUserId: number, source?: string, limit = 100) {
  return (telemetry.get(ownerUserId) ?? []).filter(p => !source || p.source === source).slice(0, Math.min(limit, 500));
}
export function getAuditEvents(ownerUserId: number, limit = 100) { return (auditEvents.get(ownerUserId) ?? []).slice(0, Math.min(limit, 500)); }

export function resetEnterpriseStores() { networks.clear(); jobs.clear(); telemetry.clear(); auditEvents.clear(); alertRules.clear(); alertIncidents.clear(); alertCooldowns.clear(); }
