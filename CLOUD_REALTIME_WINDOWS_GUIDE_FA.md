# راهنمای Cloud، WebSocket و Windows Build برای PipeFlow Pro

## ۱. معماری پیشنهادی Cloud

برای نسخه‌ی سازمانی، پیشنهاد می‌شود PipeFlow را به چهار مسیر جدا تقسیم کنید: API و احراز هویت، persistence تراکنشی، telemetry time-series و workerهای محاسباتی. Electron و Web UI باید فقط با API ارتباط داشته باشند و هیچ credential دیتابیس یا queue در renderer قرار نگیرد.

```text
Electron / Web UI
       |
 HTTPS API + WebSocket Gateway
       |
 ┌─────┴──────────┐
 │                 │
Project DB      Job Queue ─── Solver Workers
(MySQL/TiDB)       │              │
 │                 └──── Result Store
 │
Telemetry DB  ←  MQTT / OPC UA / REST adapters
 │
Object Storage: reports, exports, project snapshots
```

### انتخاب سرویس‌ها

| نیاز | گزینه‌ی شروع | گزینه‌ی Enterprise | نکته‌ی طراحی |
|---|---|---|---|
| relational DB | MySQL managed یا TiDB Cloud | Aurora MySQL، AlloyDB-compatible یا TiDB Serverless | tenantId باید روی تمام جدول‌های سازمانی وجود داشته باشد |
| queue | Redis Streams یا BullMQ | SQS، RabbitMQ یا Kafka | job باید idempotency key و retry policy داشته باشد |
| worker | Node worker process | Kubernetes Job/Deployment یا container autoscaling | solver را از request thread جدا کنید |
| telemetry | PostgreSQL با hypertable | TimescaleDB، ClickHouse یا Influx-compatible | retention و downsampling از ابتدا تعریف شود |
| فایل و گزارش | S3-compatible object storage | S3 با KMS و lifecycle policy | فایل‌ها را با signed URL تحویل دهید |
| realtime | WebSocket gateway | managed gateway یا Redis pub/sub fanout | چند replica به broker مشترک نیاز دارند |

### مسیر داده‌ی محاسباتی

۱. API یک `jobId` و `idempotencyKey` تولید می‌کند و ورودی شبکه را در DB به‌صورت snapshot ذخیره می‌کند.

۲. پیام زیر در queue قرار می‌گیرد:

```json
{
  "jobId": "uuid",
  "tenantId": "tenant-123",
  "networkVersion": 7,
  "solverVersion": "hydraulic-1.0.0",
  "attempt": 1,
  "requestedAt": "2026-08-12T12:00:00.000Z"
}
```

۳. worker پیام را با lease دریافت می‌کند، snapshot را می‌خواند، حل‌گر را اجرا می‌کند و نتیجه را در `job_results` ذخیره می‌کند. اگر worker قطع شود، lease منقضی شده و job دوباره اجرا می‌شود.

۴. API با polling، SSE یا WebSocket وضعیت job را به کلاینت اعلام می‌کند. نتیجه هرگز فقط در حافظه‌ی worker نگهداری نمی‌شود.

### نمونه‌ی جدول‌های cloud

```sql
CREATE TABLE project_networks (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  name VARCHAR(160) NOT NULL,
  version INT NOT NULL,
  graph_json JSON NOT NULL,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL,
  UNIQUE KEY uq_network_version (id, version),
  INDEX ix_network_tenant (tenant_id, updated_at)
);

CREATE TABLE hydraulic_jobs (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  network_id CHAR(36) NOT NULL,
  network_version INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  result_json JSON NULL,
  error_code VARCHAR(80) NULL,
  created_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3) NULL,
  UNIQUE KEY uq_job_idempotency (tenant_id, idempotency_key),
  INDEX ix_job_status (status, created_at)
);
```

## ۲. WebSocket realtime برای سنسورها

کد پروژه اکنون endpoint زیر را روی همان HTTP server فعال می‌کند:

```text
/ws/telemetry?tenantId=<tenant>&token=<development-token>
```

در محیط development اگر `REALTIME_SHARED_TOKEN` تنظیم نشده باشد اتصال مجاز است. در production باید این متغیر حتماً تنظیم شود یا تابع `isAuthorized` با اعتبارسنجی session/OIDC جایگزین شود.

### مرحله ۱: متغیرهای محیطی

```env
REALTIME_SHARED_TOKEN=replace-with-a-secret-at-least-32-characters
REALTIME_ALLOWED_ORIGINS=https://app.example.com,https://desktop.example.com
```

در production این مقادیر را در secret manager قرار دهید، نه در repository یا فایل `.env` ارسالی به کاربر.

### مرحله ۲: اتصال browser یا Electron

