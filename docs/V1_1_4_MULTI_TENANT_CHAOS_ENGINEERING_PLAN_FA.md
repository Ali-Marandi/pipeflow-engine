# برنامه پایداری و Chaos Engineering برای معماری Multi-Tenant PipeFlow

**نسخه:** ۱.۰  
**دامنه:** v1.1.4 Tenant Foundation، Backfill، MySQL/Drizzle، Redis Streams، WebSocket، observability و مسیرهای recovery.  
**هدف:** افزایش confidence در این‌که failureهای واقع‌گرایانه باعث عبور data/action از مرز tenant، از دست‌رفتن غیرقابل‌تشخیص migration state یا cascade غیرقابل‌کنترل نمی‌شوند.  
**محدودیت:** همه آزمایش‌های نخست در local/CI/staging production-like با fixture synthetic اجرا می‌شوند. هیچ experiment نباید برای کشف نشت داده، customer data را در معرض قرار دهد یا از طریق scan، flood یا failure uncontrolled تولید شود.

Chaos Engineering با تعریف steady state قابل سنجش، فرض پایداری آن، اعمال یک متغیر واقع‌گرایانه و تلاش برای رد فرض از طریق مقایسه control و experiment کار می‌کند. اصل کلیدی، **کمینه‌سازی blast radius** است. [1]

## ۱. سیاست ایمنی Chaos

| اصل | اجرای لازم در PipeFlow |
|---|---|
| Steady state قبل از injection | SLIهای tenant isolation، API/WS، Backfill progress، verify و monitoring پیش از شروع سبز و ثبت می‌شوند |
| کمینه‌سازی blast radius | فقط fixture tenantهای Alpha/Beta، یک fault در هر experiment، timebox، auto-stop و kill switch |
| production-last | Production فقط پس از stage pass و فقط experiment کم‌خطر روی internal/canary tenant با approval جداگانه؛ no customer-data fault injection |
| controlled variables | faultهای reversible، محدود و pre-approved؛ DB destructive action، cross-tenant mutation و network flood ممنوع |
| observation-first | metric/log/audit/dashboard پیش از experiment تایید؛ monitoring blind = no experiment |
| no surprise changes | schedule، owner، rollback/abort plan، communication channel و stop authority از پیش ثبت می‌شود |
| learning loop | هر finding به regression test، runbook update یا architecture action item با owner/date تبدیل می‌شود |

## ۲. Steady-State Contract

### ۲.۱ SLIهای مورد مشاهده

| SLI | steady-state hypothesis | source | hard stop |
|---|---|---|---|
| Tenant isolation | Beta هیچ record/identifier/event Alpha نمی‌بیند و mutation Alpha نمی‌کند | policy regression + audit | هر نشتی confirmed/suspected؛ SEV-0 |
| Authorization/revoke | user suspended یا ticket expired/reused مطابق policy rejected است | API/WS test + security log | unauthorized allow یا replay bypass |
| API availability/latency | outcome interactive در budget مصوب باقی می‌ماند | SLO dashboard/k6 | breach approved change budget |
| Backfill integrity | pending کاهش کنترل‌شده، exception resolved، verify green | audit + verify + metrics | mismatch/orphan blocker |
| Progress | `last_progress` از stall budget خارج نمی‌شود | Backfill metric | stall beyond approved threshold |
| DB/platform health | DB lock/connection/IO و Redis readiness داخل budget | DBA/Platform dashboard | capacity/availability breach |
| Observability | scrape، log and alert path سالم است | synthetic alert | monitoring blind |

عددهای budget/threshold باید از register SLO/SLA و baseline محیط همان change استخراج شوند؛ این طرح عمداً عدد سراسری تعیین نمی‌کند.

### ۲.۲ Control group و experiment group

| عنصر | Control | Experiment |
|---|---|---|
| tenant | Alpha/Beta fixture بدون fault | Alpha/Beta fixture با یک inject محدود |
| workload | API/WS/Backfill baseline ثبت‌شده | همان workload + یک chaos variable |
| data | snapshot synthetic ثابت | clone همان snapshot؛ هر experiment reset می‌شود |
| evidence | metrics/audit/log baseline | metrics/audit/log بعد injection |
| تصمیم | baseline pass | pass/abort/finding با مقایسه نسبت به baseline |

