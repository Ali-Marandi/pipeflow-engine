# تحلیل ریسک امنیتی شکست Tenant-Scoped در Drizzle

**دامنه:** طراحی v1.1.4 PipeFlow برای shared-table multi-tenancy با MySQL و Drizzle ORM.  
**وضعیت ارزیابی:** طراحی پیش از پیاده‌سازی؛ این گزارش وجود exploit یا آسیب‌پذیری بالفعل در release فعلی را ادعا نمی‌کند. ریسک‌ها failure modeهایی هستند که باید پیش از migration، pilot یا Production کنترل و آزموده شوند.  
**حکم معماری:** در MySQL shared-table، جداسازی tenant عمدتاً در لایه application/repository اعمال می‌شود؛ بنابراین هر مسیر query، transaction، cache، stream و realtime باید tenant context سرور-مشتق را حفظ کند. ماندن تنها یک predicate در UI یا router، مرز امنیتی معتبر نیست.

> OWASP بر مشتق‌کردن tenant context در ابتدای request از هویت تأییدشده، عدم اعتماد به tenant ID ارسالی client، و اعمال ownership check در data access layer تأکید می‌کند. [1]

## ۱. دارایی‌ها، trust boundary و فرضیات

| دارایی | اثر شکست isolation | مرز trust مورد انتظار |
|---|---|---|
| شبکه، calculation، fluid، pipe material و network version | افشای design/assumption یا تغییر مدل مشتری دیگر | tenant ID از membership/session، نه input client |
| hydraulic job/result/report | افشای نتیجه مهندسی، manipulation یا حذف evidence | repository tenant-scoped + permission policy |
| membership/role | privilege escalation یا tenant impersonation | RBAC از membership active server-side |
| telemetry/Redis Stream/WebSocket | نشت زمان‌واقعی یا subscription اشتباه | ticket کوتاه‌عمر، scope server-side، per-message policy |
| cache/file storage | نشت persist یا stale data بین tenantها | key/path prefix tenant-aware و ownership validation |
| migration/audit | assignment اشتباه، evidence ناقص یا information leak | verified mapping، immutable audit و least-privilege access |
| metric/log/support tooling | نشت metadata یا bypass خارج از API | redaction، label cardinality کنترل‌شده و break-glass governance |

### معماری target

1. `createContext` هویت را تأیید می‌کند و فقط workspace/organizationی را انتخاب می‌کند که membership فعال آن برای actor معتبر است.
2. `tenantProcedure` تنها پس از authentication، membership و permission، یک `TenantContext` immutable می‌سازد.
3. repositoryهای domain فقط با `TenantContext` ساخته می‌شوند و هر select/update/delete با `organizationId` context predicate می‌گیرد.
4. insertها `organizationId` را از context اختصاص می‌دهند؛ input client هرگز authority تعیین tenant نیست.
5. cache/stream/file/ticket keyها tenant-aware هستند؛ WebSocket permission فقط handshake نیست و در action/subscription نیز enforce می‌شود.
6. audit و regression suite، denial و allow را با actor tenant و target tenant ثبت/آزمون می‌کنند، بدون ثبت raw secret/payload.

## ۲. سطح حمله و failure modeهای اصلی

