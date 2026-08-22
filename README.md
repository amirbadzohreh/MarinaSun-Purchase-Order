# MarinaSun Purchase Order System

Enterprise-grade Purchase Request & Approval Platform — dynamic multi-level workflow, immutable digital signatures, and automated PDF issuance. Production-ready with Docker Compose, PostgreSQL, Redis, Nginx, and Prometheus monitoring.

## Highlights

- **Dynamic Approval Workflow** — amount-based routing via `approval_rules`, sequential sign-off, and auto-escalation
- **Immutable Digital Signatures** — Base64 PNG + IP / User-Agent / timestamp audit trail
- **Return for Documents** — `returned_for_documents` flow with resubmission and notifications
- **Document Engine** — unique `PR-xxxx` numbering, HTML/PDF with SHA256 verification
- **Notifications** — SMTP & Microsoft Exchange (EWS) with fallback
- **Security** — JWT auth, Redis-backed login rate limit (5/5min), CORS, JSON structured logs
- **Observability** — `/api/health`, `/metrics`, Prometheus + Grafana

## Architecture

```
Internet → Nginx (80/443) → Frontend (React) → Backend (Flask/Gunicorn :5002) → PostgreSQL + Redis
```

## Project Structure

```
├── docker-compose.yml          # dev/internal (HTTP)
├── docker-compose.prod.yml     # production + SSL + monitoring
├── .env.example                # copy to .env
├── nginx/                      # Nginx configs
├── app/                        # Flask backend
│   ├── app.py
│   ├── database.py             # PostgreSQL pooling + Redis
│   ├── workflow.py
│   ├── email_service.py
│   ├── schema_postgres.sql
│   └── alembic/
├── frontend/                   # React + Vite
└── monitoring/                 # Prometheus + Grafana
```

## Prerequisites

- Docker 24+ and Docker Compose v2
- For local dev without Docker: Python 3.12+, Node 20+, PostgreSQL 16

## Quick Start (Docker)

```bash
cp .env.example .env
# edit .env — at minimum:
# MARINASAN_JWT_SECRET  (openssl rand -hex 32)
# POSTGRES_PASSWORD     (openssl rand -base64 32)

docker compose up -d --build
docker compose exec backend alembic upgrade head
# or fresh seed:
docker compose exec backend python seed.py

docker compose logs -f
# Frontend: http://localhost
# API health: http://localhost/api/health
```

### Production (with SSL)

```bash
cp .env.production .env
# fill real values + domain
docker compose -f docker-compose.prod.yml up -d --build
```

## Local Development without Docker

```bash
# Backend
cd app
pip install -r requirements.txt
export DATABASE_URL=postgresql://marinasun:pass@localhost:5432/marinasun
export MARINASUN_JWT_SECRET=dev-secret
alembic upgrade head
python seed.py
python app.py  # or: gunicorn -c gunicorn_config.py 'app:create_app()'

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MARINASUN_JWT_SECRET` | Yes | >=32 byte hex (`openssl rand -hex 32`) |
| `POSTGRES_PASSWORD` | Yes | DB password |
| `POSTGRES_USER` / `POSTGRES_DB` | No | default `marinasun` |
| `SMTP_*` / `EWS_*` | No | email notifications |
| `CORS_ORIGINS` | No | allowed origins |

> Never hardcode secrets in `docker-compose.yml` — use `.env` only.

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | login with `personnel_number` + `password` |
| POST | `/api/purchase-requests` | create request |
| GET | `/api/purchase-requests` | list my requests |
| GET | `/api/purchase-requests/:id` | detail + steps + signatures |
| POST | `/api/purchase-requests/:id/decision` | approve / reject |
| GET | `/api/purchase-requests/pending-for-me` | approval inbox |
| GET | `/api/health` | health check |
| GET | `/metrics` | Prometheus metrics |

## Demo Users (seed.py)

| Name | Role | Personnel | Password |
|---|---|---|---|
| Reza Ahmadi | IT Specialist | 1204 | pass1204 |
| Sara Karimi | IT Manager | 0817 | pass0817 |
| Mohsen Hosseini | Finance Manager | 0345 | pass0345 |
| Alireza Rostami | CEO | 0129 | pass0129 |

## Security Notes

- `employee_id` is taken from JWT, not request body
- Only the current step approver can decide
- Signatures store a copy of name/personnel + IP + timestamp (immutable)
- Login rate limit: 5 attempts / 5 min (Redis or in-memory fallback)

## Monitoring

```bash
docker compose --profile monitoring up -d
# Prometheus: http://localhost:9090  Grafana: http://localhost:3001 (admin/admin)
curl http://localhost/api/health
curl http://localhost/metrics
```

## License

MIT — see `LICENSE`.