## ۳. چرخه عملیاتی هر Experiment

1. **Hypothesis:** یک جمله قابل رد، مانند «قطع worker بین batchها باعث هیچ assignment نیمه‌تمام یا leak نمی‌شود و verify وضعیت را مشخص می‌کند.»
2. **Preconditions:** fixture، deploy version، dashboard، alert route، backup/restore state، approver و kill switch ثبت می‌شوند.
3. **Baseline:** حداقل یک بازه control برای SLIهای section 2 ذخیره می‌شود.
4. **Injection:** فقط fault تعریف‌شده و فقط در blast radius مصوب اعمال می‌شود.
5. **Observe:** SLIها، audit، log redacted و user workflow برای زمان/timebox مقرر دیده می‌شوند.
6. **Abort:** اگر hard stop فعال شد، inject قطع، change freeze و incident/runbook اجرا می‌شود؛ experiment تا analysis مستقل ادامه نمی‌یابد.
7. **Recover:** state به snapshot/known baseline بازمی‌گردد، verification و regression اجرا می‌شود.
8. **Learn:** result شامل hypothesis، outcome، evidence، risk، owner و test automation ثبت می‌شود.

## ۴. آزمایش‌های پیشنهادی

### CE-01 — توقف کنترل‌شده worker بین batchها

| مورد | طراحی |
|---|---|
| هدف | تاب‌آوری checkpoint و transaction boundary Backfill |
| فرضیه | قطع worker بعد از terminal batch و پیش از batch بعدی، state نامشخص/نشت tenant تولید نمی‌کند؛ restart idempotent است |
| injection مجاز | graceful cancellation/process stop در staging پس از ثبت checkpoint؛ نه kill database server |
| observation | `in_progress`, last progress, audit status, pending count, verify output, API availability |
| pass | batch قبلی terminal، pending/coverage قابل تبیین، restart duplicate org/membership ایجاد نمی‌کند، verify green |
| abort | transaction/assignment مبهم، data mismatch، lock طولانی، API impact خارج budget |
| recovery | worker متوقف، verify read-only، clone reset یا approved idempotent resume |

### CE-02 — transient database connection failure

| مورد | طراحی |
|---|---|
| هدف | رفتار fail-safe Drizzle/MySQL path در خطای connection |
| فرضیه | failure به‌صورت explicit ثبت می‌شود؛ Backfill resume کور ندارد؛ user API denial/error policy-consistent است |
| injection مجاز | proxy/test double یا controlled network rule در staging برای زمان محدود، فقط worker connection pool |
| observation | transaction outcome، retry count، error class، connection metrics، API/WS SLI |
| pass | no silent partial commit، no retry storm، alert/runbook فعال، worker توقف یا backoff طبق policy |
| abort | DB impact فراتر از blast radius، connection exhaustion یا telemetry/data leak |
| recovery | fault remove، DB health confirm، verify، change approval جدید برای retry |

### CE-03 — lock contention روی data test

| مورد | طراحی |
|---|---|
| هدف | جلوگیری از noisy-neighbor و تشخیص stall در Backfill |
| فرضیه | lock controlled، progress alert تولید می‌کند؛ interactive workload از budget نمی‌گذرد یا campaign به‌موقع hold می‌شود |
| injection مجاز | contention روی table/rows fixture جدا در staging، با timeout محدود و DBA observer |
| observation | DB lock/wait, batch duration, `last_progress`, API p95/error, alert latency |
| pass | stop/hold در budget، transaction cleanup، DB به baseline بازمی‌گردد |
| abort | lock از scope fixture عبور کند یا platform health degrade شود |
| recovery | inject remove، transaction completion/rollback confirm، dashboard baseline compare |

### CE-04 — Redis/telemetry dependency unavailable

