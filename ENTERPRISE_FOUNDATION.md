# PipeFlow Enterprise Foundation

## Scope

This iteration adds a production-oriented application boundary for network models, asynchronous hydraulic jobs, telemetry ingestion, role checks and audit events. The implementation is intentionally storage-agnostic: the current adapter uses bounded in-memory stores so that the API and tests work without a database, while the interfaces can be replaced by MySQL/TiDB, Redis and a queue worker without changing the tRPC contract.

## API contract

The `enterprise` router exposes `listNetworks`, `saveNetwork`, `submitHydraulicJob`, `getHydraulicJob`, `ingestTelemetry`, `getTelemetry` and `getAudit`. Network writes, job submission and telemetry ingestion require the `engineer` role or higher. Viewer users can be granted read-only access by extending the read procedures with a workspace policy.

A network is versioned on every write. A hydraulic job starts as `queued`, transitions to `running`, and ends in `completed` or `failed`. The current worker executes asynchronously through a microtask. A cloud deployment should replace this with a durable queue and a worker process so jobs survive restarts and can be retried.

Telemetry points carry source, metric, value, unit, timestamp and quality. The in-memory adapter retains the newest 1,000 points per user. This is suitable for local development and contract testing only; production telemetry should use a time-series database with retention, downsampling, deduplication and tenant-level quotas.

Audit events record actor, action, resource, resource ID, metadata and timestamp. The current adapter retains the newest 500 events per user. A production audit log must be append-only, persisted, access-controlled and exported to an organization’s SIEM.

## Deployment evolution

| Current foundation | Enterprise replacement |
| --- | --- |
| In-memory network/job store | Relational database with optimistic versioning |
| `queueMicrotask` worker | Redis/SQS-compatible durable queue and worker pool |
| In-memory telemetry list | TimescaleDB/ClickHouse/Influx-compatible time-series storage |
| User-scoped role check | Workspace membership, RBAC/ABAC and OIDC/SAML SSO |
| In-memory audit list | Append-only audit store, retention policy and SIEM export |
| Direct polling of job status | WebSocket/SSE updates plus durable job status |

## Security notes

The desktop renderer still receives no filesystem or shell capability through preload. The Enterprise API must additionally enforce tenant ownership, request size limits, rate limits, schema validation, audit coverage and server-side authorization. Telemetry adapters must authenticate device identities and reject stale or out-of-order data according to the deployment policy.

## Verification

The project currently passes `pnpm check` and `pnpm test`. The Enterprise suite covers role hierarchy, network versioning, asynchronous job completion, telemetry validation and audit creation. Before a commercial cloud release, add real database integration tests, queue retry tests, E2E API tests, load tests, Windows smoke tests, dependency scanning, SBOM generation and signed release verification.
