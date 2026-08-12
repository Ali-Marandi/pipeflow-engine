# Cloud Database and Redis Streams Operations

## Database boundaries

The transactional database stores authoritative project state, network snapshots, job metadata, organization membership and audit indexes. Telemetry samples should not be written into the same hot tables as project metadata. Use a time-series store or partitioned append-only table for sensor events.

```sql
CREATE TABLE organizations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL
);

CREATE TABLE organization_members (
  organization_id CHAR(36) NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(32) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL,
  PRIMARY KEY (organization_id, user_id),
  INDEX ix_members_user (user_id)
);

CREATE TABLE network_snapshots (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  network_id CHAR(36) NOT NULL,
  version INT NOT NULL,
  graph_json JSON NOT NULL,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL,
  UNIQUE KEY uq_snapshot_version (network_id, version),
  INDEX ix_snapshot_org (organization_id, updated_at)
);

CREATE TABLE processing_jobs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  job_type VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  payload_uri VARCHAR(512) NULL,
  result_uri VARCHAR(512) NULL,
  attempts INT NOT NULL DEFAULT 0,
  lease_until TIMESTAMP(3) NULL,
  created_at TIMESTAMP(3) NOT NULL,
  started_at TIMESTAMP(3) NULL,
  completed_at TIMESTAMP(3) NULL,
  UNIQUE KEY uq_job_idempotency (organization_id, idempotency_key),
  INDEX ix_jobs_poll (status, lease_until, created_at)
);
```

The production schema should include `organization_id` on every tenant-owned row. Authorization must derive the organization from the authenticated session and membership table, never from an untrusted request field.

## Redis Streams topology

Use separate streams by traffic class:

| Stream | Producer | Consumer group | Work |
|---|---|---|---|
| `pipeflow:telemetry:raw` | MQTT/OPC-UA/REST adapters | `telemetry-normalizers` | Validate, normalize units and reject stale points |
| `pipeflow:telemetry:normalized` | Normalizer workers | `telemetry-writers`, `alarm-evaluators`, `realtime-fanout` | Persist, evaluate alarms and broadcast |
| `pipeflow:jobs:hydraulic` | API | `hydraulic-solvers` | Run network solver with bounded concurrency |
| `pipeflow:jobs:reports` | API/solver | `report-workers` | Generate PDF/CSV and upload to object storage |

Each message should contain `eventId`, `organizationId`, `source`, `metric`, `timestamp`, `schemaVersion` and a compact payload. Use `XADD ... MAXLEN ~ 100000` only as a safety bound; retention and durable archival must be handled separately.

## Parallel processing pattern

A consumer group gives each message to one consumer in that group. To scale telemetry normalization, run multiple worker processes under the same group. For independent work, use different groups so the same event is delivered once to each logical pipeline.

```text
XADD raw -> group telemetry-normalizers -> group telemetry-writers
                                      -> group alarm-evaluators
                                      -> group realtime-fanout
```

Workers must acknowledge only after the side effect succeeds:

```text
XREADGROUP GROUP telemetry-writers writer-01 COUNT 100 BLOCK 5000 STREAMS pipeflow:telemetry:normalized >
processing...
XACK pipeflow:telemetry:normalized telemetry-writers <message-id>
```

If a worker dies after claiming a message, an operational reclaimer periodically inspects the pending entries list and uses `XAUTOCLAIM` for messages whose idle time exceeds the lease threshold. Do not acknowledge a message before the database or time-series write is committed.

## Idempotency and ordering

Use `eventId` as a unique key in the telemetry store. A repeated message must become a no-op. Ordering should be maintained per `organizationId + source + metric`, not globally. If timestamps arrive out of order, retain the point with a quality flag and calculate dashboards using event-time windows.

## Monitoring and alerting

Export the following metrics with organization-safe aggregation:

| Metric | Meaning | Alert suggestion |
|---|---|---|
| `redis_stream_lag` | Difference between stream last-generated ID and group acknowledgment ID | Alert when lag exceeds SLO for five minutes |
| `redis_pending_entries` | Messages claimed but not acknowledged | Alert on continuous growth |
| `redis_oldest_pending_age_seconds` | Age of oldest pending entry | Critical when above retry SLA |
| `telemetry_ingest_rate` | Events accepted per second | Detect device floods and capacity changes |
| `telemetry_rejected_total` | Schema, auth or range rejects | Alert on sudden increase |
| `hydraulic_job_duration_seconds` | Solver latency histogram | Track p50/p95/p99 and timeout rate |
| `websocket_connections` | Active connections by gateway | Capacity and abuse indicator |
| `websocket_dropped_messages_total` | Backpressure drops | Alert before dashboards become stale |

Operational dashboards should show stream length, consumer-group lag, pending messages, retry count, dead-letter count, database write latency and WebSocket fanout latency. Failed messages must move to `pipeflow:dead-letter:<stream>` with the original payload, error code, attempt count and first/last failure timestamps.

## Cloud rollout sequence

Start with one managed relational database, Redis with persistence enabled, one API deployment and one worker deployment. Add the time-series store and pub/sub fanout only after telemetry volume requires it. Configure TLS for every external connection, private networking where available, secret-manager integration, backups, restore drills and retention policies before onboarding production sensors.
