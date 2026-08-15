# کنترل نشت Tenant در Redis و WebSocket و گیت Chaos CI/CD

**نسخه:** v1.1.4 foundation  
**وضعیت:** کنترل‌های deterministic و test fixture پیاده‌سازی شده‌اند؛ ticket کوتاه‌عمر per-user و persistence کامل RBAC همچنان scope جداگانهٔ v1.1.4 هستند.  
**قاعده:** این گیت فقط روی Redis service fixture و داده synthetic اجرا می‌شود؛ هیچ اتصال Production، cache customer یا کاربر واقعی در CI وجود ندارد.

## ۱. کنترل‌های پیاده‌سازی‌شده

| لایه                  | کنترل                                                                               | پیاده‌سازی                                      | آزمون خودکار                                        |
| --------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Tenant identity       | tenant ID ورودی برای storage/stream/realtime باید opaque و در allowlist syntax باشد | `server/tenantIsolation.ts` با `assertTenantId` | شناسه حاوی delimiter/line-break رد می‌شود           |
| Redis keyspace        | ساخت key فقط از tenant، namespace و identifier validated انجام می‌شود               | `tenantRedisKey()`                              | Alpha و Beta key متفاوت؛ segment مبهم رد می‌شود     |
| Redis Stream envelope | event نامعتبر پیش از ورود به fallback یا Redis Stream رد می‌شود                     | `asStreamEvent()` و parser consumer             | tenant malformed نمی‌تواند telemetry envelope بسازد |
| WebSocket handshake   | token مشترک موقت فقط برای tenant پیکربندی‌شدهٔ server معتبر است                     | `REALTIME_SHARED_TOKEN_TENANT_ID`               | token Alpha برای connection Beta رد می‌شود          |
| Fail-closed           | token مشترک بدون binding در Production رد می‌شود                                    | `resolveRealtimeTenant()`                       | compatibility flag فقط با opt-in صریح ممکن است      |
| Delivery filter       | delivery به tenant یکسان و metric subscription مجاز محدود است                       | `canDeliverTelemetryToClient()`                 | Beta با wildcard event Alpha را دریافت نمی‌کند      |
| Evidence              | CI گزارش E2E JSON را upload می‌کند                                                  | `CHAOS_REPORT_PATH`                             | artifact با status، counts و observed tenants       |

OWASP توصیه می‌کند tenant context از هویت تأییدشده مشتق شود و هر lookup ownership را در لایه data access بررسی کند؛ client-supplied tenant ID نباید authority باشد. [1] برای WebSocket نیز authorization باید علاوه بر handshake، برای action/message اعمال شود. [2]

## ۲. Redis: مدل و کنترل نشت

### ۲.۱ آنچه اکنون کنترل می‌شود

Redis Streams در PipeFlow یک stream مشترک gateway است و eventها شامل `tenantId` هستند. worker event را validate می‌کند و `publishTelemetry()` قبل از ارسال، tenant client و tenant event را مقایسه می‌کند. به‌علاوه، helper جدید برای هر cache یا state Redis آینده، key را به‌صورت زیر می‌سازد:

```text
pipeflow:tenant:<validated-tenant>:<validated-namespace>:<validated-identifier>
```

این الگو از collision سادهٔ key بین tenantها و ورود delimiterهای مبهم جلوگیری می‌کند. با این حال، **key prefix به‌تنهایی authorization نیست**؛ هر consumer باید ownership را نیز validate کند.

### ۲.۲ قواعد الزامی برای cache، queue و streamهای بعدی

| قاعده                                                      | دلیل                                                  | گیت تست                              |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| key از helper ساخته شود، نه string interpolation در caller | جلوگیری از namespace collision و keyspace injection   | static review + unit test            |
| key/value حساس tenant metadata قابل بررسی داشته باشد       | defense-in-depth در برابر cache contamination         | mismatch fixture باید purge/deny شود |
| tenant/user/resource ID به Prometheus label تبدیل نشود     | جلوگیری از leakage و cardinality explosion            | metrics review                       |
| Redis consumer قبل از dispatch، envelope را validate کند   | جلوگیری از poisoned/malformed event                   | malformed envelope test              |
| queue/stream retry context tenant را حفظ کند               | جلوگیری از fallback بدون scope                        | retry/reclaim regression             |
| cache purge tenant-scoped و audited باشد                   | جلوگیری از global invalidation اشتباه یا orphan cache | operational runbook                  |

### ۲.۳ Redis Chaos E2E

`pnpm test:chaos:redis` یک Redis 7 service fixture با stream و consumer group unique می‌سازد، event Alpha و Beta را هم‌زمان publish می‌کند و این موارد را assert می‌کند:

1. mode واقعاً `redis` است و fallback in-memory استفاده نشده است.
2. هر event با همان tenant و trace ID به dispatch رسیده است.
3. دو event acknowledged شده‌اند و failure count صفر است.
4. artifact JSON فقط outcome و countهای غیرحساس را نگه می‌دارد؛ هیچ token یا payload مشتری در artifact نیست.

