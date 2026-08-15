import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import {
  assertTenantId,
  metricSubscriptionAllows,
  sameTenant,
} from "./tenantIsolation";

export interface RealtimeTelemetryEvent {
  tenantId: string;
  source: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  quality: "good" | "uncertain" | "bad";
}

type Client = {
  socket: WebSocket;
  tenantId: string;
  subscriptions: Set<string>;
};
const clients = new Set<Client>();
const MAX_MESSAGE_BYTES = 64 * 1024;

export function resolveRealtimeTenant(
  token: string | null,
  requestedTenantId: string | null
): string | undefined {
  const sharedToken = process.env.REALTIME_SHARED_TOKEN;
  const sharedTokenTenant = process.env.REALTIME_SHARED_TOKEN_TENANT_ID;
  const allowLegacySharedToken =
    process.env.REALTIME_ALLOW_LEGACY_SHARED_TOKEN === "true";

  if (!requestedTenantId) return undefined;
  let tenantId: string;
  try {
    tenantId = assertTenantId(requestedTenantId);
  } catch {
    return undefined;
  }

  if (!sharedToken) {
    return process.env.NODE_ENV === "development" ? tenantId : undefined;
  }
  if (token !== sharedToken) return undefined;
  if (sharedTokenTenant) {
    try {
      return sameTenant(tenantId, sharedTokenTenant) ? tenantId : undefined;
    } catch {
      return undefined;
    }
  }
  return allowLegacySharedToken ? tenantId : undefined;
}

export function canDeliverTelemetryToClient(
  clientTenantId: string,
  subscriptions: ReadonlySet<string>,
  event: RealtimeTelemetryEvent
): boolean {
  try {
    return (
      sameTenant(clientTenantId, event.tenantId) &&
      metricSubscriptionAllows(subscriptions, event.metric)
    );
  } catch {
    return false;
  }
}

function getToken(request: IncomingMessage) {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return new URL(request.url ?? "/", "http://localhost").searchParams.get(
    "token"
  );
}

function allowedOrigin(request: IncomingMessage) {
  const allowed = process.env.REALTIME_ALLOWED_ORIGINS?.split(",")
    .map(value => value.trim())
    .filter(Boolean);
  if (!allowed?.length) return true;
  return allowed.includes(String(request.headers.origin ?? ""));
}

export function attachRealtime(server: HttpServer) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== "/ws/telemetry") return;
    const requestedTenantId = new URL(
      request.url ?? "/",
      "http://localhost"
    ).searchParams.get("tenantId");
    const tenantId = resolveRealtimeTenant(
      getToken(request),
      requestedTenantId
    );
    if (!allowedOrigin(request) || !tenantId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => {
      const client: Client = {
        socket: ws,
        tenantId,
        subscriptions: new Set(["*"]),
      };
      clients.add(client);
      ws.send(
        JSON.stringify({
          type: "ready",
          tenantId,
          timestamp: new Date().toISOString(),
        })
      );
      ws.on("message", data => {
        if (Buffer.byteLength(data.toString(), "utf8") > MAX_MESSAGE_BYTES)
          return ws.close(1009, "message too large");
        try {
          const message = JSON.parse(data.toString()) as {
            type?: string;
            metrics?: string[];
          };
          if (message.type === "subscribe" && Array.isArray(message.metrics)) {
            client.subscriptions = new Set(message.metrics.slice(0, 100));
            ws.send(
              JSON.stringify({
                type: "subscribed",
                metrics: Array.from(client.subscriptions),
              })
            );
          }
        } catch {
          ws.close(1003, "invalid JSON");
        }
      });
      ws.on("close", () => clients.delete(client));
      ws.on("error", () => clients.delete(client));
    });
  });
  return wss;
}

export function publishTelemetry(event: RealtimeTelemetryEvent) {
  const payload = JSON.stringify({ type: "telemetry", ...event });
  for (const client of Array.from(clients)) {
    if (
      canDeliverTelemetryToClient(
        client.tenantId,
        client.subscriptions,
        event
      ) &&
      client.socket.readyState === WebSocket.OPEN
    )
      client.socket.send(payload);
  }
}

export function realtimeClientCount() {
  return clients.size;
}
