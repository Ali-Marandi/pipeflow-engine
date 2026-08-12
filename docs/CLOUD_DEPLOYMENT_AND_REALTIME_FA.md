# راهنمای استقرار ابری و مانیتورینگ بلادرنگ PipeFlow Pro

**نسخه سند:** 1.1  
**مخاطب:** تیم مهندسی، DevOps و بهره‌برداری PipeFlow Pro

## هدف عملیاتی

این نسخه، telemetry را از API تایپ‌دار دریافت می‌کند، آن را با Redis Streams پایدار می‌سازد، و سپس به WebSocketهای متصل‌شده fanout می‌کند. مسیر واقعی داده به‌شکل زیر است:

```text
Sensor / SCADA adapter → enterprise.ingestTelemetry → Redis XADD
                                          ↓
                         Redis Streams consumer group per gateway
                                          ↓
                          WebSocket /ws/telemetry → React dashboard
```

Redis Streams برای پردازش حداقل یک‌بار طراحی شده است: producer با `XADD` رویداد را ثبت می‌کند، consumer با `XREADGROUP` می‌خواند و فقط بعد از انتشار در gateway با `XACK` آن را تأیید می‌کند. پیام‌های تأییدنشده با `XAUTOCLAIM` به consumer سالم منتقل می‌شوند. این الگو به idempotency در مصرف‌کننده نیاز دارد. [1]

> **تصمیم مقیاس‌پذیری:** هر WebSocket gateway یک consumer group اختصاصی مبتنی بر نام Pod دارد. اگر همه‌ی gatewayها در یک group مشترک باشند، Redis پیام‌ها را بین آن‌ها تقسیم می‌کند و dashboardهای متصل به Podهای دیگر داده را از دست می‌دهند. اما workerهای محاسبات سنگین باید group مشترک جداگانه داشته باشند تا وظایف واقعاً بین workerها تقسیم شوند.

## گزینه‌های استقرار

| رویکرد | مناسب برای | مزیت اصلی | ملاحظه |
|---|---|---|---|
| Docker Compose روی یک VM | پایلوت، محیط مشتری، سایت صنعتی کوچک | سریع، قابل‌فهم و کنترل کامل روی شبکه و فایل‌ها | HA، rollout و autoscaling باید توسط تیم عملیات مدیریت شود |
| Kubernetes با MySQL/Redis مدیریت‌شده | محیط چندمشتری، ترافیک متغیر و نیاز به HA | rollout تدریجی، readiness، autoscaling و چند replica | نیازمند cluster، registry، ingress و مدیریت secrets است |

## تنظیم متغیرهای محیطی

| متغیر | نمونه | کاربرد |
|---|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/pipeflow` | دیتابیس عملیاتی پروژه‌ها و داده‌های کاربری |
| `REDIS_URL` | `rediss://:pass@redis-host:6380` | Streams و fanout بلادرنگ؛ در production از TLS استفاده شود |
| `REDIS_TELEMETRY_STREAM` | `pipeflow:telemetry:v1` | نام log پایدار telemetry |
| `PIPEFLOW_INSTANCE_ID` | نام Pod | ساخت group اختصاصی gateway |
| `REALTIME_SHARED_TOKEN` | secret طولانی و تصادفی | حداقل محافظت WebSocket؛ برای multi-tenant باید با ticket کوتاه‌عمر OIDC جایگزین شود |
| `REALTIME_ALLOWED_ORIGINS` | `https://app.example.com` | allowlist دقیق Origin برای مرورگر |

در محیط production، `REALTIME_SHARED_TOKEN` نباید در frontend یا URLهای قابل log‌شدن نگهداری شود. پیاده‌سازی فعلی برای انتقال اولیه مناسب است، اما گام بعدی باید endpoint صدور WebSocket ticket کوتاه‌عمر باشد که claimهای `userId`، `tenantId` و expiry را امضا می‌کند.

## استقرار Docker Compose

فایل‌های `Dockerfile`، `.dockerignore`، `docker-compose.yml` و `.env.example` در repository آماده شده‌اند. Compose به‌شکل آگاه از سلامت اجرا می‌شود: MySQL و Redis ابتدا healthy می‌شوند، migration اجرا می‌شود، و سپس application شروع می‌شود. Compose به‌تنهایی فقط ترتیب start را تضمین نمی‌کند؛ شرط `service_healthy` و `service_completed_successfully` برای این ترتیب لازم است. [2]

ابتدا secretها را در فایل `.env` محلی و خارج از Git تنظیم کنید:

```bash
cp .env.example .env
# مقادیر placeholder را با passwordها و tokenهای تصادفی واقعی جایگزین کنید.
```

سپس stack را بسازید و اجرا کنید:

```bash
docker compose build
docker compose up -d
docker compose ps
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

برای مشاهده وضعیت Stream و gateway، پاسخ `/healthz` شامل شمارنده‌های `produced`، `delivered`، `acknowledged`، `failures` و وضعیت اتصال Redis است. `/readyz` در صورت تنظیم Redis تنها هنگامی 200 بازمی‌گردد که اتصال Streams برقرار شده باشد. پیش از بازکردن پورت عمومی، reverse proxy با TLS، allowlist مبدأ و firewall اعمال کنید.

## استقرار Kubernetes

مانيفست `deploy/kubernetes/pipeflow.yaml` شامل Namespace، ConfigMap، Secret نمونه، Deployment دو replica، Service، HPA و Ingress است. Kubernetes با readiness probe فقط Pod آماده را وارد Service می‌کند؛ liveness probe نیز processهای معیوب را restart می‌کند. [3] HPA بر پایه CPU به resource request وابسته است و برای metricهای سفارشی مانند Redis lag باید metrics adapter جداگانه فراهم شود. [4]

پیش از apply، image را در registry خصوصی یا GHCR منتشر کنید و مقدار image را در manifest به نسخه‌ی immutable تغییر دهید. همچنین secret نمونه را از repository حذف و از Secret manager یا External Secrets استفاده کنید:

```bash
kubectl create namespace pipeflow
kubectl -n pipeflow create secret generic pipeflow-secrets \
  --from-literal=DATABASE_URL='mysql://USER:PASSWORD@HOST:3306/pipeflow' \
  --from-literal=REDIS_URL='rediss://:PASSWORD@HOST:6380' \
  --from-literal=REALTIME_SHARED_TOKEN='RANDOM_LONG_SECRET' \
  --dry-run=client -o yaml | kubectl apply -f -