| مورد | طراحی |
|---|---|
| هدف | جداسازی failure realtime/Redis از tenant integrity و migration correctness |
| فرضیه | Redis outage باعث bypass ticket یا cross-tenant fallback نمی‌شود؛ readiness/feature behavior واضح است |
| injection مجاز | Redis test instance/namespace unavailable در staging؛ نه shared customer Redis |
| observation | `/readyz`, redis readiness, WS connect/subscription result, stream failures, Backfill audit |
| pass | ticket issue/connect طبق fail-closed policy رد/محدود، no shared-token fallback، Backfill DB state مستقل/مشخص |
| abort | event leak، uncontrolled reconnect storm، cache data mismatch |
| recovery | Redis restore، replay/reconcile policy، ticket/connection revalidation، regression rerun |

### CE-05 — ticket store restart و replay/revoke

| مورد | طراحی |
|---|---|
| هدف | اطمینان از اینکه lifecycle ticket به availability degradation تبدیل به authorization bypass نمی‌شود |
| فرضیه | ticket تک‌مصرف، expired یا revoked پس از transient state loss/restore، authority اضافی نمی‌دهد |
| injection مجاز | restart controlled component/namespace ticket در staging، test ticketهای fixture |
| observation | issue/consume/replay/revoke outcomes، WS sessions، audit/alert redacted |
| pass | tenant-source Alpha با Beta ticket قابل subscription نیست؛ replay/expiry deny؛ session policy-consistent |
| abort | authenticated cross-tenant channel یا ambiguous ticket authority |
| recovery | revoke test sessions، clean namespace، run WS authz matrix |

### CE-06 — cache namespace collision simulation

| مورد | طراحی |
|---|---|
| هدف | سنجش defense-in-depth برای cache key/value tenant-aware |
| فرضیه | mismatch tenant metadata باعث cache purge/deny می‌شود، نه response tenant دیگر |
| injection مجاز | فقط cache test namespace با marker synthetic؛ direct production cache mutation ممنوع |
| observation | cache hit/miss، tenant marker assertion، purge event، API response shape |
| pass | Beta هرگز Alpha marker ندارد؛ mismatch observable و cache invalidated است |
| abort | response/metadata cross-tenant یا shared namespace خارج experiment |
| recovery | purge namespace fixture و verify DB-source result |

### CE-07 — membership revoke در session فعال

| مورد | طراحی |
|---|---|
| هدف | جلوگیری از stale authorization در API/WebSocket |
| فرضیه | suspend/revoke membership، actions و reconnectهای بعدی را طبق policy رد می‌کند |
| injection مجاز | revoke test membership در fixture staging |
| observation | session expiry, WS close/revalidation, read/write denial, audit |
| pass | no post-revoke action/event; explicit policy-consistent close/deny |
| abort | retained write/admin/realtime access بدون approval |
| recovery | re-provision fixture membership، run regression matrix |

### CE-08 — metrics/exporter blindness

| مورد | طراحی |
|---|---|
| هدف | اثبات این‌که observability failure اجازه cutover نمی‌دهد |
| فرضیه | scrape/alert outage، SLO scorecard را red و campaign را freeze می‌کند |
| injection مجاز | test exporter/alert route isolate در staging؛ synthetic alert only |
| observation | `up`, alert delivery, decision log, cutover flag |
| pass | freeze decision، communication و restore of monitoring قبل از resume |
| abort | team continues backfill/enforcement blind |
| recovery | monitor restore + synthetic test + re-approval |

### CE-09 — bounded noisy-neighbor workload

| مورد | طراحی |
|---|---|
| هدف | بررسی fairness/rate-limit/backpressure بدون حمله DoS |
| فرضیه | یک tenant fixture با workload در سقف مصوب باعث cross-tenant latency/error budget breach نمی‌شود؛ در غیر این صورت quota/throttle عمل می‌کند |
| injection مجاز | k6 rate مصوب و timeboxed بر internal fixture؛ no flood، no production shared endpoint |
| observation | per-flow latency/errors، queue/connection/CPU، throttling behavior، Alpha/Beta workflows |
| pass | total system داخل budget یا controlled throttle؛ no tenant data isolation breach |
| abort | availability/customer simulation budget breach، cascading retries، monitoring loss |
| recovery | workload stop، metrics stabilize، capacity result recorded |