این تست **اثبات cache isolation production نیست**؛ cache tenant-aware هنوز باید در زمان افزودن cache feature از helper و suite مخصوص استفاده کند.

## ۳. WebSocket: مدل و کنترل نشت

### ۳.۱ handshake و binding

وضعیت قبلی اجازه می‌داد token مشترک معتبر، tenant ID query parameter را بدون binding tenant بپذیرد. کنترل جدید در Production چنین tokenی را فقط در دو حالت می‌پذیرد:

1. `REALTIME_SHARED_TOKEN_TENANT_ID` تنظیم شده باشد و tenant درخواست‌شده دقیقاً با آن یکسان باشد.
2. `REALTIME_ALLOW_LEGACY_SHARED_TOKEN=true` به‌صورت صریح و موقت تنظیم شده باشد.

حالت دوم فقط migration compatibility است و نباید در Production پایدار بماند. file `.env.example` به‌طور پیش‌فرض override را `false` قرار می‌دهد.

### ۳.۲ delivery و subscription

connection موفق به معنای authorization نامحدود نیست. هنگام dispatch، `canDeliverTelemetryToClient` فقط زمانی `true` می‌دهد که tenant event و client برابر باشند و subscription metric نیز اجازه دهد. آزمون deterministic ثابت می‌کند که wildcard subscription Beta مسیر نشت event Alpha نمی‌شود.

### ۳.۳ محدودیت صریح و مسیر بعدی

binding token مشترک، **جایگزین ticket کوتاه‌عمر user-bound نیست**. تا زمانی که schema سازمان/membership و ticket service کامل نشده‌اند، این کنترل فقط سطح خطر token مشترک را کاهش می‌دهد. گام بعدی باید ticket یک‌بارمصرف با TTL، subject، organization، origin، revoke و audit باشد؛ سپس tenant ID در query parameter فقط یک selector non-authoritative خواهد بود.

## ۴. Pipeline خودکار Chaos Engineering

Workflow جدید `.github/workflows/chaos-engineering.yml` با نام **Chaos Engineering Gate** روی pull requestهای مرتبط، push به شاخهٔ Enterprise و اجرای دستی فعال است.

| مرحله Pipeline          | آنچه تأیید می‌کند                                             | اثر شکست                        |
| ----------------------- | ------------------------------------------------------------- | ------------------------------- |
| install + type-check    | type/API کنترل‌های isolation سالم است                         | job fail                        |
| `pnpm test:chaos`       | Redis key/envelope و WebSocket binding/delivery deterministic | job fail و merge gate ناکام     |
| `pnpm test:chaos:redis` | Redis Streams E2E fixture با Alpha/Beta                       | job fail و artifact evidence    |
| upload artifact         | گزارش JSON حتی در failure حفظ می‌شود                          | evidence قابل بررسی برای triage |

Workflow از Redis `7-alpine` service داخلی runner استفاده می‌کند و `REDIS_URL=redis://127.0.0.1:6379` را فقط برای job تعریف می‌کند. concurrency باعث می‌شود workflowهای قدیمی همان ref لغو شوند؛ این کار صرفه‌جویی در runner است، نه جایگزین evidence آخرین run.

## ۵. اجرای محلی

```bash
# deterministic checks؛ Redis لازم ندارد
pnpm test:chaos

# Redis E2E؛ Redis 7 باید در دسترس باشد
REDIS_URL=redis://127.0.0.1:6380 \
CHAOS_REPORT_PATH=test-results/chaos/redis-tenant-isolation.local.json \
pnpm test:chaos:redis
```

پیش از merge یا release، `pnpm check`، suite کامل، suite Chaos و E2E Redis باید سبز باشند. برای تست‌های fault injection واقعی مانند Redis outage یا lock contention، فقط staging production-like و playbook Chaos Engineering پیشین مجاز است.

## ۶. پاسخ به failure CI

| failure                    | first action                                                                              | ممنوع                                            |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| unit tenant isolation fail | PR را block، diff context/repository policy را بررسی و regression test اضافه کنید         | waive بدون security owner                        |
| Redis E2E fail             | artifact JSON، Redis health و stream/group isolation را بررسی؛ retry فقط پس از root-cause | fallback production یا حذف assertion tenant      |
| token binding fail         | config migration را بررسی و ticket roadmap را اولویت دهید                                 | فعال نگه‌داشتن legacy override بدون expiry/owner |
| artifact missing           | job config/path را اصلاح؛ evidence persistence بخشی از گیت است                            | نتیجه‌گیری از log ناقص                           |

## منابع

[1] [OWASP Multi-Tenant Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)

[2] [OWASP WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)

[3] [OWASP Authorization Regression Testing Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Regression_Testing_Cheat_Sheet.html)