| ID | failure mode | علت نمونه | اثر بالقوه | inherent risk | کنترل پیشگیرانه | آشکارسازی/پاسخ |
|---|---|---|---|---|---|---|
| R-01 | read بدون predicate tenant | lookup فقط بر اساس resource ID | افشای data/metadata tenant دیگر | Critical | repository فقط `getById(ctx,id)`؛ composite predicate/unique/index | Alpha/Beta regression؛ audit deny؛ SEV-0 on leak |
| R-02 | update/delete bulk بدون tenant scope | `where(id=…)` یا bulk helper عمومی | تغییر/حذف داده مشتری دیگر | Critical | mutation API فقط scoped repository؛ condition شامل org | before/after state diff؛ immutable audit؛ stop campaign |
| R-03 | tenant context injection | header/query/body `organizationId` معتبر فرض می‌شود | impersonation و cross-tenant access | Critical | context از session+membership؛ client ID فقط selector validate‌شده | negative tests؛ context mismatch alert |
| R-04 | bypass با raw SQL یا import DB عمومی | service جدید مستقیم `db.select()` می‌زند | حذف enforcement معماری | Critical | lint/import boundary؛ raw SQL allowlist + review؛ CODEOWNERS | static scan + query review + CI gate |
| R-05 | join/aggregate/fallback ناقص | relation یا report query tenant filter ندارد | leak در list/search/count/export | High | tenant predicate در root و join؛ contract test list/search/export | cross-tenant broad-read suite |
| R-06 | tenant context در transaction از دست می‌رود | helper transaction بدون ctx، async callback اشتباه | read/write با scope مبهم | High | `withTenantTx(ctx,fn)`؛ ctx parameter required و immutable | transaction test + audit target mismatch |
| R-07 | membership/role stale | logout/suspend/revoke ticket session را invalid نمی‌کند | access بعد از revoke، vertical escalation | High | membership active check، short ticket، revoke/close connection | mid-session revoke regression + alert |
| R-08 | cache/Redis key بدون tenant namespace | key بر user/resource ساخته می‌شود | stale/shared data و cache poisoning | High | tenant-scoped key builder؛ embedded tenant validation | cache collision fixture + purge on mismatch |
| R-09 | stream/WS subscription scope اشتباه | source ID یا event channel cross-tenant resolve می‌شود | live telemetry leak | Critical | ticket bound to tenant+subject+TTL+single-use؛ per-action authz | WS source Alpha/Beta test; close/revoke evidence |
| R-10 | migration mapping/orphan | legacy record بدون owner یا mapping incorrect | wrong tenant assignment یا later enforcement outage | High | dry-run, exception quarantine, verification, no auto-enforce | coverage/orphan metrics; cutover block |
| R-11 | audit/log/metric leakage | tenant IDs/payloads/raw report fields در log/labels | secondary disclosure، compliance gap | Medium/High | redaction policy، fixed labels، least privilege | log review/secret scan; incident triage |
| R-12 | support/admin bypass بدون governance | global admin reads all data by default | excessive privilege و untraceable access | High | explicit break-glass workflow، reason+time+audit+dual approval | audit review and periodic access recertification |
| R-13 | noisy-neighbor exhaustion | batch/telemetry tenant واحد DB/queue را اشباع می‌کند | availability loss برای tenantهای دیگر | High | per-tenant quota/rate limit/backpressure; bounded worker | latency/lag/capacity alert; load/chaos test |
| R-14 | test gap پس از refactor | router/repository جدید از matrix خارج است | regression به production می‌رسد | High | machine-readable policy matrix, required CI suite | blocked PR on isolation/authz failure |

## ۳. تحلیل ریسک با سناریوهای Drizzle

### ۳.۱ خطای ساکت در query builder

Drizzle type safety به‌تنهایی تضمین نمی‌کند که هر query predicate tenant دارد. کدی که از نظر TypeScript صحیح است، ممکن است `eq(table.id, resourceId)` را بدون `eq(table.organizationId, ctx.organizationId)` اجرا کند. بنابراین کنترل اصلی، **shape API** است نه اعتماد به ORM:

```ts
// طرح امن: repository تنها با context معتبر ساخته می‌شود.
const network = await tenantNetworks(ctx).getById(networkId);

// طرح ممنوع: domain service به db عمومی یا organizationId ارسالی client دسترسی مستقیم دارد.
const network = await db.query.networks.findFirst({ where: eq(networks.id, networkId) });
```

نمونهٔ بالا policy design است و باید با schema واقعی/نام‌گذاری نهایی v1.1.4 تطبیق داده شود. هیچ helper عمومی `findById` برای tenant-owned entity بدون `TenantContext` نباید وجود داشته باشد.

### ۳.۲ الگوی schema و query policy

| قانون | الزام عملی |
|---|---|
| ownership column | هر entity tenant-owned `organizationId` non-null پس از migration contract دارد |
| indexes/uniqueness | indexهای query با `(organizationId, id)` یا `(organizationId, naturalKey)` طراحی می‌شوند؛ unique global فقط اگر product policy آن را توجیه کند |
| select | root query و joinها از tenant scope آغاز می‌شوند؛ list/search/export نیز scope دارند |
| mutation | update/delete باید هم `resourceId` و هم `organizationId` context را match کنند؛ zero-row mutation به‌عنوان denied/not-found policy-consistent رسیدگی می‌شود |
| insert | ownership از context set می‌شود و input `organizationId` نادیده/رد می‌شود مگر system migration path با privilege مستقل |
| transaction | context immutable به همه helperها منتقل می‌شود؛ helper فاقد context نمی‌تواند tenant table را تغییر دهد |
| system path | migration/support/background worker context جدا با policy/audit/approval دارد؛ هرگز از user router قرض گرفته نمی‌شود |