### CE-10 — migration verification service unavailable

| مورد | طراحی |
|---|---|
| هدف | اطمینان از اینکه missing verification به enforce/cutover عبور نمی‌کند |
| فرضیه | verify artifact unavailable/failed، `verification_ready` را false نگه می‌دارد و policy stage بعدی را block می‌کند |
| injection مجاز | fail verification job in staging by controlled dependency stub/error response |
| observation | gate status، alert، change decision، any enforcement attempt |
| pass | no contract migration/enforcement، owner notified، state remains recoverable |
| abort | cutover با artifact missing یا stale انجام شود |
| recovery | dependency restore، fresh verify run، approval جدید |

## ۵. اجرای مرحله‌ای

| مرحله | محیط | آزمایش مجاز | گیت خروج |
|---|---|---|---|
| C0 | local/CI | CE-01, CE-06, CE-07, CE-10 با fixture | deterministic pass و automation |
| C1 | staging isolated | CE-01 تا CE-08 با یک fault در هر run | SLIها green، alert/recovery evidence |
| C2 | staging production-like | CE-03, CE-04, CE-09، load coexistence | capacity/DB/WS budgets approved |
| C3 | internal canary فقط در صورت نیاز | کم‌خطرترین experiments، غیرمخرب، timeboxed | explicit Product/Security/DBA approval |
| C4 | Production customer path | خارج از scope پیش‌فرض v1.1.4 | نیازمند risk review و policy مستقل |

## ۶. Experiment Card Template

```markdown
# Chaos Experiment: [CE-ID]

- Date / environment:
- Change ID / deploy version:
- Hypothesis:
- Steady-state SLI baseline links:
- Blast radius:
- Owner / approver / stop authority:
- Injection (reversible, bounded):
- Start / stop condition:
- Observation windows:
- Expected behavior:
- Actual behavior:
- Data/security evidence (redacted):
- Recovery evidence:
- Pass / Fail / Inconclusive:
- Finding and action item owner/date:
```

## ۷. گیت‌های پذیرش تاب‌آوری

| حوزه | معیار پذیرش |
|---|---|
| Isolation | هیچ experiment نباید record, metadata, cache marker یا realtime event cross-tenant آشکار کند |
| Integrity | no silent partial state؛ verify/audit/checkpoint وضعیت را قابل توضیح می‌کند |
| Recoverability | هر fault runbook، stop condition، recovery evidence و repeatable reset دارد |
| Availability | SLIهای journey حیاتی در budget مصوب می‌مانند یا platform به‌شکل controlled degrade/hold می‌شود |
| Observability | alert/scrape/log/audit کافی و redacted؛ monitoring blind change را block می‌کند |
| Governance | owner، approval، blast radius و AAR برای هر experiment ثبت می‌شوند |
| Automation | findingهای تکرارشونده به CI regression/chaos suite و required gate منتقل می‌شوند |

## ۸. ریسک‌های باقیمانده و عدم‌قطعیت

1. Chaos pass اثبات امنیت کامل یا نبود vulnerability نیست؛ فقط confidence نسبت به failure modeهای مدل‌شده را افزایش می‌دهد.
2. Production behavior ممکن است با staging متفاوت باشد؛ به همین دلیل blast radius و approval برای هر مرحله ضروری است.
3. هیچ experiment نباید data customer، cross-tenant mutation یا restore Production را به‌عنوان injection استفاده کند.
4. customer-impact SLO و RTO/RPO قبل از C3 باید توسط ownerهای business/technical مصوب شوند.
5. اگر آستانه، ownership یا alert route نامشخص است، experiment باید **Inconclusive/No-Go** ثبت شود، نه Pass.

## منابع

[1] [Principles of Chaos Engineering](https://principlesofchaos.org/)

[2] [OWASP Multi-Tenant Application Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)

[3] [OWASP Authorization Regression Testing Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Regression_Testing_Cheat_Sheet.html)