# سپس Secret نمونه را از manifest حذف کرده یا در CI با secret واقعی replace کنید.
kubectl apply -f deploy/kubernetes/pipeflow.yaml
kubectl -n pipeflow rollout status deployment/pipeflow-gateway
kubectl -n pipeflow get pods,svc,ingress,hpa
```

اگر Ingress controller متفاوت از NGINX استفاده می‌شود، annotationهای timeout را با معادل آن controller جایگزین کنید. WebSocket به اتصال طولانی نیاز دارد؛ timeout proxy باید بزرگ‌تر از heartbeat/reconnect interval کلاینت باشد.

## طراحی Redis Streams و عملیات روزانه

| مؤلفه | نام پیشنهادی | سیاست |
|---|---|---|
| Stream telemetry | `pipeflow:telemetry:v1` | `MAXLEN ~ 100000` برای retention تقریبی و اقتصادی |
| Gateway group | `pipeflow-realtime-v1:<pod>` | یک group به‌ازای هر gateway برای fanout کامل |
| Compute worker group | `pipeflow-compute-v1` | یک group مشترک برای تقسیم hydraulic jobs بین workerها |
| Dead-letter Stream | `pipeflow:telemetry:dlq:v1` | پیام‌های poison یا نامعتبر پس از سقف retry |
| Consumer identity | `<pod-name>` | قابل ردیابی در `XINFO CONSUMERS` |

برای عملیات و capacity planning، lag گروه‌ها، تعداد pending entries، oldest idle time، delivery count، throughput `XADD`، زمان end-to-end و تعداد clientهای WebSocket را جمع‌آوری کنید. اگر `XAUTOCLAIM` مکرراً یک event را دریافت کند، آن را به DLQ منتقل و با `eventId` برای investigation ثبت کنید. Redis Streams بر مبنای at-least-once عمل می‌کند، بنابراین tableهای persistence باید کلید یکتای `eventId` داشته باشند تا side effect تکراری رخ ندهد. [1]

## تست و benchmark Windows package

اسکریپت `scripts/benchmark-windows.ps1` پس از build، این موارد را بررسی می‌کند:

| آزمون | معیار قبولی |
|---|---|
| وجود artifact | NSIS installer و portable EXE نسخه‌ی موردنظر در `dist/` وجود داشته باشند |
| hash | SHA-256 هر دو فایل در JSON گزارش ثبت شود |
| smoke launch | portable EXE با `--smoke-test` backend داخلی و renderer را بارگذاری کند |
| launch benchmark | حداقل دو بار launch و median زمان process و Electron ثبت شود |

روی Windows محلی:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm test
$env:RELEASE_VERSION = "v1.1.0"
pnpm build:windows
./scripts/benchmark-windows.ps1 -Version 1.1.0 -LaunchIterations 3
Get-Content dist/benchmarks/windows-executable-benchmark.json
```

در GitHub Actions، workflow همین smoke test را بعد از ساخت EXE اجرا و JSON را به‌عنوان artifact `pipeflow-windows-validation-<tag>` منتشر می‌کند. Installer و Portable executable فقط در صورت قبولی benchmark به Release اضافه می‌شوند.

## قابلیت‌های جدید پیاده‌سازی‌شده در این مرحله

| قابلیت | وضعیت |
|---|---|
| Redis Streams producer/consumer، XACK و XAUTOCLAIM | پیاده‌سازی شده |
| WebSocket fanout قابل scale با consumer group اختصاصی هر Pod | پیاده‌سازی شده |
| health/readiness probes با وضعیت telemetry | پیاده‌سازی شده |
| Alert rule و incident acknowledgement | پیاده‌سازی شده؛ persistence فعلاً in-memory است |
| Docker Compose با MySQL، Redis، migration و healthcheck | پیاده‌سازی شده |
| Kubernetes Deployment، HPA، Ingress و security context | پیاده‌سازی شده |
| smoke-test و launch benchmark executable Windows | پیاده‌سازی شده |

## اولویت‌های Enterprise بعدی

در نسخه‌ی بعدی، اولویت باید persistence واقعی alert/job/network در MySQL، OIDC/SSO و RBAC مبتنی بر tenant، WebSocket ticket کوتاه‌عمر، Prometheus/OpenTelemetry، DLQ واقعی، worker service جداگانه برای hydraulic jobs، data retention policy و export PDF/Excel ممیزی‌پذیر باشد. بعد از آن، Digital Twin calibration، NPSH/cavitation analysis، GIS/BIM integration، condition monitoring مبتنی بر مدل و anomaly detection می‌توانند محصول را به سطح رقابتی بالاتر برسانند.

## منابع

[1] [Redis, Redis streaming with node-redis](https://redis.io/docs/latest/develop/use-cases/streaming/nodejs/)

[2] [Docker, Control startup and shutdown order in Compose](https://docs.docker.com/compose/how-tos/startup-order/)

[3] [Kubernetes, Configure liveness, readiness and startup probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)

[4] [Kubernetes, Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
