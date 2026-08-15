import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { attachRealtime, publishTelemetry, realtimeClientCount } from "../realtime";
import { startTelemetryStreamWorker, stopTelemetryStreamWorker, telemetryStreamHealth } from "../redisTelemetry";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  attachRealtime(server);
  void startTelemetryStreamWorker(publishTelemetry).catch(error => console.error("Redis telemetry worker unavailable", error));
  server.once("close", () => { void stopTelemetryStreamWorker(); });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok", telemetry: telemetryStreamHealth() }));
  app.get("/readyz", (_req, res) => {
    const telemetry = telemetryStreamHealth();
    const required = Boolean(process.env.REDIS_URL);
    const ready = !required || telemetry.connected;
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "degraded", telemetry });
  });
  app.get("/metrics", (req, res) => {
    const expected = process.env.METRICS_BEARER_TOKEN;
    if (expected && req.headers.authorization !== `Bearer ${expected}`) return res.status(401).send("unauthorized\n");
    const telemetry = telemetryStreamHealth();
    res.type("text/plain; version=0.0.4").send([
      "# HELP pipeflow_realtime_clients Number of connected WebSocket clients.",
      "# TYPE pipeflow_realtime_clients gauge",
      `pipeflow_realtime_clients ${realtimeClientCount()}`,
      "# HELP pipeflow_telemetry_events_total Telemetry events observed by this gateway.",
      "# TYPE pipeflow_telemetry_events_total counter",
      `pipeflow_telemetry_events_total{state=\"produced\"} ${telemetry.produced}`,
      `pipeflow_telemetry_events_total{state=\"delivered\"} ${telemetry.delivered}`,
      `pipeflow_telemetry_events_total{state=\"acknowledged\"} ${telemetry.acknowledged}`,
      `pipeflow_telemetry_events_total{state=\"failed\"} ${telemetry.failures}`,
      "# HELP pipeflow_redis_ready Redis Streams connection health.",
      "# TYPE pipeflow_redis_ready gauge",
      `pipeflow_redis_ready ${telemetry.connected ? 1 : 0}`,
      "",
    ].join("\n"));
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