```ts
const token = import.meta.env.VITE_REALTIME_TOKEN;
const tenantId = "tenant-123";
const ws = new WebSocket(
  `wss://api.example.com/ws/telemetry?tenantId=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`,
);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ type: "subscribe", metrics: ["pressure", "flow", "pump_speed"] }));
});

ws.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.type === "telemetry") {
    // Update chart/store; never trust the payload without schema validation.
    console.log(message.source, message.metric, message.value, message.unit);
  }
});
```

برای سامانه‌ی واقعی، token ثابت را در frontend قرار ندهید. بهترین الگو این است که frontend ابتدا با session/OIDC احراز هویت کند و یک short-lived WebSocket ticket از API بگیرد؛ ticket یک‌بارمصرف، tenant-scoped و دارای expiry کوتاه باشد.

### مرحله ۳: ارسال داده از adapter سنسور

Adapterهای MQTT/OPC UA/REST باید payload را به schema مشترک تبدیل کنند:

```json
{
  "tenantId": "tenant-123",
  "source": "pump-01",
  "metric": "pressure",
  "value": 2.41,
  "unit": "bar",
  "timestamp": "2026-08-12T12:00:01.123Z",
  "quality": "good"
}
```

سپس سرویس ingestion باید timestamp، واحد، محدوده‌ی فیزیکی، ترتیب زمانی و هویت دستگاه را بررسی کند. نقاط نامعتبر نباید به نمودار یا حل‌گر برسند؛ آن‌ها باید با quality=`bad` و reason قابل audit ثبت شوند.

### مرحله ۴: مقیاس‌پذیری چند replica

نسخه‌ی فعلی اتصال‌ها را در حافظه‌ی process نگه می‌دارد و برای یک replica مناسب است. برای چند replica، پس از ingestion باید event در Redis Pub/Sub، NATS یا Kafka منتشر شود. هر gateway پیام را دریافت و فقط به clientهای tenant و metric مربوطه broadcast می‌کند.

```text
Sensor Adapter -> Ingestion API -> Time-series DB
                         |
                    Pub/Sub topic
                         |
             WebSocket Gateway replicas
```

### مرحله ۵: reconnect و backpressure در client

کلاینت باید با backoff نمایی، jitter، تشخیص close code و resubscribe عمل کند. برای telemetry پرتعداد، همه‌ی نقاط را به UI ارسال نکنید؛ gateway باید sampling، aggregation یا latest-value mode داشته باشد. برای نمونه، نمایش dashboard معمولاً به latest value و پنجره‌ی یک تا پنج ثانیه‌ای نیاز دارد، نه هزاران پیام در ثانیه.

### مرحله ۶: الزامات امنیتی

از `wss://` استفاده کنید، Origin را allowlist کنید، tenant را از token استخراج و با query string تطبیق دهید، اندازه‌ی پیام را محدود کنید، تعداد اتصال و نرخ پیام را per-tenant محدود کنید، schema را با Zod اعتبارسنجی کنید و audit event برای اتصال‌های حساس، ingest و subscription نگه دارید. هیچ‌گاه `tenantId` ارسال‌شده از کلاینت را تنها منبع authorization قرار ندهید.

## ۳. ساخت خودکار Windows EXE

سه مسیر در پروژه وجود دارد:

| مسیر | دستور |
|---|---|
| build معمولی Electron | `pnpm desktop:dist` |
| build کامل با تست و check | `pnpm build:windows` |
| PowerShell | `./scripts/build-windows.ps1 -ReleaseVersion 1.0.1` |

اسکریپت `scripts/build-windows.mjs` به‌ترتیب lockfile را بررسی می‌کند، type-check، تست، web/backend build و سپس `electron-builder --win nsis portable --publish never` را اجرا می‌کند. اگر `RELEASE_VERSION` تنظیم شده باشد، باید با `package.json.version` برابر باشد.

در GitHub Actions:

```yaml
- run: pnpm build:windows
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    RELEASE_VERSION: ${{ github.ref_name }}
```

Tag باید مطابق الگوی `v1.0.1` باشد و `package.json` نسخه‌ی `1.0.1` داشته باشد. خروجی‌های مورد انتظار عبارت‌اند از:

```text
dist/PipeFlow-Pro-1.0.1-x64.exe
dist/PipeFlow-Pro-1.0.1-x64-portable.exe
dist/*.blockmap
```

برای release رسمی، workflow باید ابتدا quality job را سبز کند، سپس build ویندوز اجرا شود و در پایان artifactها در Release قرار گیرند. برای محیط Enterprise، قبل از انتشار code signing، checksum، SBOM و smoke test نصب/حذف را نیز به همین pipeline اضافه کنید.
