# ماریناسان — سیستم درخواست خرید (Marinasan Purchase System)

سیستم مدیریت درخواست خرید با گردش تایید چندسطحی، امضای دیجیتال و تولید سند چاپی. بک‌اند Flask + PostgreSQL + Redis، فرانت‌اند React + Vite، استقرار با Docker Compose + Nginx.

---

## ویژگی‌ها

- ثبت درخواست خرید با اقلام، مبلغ کل خودکار و شماره درخواست یکتا (`PR-xxxx`)
- گردش تایید پویا بر اساس مبلغ (قابل تنظیم در `approval_rules`)
- امضای دیجیتال (Base64 PNG)، ثبت IP و User-Agent
- بازگشت برای تکمیل مدارک و ارسال مجدد
- تولید سند چاپی HTML/PDF با امضاها
- اعلان ایمیل (SMTP / Exchange EWS)
- احراز هویت JWT، Rate Limit ورود، لاگ ساختاریافته JSON، متریک Prometheus

## معماری

```
Internet → Nginx (80/443) → Frontend (React) → Backend (Flask/Gunicorn :5002) → PostgreSQL + Redis
```

## ساختار پروژه

```
├── docker-compose.yml          # dev/internal (HTTP, بدون SSL)
├── docker-compose.prod.yml     # production + SSL + monitoring
├── .env.example                # نمونه متغیرها (کپی به .env)
├── nginx/                      # کانفیگ Nginx
├── app/                        # بک‌اند Flask
│   ├── app.py
│   ├── database.py             # pooling PostgreSQL + Redis
│   ├── workflow.py
│   ├── email_service.py
│   ├── schema_postgres.sql
│   └── alembic/
├── frontend/                   # فرانت‌اند React
└── monitoring/                 # Prometheus + Grafana
```

## پیش‌نیازها

- Docker 24+ و Docker Compose v2
- برای توسعه بدون Docker: Python 3.12+, Node 20+, PostgreSQL 16

## شروع سریع (Docker)

```bash
cp .env.example .env
# .env را باز کن و حداقل این‌ها را پر کن:
# MARINASAN_JWT_SECRET  (openssl rand -hex 32)
# POSTGRES_PASSWORD     (openssl rand -base64 32)

docker compose up -d --build
docker compose exec backend python -m alembic upgrade head
# یا برای شروع تمیز:
docker compose exec backend python seed.py

# لاگ‌ها
docker compose logs -f

# فرانت‌اند روی http://localhost
# API روی http://localhost/api/health
```

### Production (با SSL)

```bash
cp .env.production .env
# مقادیر واقعی + دامنه را پر کن
docker compose -f docker-compose.prod.yml up -d --build
```

## اجرای محلی بدون Docker

```bash
# Backend
cd app
pip install -r requirements.txt
export DATABASE_URL=postgresql://marinasan:pass@localhost:5432/marinasan
export MARINASAN_JWT_SECRET=dev-secret
python -m alembic upgrade head
python seed.py
python app.py  # یا gunicorn -c gunicorn_config.py 'app:create_app()'

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173
```

## متغیرهای محیطی مهم

| متغیر | الزامی | توضیح |
|---|---|---|
| `MARINASAN_JWT_SECRET` | بله | حداقل ۳۲ بایت hex |
| `POSTGRES_PASSWORD` | بله | پسورد دیتابیس |
| `POSTGRES_USER/DB` | خیر | پیش‌فرض `marinasan` |
| `SMTP_*` / `EWS_*` | خیر | برای اعلان ایمیل |
| `CORS_ORIGINS` | خیر | لیست origins مجاز |

همه پسوردها را فقط در `.env` نگه دار — هرگز در `docker-compose.yml` هاردکد نکن.

## API

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/api/auth/login` | ورود با `personnel_number` + `password` |
| POST | `/api/purchase-requests` | ایجاد درخواست |
| GET | `/api/purchase-requests` | لیست درخواست‌های خودم |
| GET | `/api/purchase-requests/:id` | جزئیات + مراحل + امضاها |
| POST | `/api/purchase-requests/:id/decision` | تایید/رد |
| GET | `/api/purchase-requests/pending-for-me` | کارتابل تایید |
| GET | `/api/health` | سلامت سرویس |

## کاربران نمونه (seed.py)

| نام | سمت | پرسنلی | رمز |
|---|---|---|---|
| رضا احمدی | کارشناس IT | 1204 | pass1204 |
| سارا کریمی | مدیر IT | 0817 | pass0817 |
| محسن حسینی | مدیر مالی | 0345 | pass0345 |
| علیرضا رستمی | مدیرعامل | 0129 | pass0129 |

## نکات امنیتی

- `employee_id` از JWT خوانده می‌شود، نه از body
- فقط approver مرحله جاری می‌تواند تصمیم بگیرد
- امضاها با کپی نام/پرسنلی + IP + زمان ذخیره می‌شوند (تغییرناپذیر)
- Rate limit ورود: ۵ تلاش در ۵ دقیقه (Redis یا in-memory)

## مانیتورینگ

```bash
docker compose --profile monitoring up -d
# Prometheus: http://localhost:9090  Grafana: http://localhost:3001 (admin/admin)
curl http://localhost/api/health
curl http://localhost/metrics
```

## لایسنس

MIT — فایل `LICENSE` را ببین.