### ۳.۳ کنترل codebase و CI

| control | هدف | evidence پذیرش |
|---|---|---|
| module boundary | جلوگیری از import مستقیم db در router/domain غیرمجاز | lint rule/CI report بدون violation |
| tenant repository interface | اجبار context در CRUD | unit/type test برای عدم وجود public unscoped method |
| raw SQL registry | جلوگیری از bypass پنهان | allowlist با owner، reason، query review و test |
| policy matrix | Actor → Tenant → Resource → Action → Expected | YAML/fixture versioned در repo |
| contract/regression | API/WS read/write/delete/list/export/revoke در دو tenant | required CI job و artifact redacted |
| property/fuzz محدود | کشف combinationهای ID/role/filter | synthetic fixture only; no production scan |
| migration verification | coverage/orphan/mapping and audit | green JSON artifact پیش از enforce |
| dependency/config review | جلوگیری از authz bypass در refactor/config | PR checklist + security sign-off |

OWASP توصیه می‌کند authorization test matrix به‌صورت machine-readable نگهداری و failure آن به required CI gate تبدیل شود؛ cross-tenant boundary test باید absence کامل data tenant دیگر را اثبات کند. [2]

## ۴. کنترل‌های پیشگیرانه، آشکارساز و بازیابی

| لایه | پیشگیرانه | آشکارساز | بازیابی/مهار |
|---|---|---|---|
| Context | server-derived membership/context، deny-by-default | context mismatch/denial audit | invalidate session/ticket، suspend membership، fail closed |
| Repository | scoped interface، no public db import | CI static/contract tests | hotfix scoped predicate، regression backfill/verify |
| Database | FK/index/constraint، least-privilege DB account | audit/reconciliation/DB errors | pause writes, clone repair plan, restore only with DBA |
| Cache/Redis | tenant namespace + metadata check | collision fixture، key/purge anomaly | invalidate affected namespace, rebuild from DB |
| Realtime | scoped single-use ticket، origin/action policy | cross-source rejection/close log | revoke tickets/connections, disable affected subscription |
| Migration | expand/backfill/verify/enforce gates | pending/orphan/exception/verification metrics | stop next batch, quarantine, forward repair or recovery process |
| Observability | redacted logs, non-sensitive labels, alert route | secret scan, missing monitoring alert | freeze cutover, fix monitoring, preserve evidence |
| Operations | break-glass approvals, change control | audit review, tabletop findings | incident command, security triage, customer/legal path |

## ۵. Risk acceptance و decision rules

| شرط | تصمیم |
|---|---|
| هر read/write/delete/event cross-tenant تأیید شود | SEV-0؛ release/pilot/cutover block؛ containment و full retest |
| tenant context از client قابل تغییر باشد | Critical design failure؛ implementation اصلاح شود |
| CI isolation matrix یا monitoring evidence موجود نباشد | Not ready؛ هیچ approval مبتنی بر «احتمالاً درست است» صادر نمی‌شود |
| migration orphan/ambiguous ownership داشته باشد | enforcement block؛ quarantine و policy decision لازم است |
| raw SQL/system bypass فاقد owner/audit باشد | code review blocker تا حذف یا registry/test کامل |
| regression green، recovery/monitoring tested و risk owner approval باشد | canary/staging progression؛ نه production entitlement خودکار |

## ۶. محدودیت‌های باقیمانده

1. application-level enforcement در shared MySQL table دفاع عمیق لازم دارد و معادل database-enforced RLS نیست. مشتریان با نیاز regulatory/isolation بالاتر ممکن است schema-per-tenant یا database-per-tenant را نیاز داشته باشند؛ این یک تصمیم product/security جداگانه است.
2. test pass نبودن آسیب‌پذیری را اثبات نمی‌کند؛ فقط confidence را برای مسیرهای آزموده‌شده افزایش می‌دهد.
3. log/metrics باید قابل مشاهده باشند، اما نباید به کانال نشت tenant metadata تبدیل شوند.
4. support و break-glass بدون governance، حتی با query policy خوب، می‌تواند مرز اعتماد را تخریب کند.

## منابع

[1] [OWASP Multi-Tenant Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)

[2] [OWASP Authorization Regression Testing Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Regression_Testing_Cheat_Sheet.html)
