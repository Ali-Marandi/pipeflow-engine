# نقشه راه جهانی‌سازی و توسعه تجاری PipeFlow Pro

**وضعیت:** برنامه محصول پس از نسخه‌ی 1.1.1  
**اصل راهبردی:** اعتبار محاسبات مهندسی، قابلیت اطمینان داده‌ی بلادرنگ و حاکمیت سازمانی باید پیش از توسعه‌ی صرفاً ظاهری رشد کنند.

## قابلیت‌های تحویل‌شده در پایه محصول

| حوزه | قابلیت تحویل‌شده | ارزش تجاری |
|---|---|---|
| قابلیت اطمینان | Windows Installer، Portable executable، smoke test و benchmark خودکار | کاهش ریسک نصب در محیط مشتری و امکان سنجش launch time در هر Release |
| بلادرنگ | WebSocket با subscription، Redis Streams، `XACK` و بازیابی `XAUTOCLAIM` | جداسازی producer از dashboard و افزایش تحمل خطا در دریافت sensor telemetry |
| مقیاس‌پذیری | consumer group مجزا برای هر gateway replica | جلوگیری از گم‌شدن event در dashboardهای متصل به Podهای مختلف |
| Cloud | Docker Compose، Kubernetes Deployment، HPA، health/readiness و GHCR workflow | مسیر قابل‌تکرار از پایلوت تک‌سرور تا محیط چند replica |
| Enterprise | network versioning، hydraulic jobs، alert rule، incident acknowledgement و audit event | نخستین لایه‌ی governance و عملیات مهندسی |
| جهانی‌سازی | انتخاب locale، پشتیبانی RTL و حفظ ترجیح SI/Imperial در dashboard | پایه‌ی تجربه کاربری چندبازاری |

## اولویت‌های محصول جهانی

| اولویت | قابلیت | خروجی قابل فروش | وابستگی اصلی |
|---|---|---|---|
| P0 | Tenant persistence و SSO/OIDC | فضای کاری سازمانی با RBAC، MFA و audit غیرقابل‌تغییر | MySQL schema و identity provider |
| P0 | WebSocket ticket کوتاه‌عمر | جایگزینی shared token و جلوگیری از جعل tenant | OIDC/session و signing key |
| P0 | worker جداگانه و DLQ | حل hydraulic job و telemetry replay بدون از دست دادن پیام | Redis Streams و persistence job |
| P0 | OpenTelemetry/Prometheus | SLA dashboard، trace API، lag Redis و error budget | collector و backend observability |
| P1 | Digital Twin calibration | همسان‌سازی مدل هیدرولیکی با sensorهای واقعی و تشخیص انحراف | تاریخچه telemetry، solver شبکه‌ای و data quality |
| P1 | Pump curve، NPSH و cavitation | انتخاب تجهیز و ارزیابی ریسک عملیاتی برای بازار صنعتی | منحنی سازنده و داده سیال |
| P1 | Report engine و approval workflow | گزارش PDF/Excel امضاشده با snapshot ورودی، خروجی و approval | immutable run record و storage |
| P1 | اتصال OPC UA/MQTT | ورود ایمن داده از SCADA، PLC و gatewayهای صنعتی | adapter service و certificate lifecycle |
| P2 | GIS/BIM و import/export استاندارد | همکاری با تیم طراحی و کاهش ورود دستی مدل شبکه | فرمت‌های صنعتی و validation جغرافیایی |
| P2 | anomaly detection و predictive maintenance | تشخیص نشتی، drift و مصرف غیرعادی | داده برچسب‌خورده و pipeline ML |
| P2 | marketplace تجهیز و plugin SDK | اتصال catalog سازندگان و توسعه اکوسیستم | API versioning، sandbox و partner program |

OPC UA برای interoperability صنعتی میان سطح ماشین و enterprise طراحی شده و انتخاب مناسبی برای adapterهای SCADA است. [1] OpenTelemetry نیز چارچوب vendor-neutral برای تولید و export سیگنال‌های observability است؛ این امر vendor lock-in عملیات را کاهش می‌دهد. [2]

## برنامه پیاده‌سازی پیشنهادی

نسخه‌ی بعدی باید ابتدا schema پایدار برای `organizations`، `memberships`، `networks`، `network_versions`، `jobs`، `telemetry_points`، `alert_rules` و `audit_events` اضافه کند. هر model run باید `runId`، `networkVersionId`، نسخه solver، input checksum، اجراکننده و timestamp داشته باشد. این اطلاعات پایه‌ی گزارش ممیزی‌پذیر، approval و تحلیل تکرارپذیر است.

بعد از persistence، WebSocket authorization باید به ticket کوتاه‌عمر تبدیل شود. frontend ابتدا از API احراز‌شده ticket دریافت می‌کند؛ ticket فقط tenant، scope metric و expiry کوتاه را دارد؛ gateway قبل از upgrade signature و claimها را بررسی می‌کند. `tenantId` از query string هرگز نباید به‌تنهایی مرز دسترسی باشد.

در مرحله‌ی بعد، workerهای محاسباتی از gateway جدا می‌شوند. gateway groupها فقط برای fanout dashboard هستند؛ compute group مشترک یک queue واقعی برای hydraulic jobs است. پیام ناموفق پس از تعداد retry محدود به DLQ منتقل می‌شود و ابزار replay فقط برای role operator/admin در دسترس خواهد بود.

## معیارهای آمادگی جهانی

| حوزه | معیار پذیرش |
|---|---|
| زبان و منطقه | تمام textهای UI از catalog ترجمه شوند؛ locale و RTL در E2E تست شوند؛ format عدد/تاریخ مطابق locale باشد |
| واحدها | تبدیل و نمایش SI/Imperial برای همه input/outputها با test tolerance مشخص انجام شود |
| امنیت | OIDC، RBAC، audit، secret rotation، TLS، dependency scan و code signing فعال باشند |
| availability | readiness دقیق، graceful shutdown، replay از Redis، backup/restore DB و incident drill مستند باشند |
| performance | API p95، latency telemetry end-to-end، lag Stream و زمان launch Windows در هر release ثبت شوند |
| اعتبار مهندسی | solver با benchmarkهای مرجع و سناریوهای شبکه حلقوی/پمپ/شیر اعتبارسنجی شود |

## منابع

[1] [OPC Foundation, OPC Unified Architecture](https://opcfoundation.org/about/opc-technologies/opc-ua/)

[2] [OpenTelemetry, Documentation](https://opentelemetry.io/docs/)
