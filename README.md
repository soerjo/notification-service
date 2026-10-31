# Notification Service

High-throughput, multi-channel dispatch microservice built with NestJS 11, Prisma ORM, BullMQ on Redis, and running natively on **Bun** runtime.

## Features

- **Multi-Channel Dispatch**: WebSocket (Socket.IO), Telegram (Telegraf), Email (Nodemailer), WhatsApp (Twilio).
- **Idempotency Deduplication**: Base-key deduplication (`findByBaseIdempotencyKey`) preventing duplicate dispatch.
- **Queue & Worker Delivery**: Resilient BullMQ queue processing on Redis with exponential retry backoff.
- **Sensitive Payload Masking**: Automatic token/password/secret masking via Sanitizer.
- **Service-to-Service Security**: `X-Api-Key` and `X-Signature` HMAC-SHA256 request verification with freshness checks.
- **Dynamic Template Engine**: Database-backed and Handlebars cached template rendering.
- **Observability**: Prometheus metrics endpoint (`/metrics`) and Terminus health indicators (`/api/health`).

## Prerequisites

- [Bun](https://bun.sh) (v1.x strictly)
- PostgreSQL
- Redis

## Setup

```bash
# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Run migrations (development)
bunx prisma migrate dev
```

## Running the Application

```bash
# Development with hot reload
bun run start:dev

# Build for production
bun run build

# Run production build
bun run start:prod
```

## Testing & Quality Assurance

```bash
# Run unit tests via Jest
bun run test

# Run tests with Bun native runner
bun test

# Run specific suite
bunx jest src/modules/notifications

# Test coverage
bun run test:cov

# E2E tests (requires RUN_NOTIFICATIONS_E2E=true)
bun run test:e2e

# Strict TypeScript typecheck
bunx tsc --noEmit

# ESLint (flat config)
bun run lint

# Prettier format
bun run format
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `PORT` | No | `3400` | Application HTTP port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string (e.g. `redis://localhost:6379/1`) |
| `API_KEY` | In Prod | — | Secret key for `X-Api-Key` and `X-Signature` HMAC validation |
| `INTERNAL_API_TOKEN` | No | — | Backward-compatible fallback for `API_KEY` |
| `TELEGRAM_BOT_TOKEN` | No | — | Fallback Telegram bot token |
| `SMTP_HOST` | No | — | SMTP host for email channel |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP user |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | SMTP default sender address |
| `TWILIO_ACCOUNT_SID` | No | — | Twilio Account SID for WhatsApp |
| `TWILIO_AUTH_TOKEN` | No | — | Twilio Auth Token for WhatsApp |
| `TWILIO_WHATSAPP_FROM` | No | — | Twilio WhatsApp sender number |
| `CORS_ORIGINS` | No | — | Comma-separated allowed origins |

## Docker

```bash
# Run stack via Docker Compose
docker compose up -d

# Build production image with Bun
docker build -t notification-service:prod .
```
