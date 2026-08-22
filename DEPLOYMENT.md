# Production Deployment Guide

## Prerequisites
- Docker 24+ and Docker Compose v2+
- Domain name with DNS configured
- SSL certificates (Let's Encrypt via certbot or your own)

## Quick Start

### 1. Clone and Configure
```bash
git clone <repo>
cd marinasan-purchase-system
cp .env.production .env
# Edit .env with your secure values
```

### 2. Generate Secrets
```bash
# Generate JWT secret (run once)
openssl rand -hex 32

# Generate database password
openssl rand -base64 32
```

### 3. Deploy
```bash
# Build and start all services
docker compose -f docker-compose.yml up -d --build

# Run database migrations
docker compose exec backend alembic upgrade head

# Check logs
docker compose logs -f
```

### 4. SSL Certificates (Let's Encrypt)
```bash
# First run (after DNS is configured)
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d yourdomain.com -d api.yourdomain.com \
  --email admin@yourdomain.com --agree-tos --no-eff-email

# Auto-renewal runs in certbot container
```

## Architecture

```
                    ┌─────────────────┐
                    │    Internet     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Nginx       │  (SSL termination, rate limiting)
                    │   Port 80/443   │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼─────┐ ┌──────▼──────┐ ┌─────▼─────┐
     │   Frontend   │ │   Backend   │ │  Certbot  │
     │  (Nginx)     │ │  (Gunicorn) │ │           │
     │  Port 80     │ │  Port 5002  │ │  (renewal)│
     └──────────────┘ └──────┬──────┘ └───────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐ ┌──────▼──────┐ ┌─────▼─────┐
        │ PostgreSQL│ │    Redis    │ │ Prometheus│
        │  Port 5432│ │  Port 6379  │ │  Port 9090│
        └───────────┘ └─────────────┘ └───────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80, 443 | Reverse proxy, SSL termination, static files |
| backend | 5002 | Flask API (Gunicorn) |
| frontend | 80 | React build served by Nginx |
| postgres | 5432 | Primary database |
| redis | 6379 | Cache & sessions |
| certbot | - | SSL certificate renewal |
| prometheus | 9090 | Metrics (optional) |

## Environment Variables

Key variables (see `.env.production` for full list):

| Variable | Required | Description |
|----------|----------|-------------|
| `MARINASAN_JWT_SECRET` | Yes | 32+ byte hex string |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `FLASK_ENV` | Yes | `production` |
| `SENTRY_DSN` | No | Error tracking |

## Database Migrations

```bash
# Create new migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# Rollback
docker compose exec backend alembic downgrade -1

# Current version
docker compose exec backend alembic current
```

## Backup & Restore

```bash
# Manual backup
docker compose exec postgres pg_dump -U marinasan marinasan > backup_$(date +%F).sql

# Restore
cat backup.sql | docker compose exec -T postgres psql -U marinasan marinasan

# Automated backups run daily at 2 AM (configured in BACKUP_SCHEDULE)
```

## Monitoring

### Health Checks
```bash
# API health
curl https://api.yourdomain.com/api/health

# Detailed checks
curl https://api.yourdomain.com/api/health | jq .
```

### Prometheus Metrics (optional)
Enable with `--profile monitoring`:
```bash
docker compose --profile monitoring up -d
```

Access Grafana at `http://yourdomain.com:3000` (admin/admin - change on first login)

### Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

## Scaling

For 200+ users, consider:

```yaml
# docker-compose.override.yml
services:
  backend:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

Use an external load balancer or Kubernetes for production scaling.

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT secrets
- [ ] Enable HTTPS only
- [ ] Configure firewall (only 80/443 inbound)
- [ ] Set up fail2ban for SSH
- [ ] Enable PostgreSQL SSL
- [ ] Configure Redis AUTH
- [ ] Set up log monitoring/alerting
- [ ] Regular security updates
- [ ] Backup encryption

## Troubleshooting

### Backend won't start
```bash
docker compose logs backend
# Check DATABASE_URL format
# Verify PostgreSQL is healthy
```

### Database connection issues
```bash
docker compose exec postgres pg_isready -U marinasan
docker compose exec backend python -c "from database import get_connection; print(get_connection().execute('SELECT 1').fetchone())"
```

### SSL certificate issues
```bash
docker compose logs certbot
# Check domain DNS points to server
# Verify port 80 accessible for ACME challenge
```

### Permission errors
```bash
docker compose exec backend chown -R appuser:appgroup /app/uploads
```

## Updates

```bash
# Pull latest images
docker compose pull

# Rebuild and restart
docker compose up -d --build

# Run migrations
docker compose exec backend alembic upgrade head
```

## Support

For issues, check:
1. `docker compose logs -f <service>`
2. Health endpoint: `/api/health`
3. Application logs in JSON format