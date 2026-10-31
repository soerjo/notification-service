# Repository Guidelines

## Project Overview
Notification Service is a high-throughput, multi-channel dispatch microservice built with NestJS 11, Prisma ORM, and BullMQ on Redis. It provides resilient notification ingestion with base-key idempotency deduplication, sensitive payload masking, dynamic multi-channel template rendering, and retry-driven delivery across WebSocket (Socket.IO), Telegram (Telegraf), Email (Nodemailer), and WhatsApp (Twilio).

All service interactions are secured using service-to-service API key and HMAC-SHA256 signature verification (`ApiKeyGuard` validating `X-Api-Key`, `X-Signature`, and `X-Timestamp` against `API_KEY`).

---

## Architecture & Data Flow

```
                      POST /api/v1/notifications/send
                                   │
                   [ApiKeyGuard (X-Api-Key + HMAC X-Signature)]
                                   │
                     NotificationsController
                                   │
                       NotificationsService
                   ┌───────────────┴───────────────┐
      [Check Idempotency]                   [Sanitize Payload]
    (Base-key / text_pattern_ops)         (Mask token/password/otp)
                   │                               │
        ┌──────────┴──────────┐                    │
   [Cache Hit]           [Cache Miss]              │
   Return 200            Fan-out & Persist PENDING │
   (Existing IDs)                  │               │
                                   ▼               │
                         BullMQ Queue ('notifications')
                                   │
                       NotificationsQueueService
                          (Worker Consumer)
                                   │
                        NotificationsDispatcher
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   TemplateService        ChannelRegistry             PrismaService
(DB / Handlebars render)  (Socket.IO/TG/Email/WA) (Update status + log attempt)
         │                         │                         │
         └─────────► Adapter.send ◄┘                         │
                           │                                 ▼
                     Provider Result                   Delivery Logs
               (SUCCESS / RETRY / FAILED)       (Latency, Provider Response)
```

### Key Modules & Flow
1. **Ingestion**: `POST /api/v1/notifications/send` is protected by global `ApiKeyGuard` validating `X-Api-Key` and `X-Signature` HMAC-SHA256 with timestamp freshness (≤ 5 min).
2. **Idempotency**: `NotificationsService` queries `NotificationsRepository.findByBaseIdempotencyKey`. If found, it returns `200 OK` with existing notification IDs and original `trace_id`. If new, it persists records as `PENDING` and returns `202 Accepted`.
3. **Queue & Backoff**: Notifications are dispatched as BullMQ jobs to the `'notifications'` queue with a 3-attempt backoff strategy (`[2000, 8000, 30000]` ms).
4. **Dispatcher**: `NotificationsDispatcher` transitions state `PENDING` → `PROCESSING` → `SENT` (or `RETRY`/`FAILED`), renders channel-specific content via `TemplateService`, resolves credentials via `PlatformConfigService`, invokes `ChannelRegistry`, records `NotificationDeliveryLog` entries, and increments Prometheus delivery metrics.
5. **Channel Adapters**:
   - `SocketIoChannel`: Broadcasts real-time events to recipient rooms via `NotificationsGateway`.
   - `TelegramChannel`: Sends HTML messages using `telegraf` (configured via `notification_platforms` table or fallback `TELEGRAM_BOT_TOKEN`).
   - `EmailChannel`: Sends HTML/text emails using `nodemailer` (configured via `notification_platforms` or fallback `SMTP_*` variables).
   - `WhatsappChannel`: Dispatches messages via Twilio Messages API (configured via `notification_platforms` or fallback `TWILIO_*` variables).

---

## Key Directories

```
src/
├── common/                  # Cross-cutting middleware, filters, guards, and utilities
│   ├── filters/             # AllExceptionsFilter (uniform error envelope)
│   ├── guards/              # ApiKeyGuard (X-Api-Key + X-Signature HMAC-SHA256)
│   ├── middleware/          # RequestLoggingMiddleware (Winston + metrics timing)
│   └── utils/               # Backoff, sanitizer, token-expiry, redis-url, cors-origins
├── config/                  # Environment variable schema and validation (env.validation.ts)
├── modules/
│   ├── health/              # Terminus health checks (Prisma and Redis indicators)
│   ├── metrics/             # Prometheus registry, custom counters, and histograms
│   ├── notifications/       # Core notification domain
│   │   ├── channels/        # Channel adapters (Socket.IO, Telegram, Email, WhatsApp) + PlatformConfigService
│   │   ├── dto/             # SendNotificationDto, destination DTOs
│   │   ├── gateway/         # NotificationsGateway (@WebSocketGateway)
│   │   ├── repositories/    # NotificationsRepository (Prisma access & index queries)
│   │   └── templates/       # TemplateService (Database + in-memory cached Handlebars compiler)
│   └── signatures/          # SignaturesModule (generate HMAC-SHA256 signatures for service calls)
│   └── redis/               # Redis client connection and lifecycle
├── prisma/                  # Prisma schema, migrations, and PrismaService lifecycle
└── templates/               # Static fallback template definitions (src/templates/index.ts)
```

---

## Development Commands

All package operations and tasks use **Bun**.

### Build & Run
```bash
bun install                              # Install dependencies from bun.lock
bun run build                            # Compile NestJS to dist/
bun run start:dev                        # Run dev server with hot reload (port 3400)
bun run start:prod                       # Run compiled production build (dist/main.js)
```

### Code Quality & Validation
```bash
bunx tsc --noEmit                        # Typecheck codebase (strict TS verification)
bun run lint                             # ESLint check (check-only; no auto-formatting)
bun run format                           # Format codebase with Prettier
bun audit                                # Security audit of dependencies
```

### Testing
```bash
bun run test                             # Run all unit tests via Jest (jest.config.js)
bunx jest src/modules/notifications      # Run specific test suite
bun run test:cov                         # Generate unit test coverage report
bun run test:e2e                         # Run e2e tests (requires RUN_NOTIFICATIONS_E2E=true)
```

### Database & Migrations
```bash
bunx prisma generate                     # Generate Prisma Client after schema changes
bunx prisma migrate dev --name <name>    # Create and apply migration (dev)
bunx prisma migrate deploy               # Apply migrations in CI / production
```

---

## Code Conventions & Common Patterns

### Module & Import Standards
- **ESM Relative Imports**: TypeScript runs under `nodenext` module resolution. **All relative imports MUST include the `.js` extension**:
  ```typescript
  import { Sanitizer } from '../../common/utils/sanitizer.util.js';
  import { NotificationChannel } from '@prisma/client';
  ```

### Naming Conventions
- Files: kebab-case with descriptive type suffix (e.g., `notifications.service.ts`, `sanitizer.util.ts`, `internal-auth.guard.ts`).
- Classes: PascalCase matching file role (e.g., `NotificationsService`, `InternalAuthGuard`).
- Interfaces: PascalCase, avoiding `I` prefixes (e.g., `NotificationChannel`, `SendNotificationOptions`).
- Unit Specs: `*.spec.ts` co-located next to the implementation file in `src/`.

### Sensitive Data Masking
- Always pass request bodies, delivery responses, and payloads through `Sanitizer.mask(obj)` before logging or writing to `Notification.payload` or `NotificationDeliveryLog.providerResponse`. Keys containing `password`, `token`, `otp`, `rekening`, `secret`, or `authorization` are masked with `***`.

### Async & Dependency Injection
- Constructor injection using TypeScript private/readonly parameters.
- No fire-and-forget promises in main request paths; all async calls must be awaited or piped through BullMQ workers.

---

## Important Files

| File | Purpose |
|---|---|
| `src/main.ts` | Bootstrap entrypoint; registers Helmet, Winston, global prefix (`/api`), metrics endpoint (`/metrics`), and WebSockets. |
| `src/app.module.ts` | Root NestJS module importing core and feature modules, binding global filters and Throttler. |
| `src/config/env.validation.ts` | Startup validation schema for environment variables via `class-validator`. |
| `src/modules/notifications/notifications.service.ts` | Ingestion, base-key deduplication, fan-out, and queue scheduling. |
| `src/modules/notifications/notifications.dispatcher.ts` | Job execution worker, adapter delegation, delivery logging, and metrics. |
| `src/modules/notifications/notifications.queue.ts` | BullMQ producer and worker lifecycle manager (`'notifications'` queue). |
| `src/modules/notifications/channels/channel-registry.ts` | Lookup registry resolving `NotificationChannel` enums to concrete channel adapters. |
| `src/modules/notifications/channels/platform-config.service.ts` | Resolves active channel credentials from `notification_platforms` with env fallbacks. |
| `src/modules/notifications/templates/template.service.ts` | Dynamic template compiler from DB with channel awareness & Handlebars cache. |
| `prisma/schema.prisma` | PostgreSQL schema defining `Notification`, `NotificationDeliveryLog`, `Template`, and `NotificationPlatform`. |

---

## Runtime/Tooling Preferences

- **Runtime**: **Bun** (v1.x strictly). Node is not used (neither in development nor production containers).
- **Package Manager**: **Bun** strictly (`bun install`).
  - Lockfile is `bun.lock` (text format).
  - **NEVER** generate or commit `package-lock.json` or `yarn.lock`.
- **TypeScript & Build**:
  - `module` and `moduleResolution`: `"nodenext"` targeting `ES2023`.
  - Typecheck must be executed via `bunx tsc --noEmit`.
- **Linting & Formatting**:
  - ESLint 9 flat configuration with type-aware linting (`projectService: true`).
  - `bun run lint` is check-only (no auto-fix). Always run `bun run format` for formatting.

---

## Testing & QA

### Test Framework & Configuration
- **Framework**: Jest 30 via `ts-jest` (compatible with `bun run test` and `bun test`).
- **Config**: `jest.config.js` maps nodenext imports (`moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }`).

### Unit Testing Practices
- **Co-location**: Unit tests reside next to source files in `src/**/*.spec.ts`.
- **Fast Constructor Mocks**: Avoid initializing full NestJS testing modules for unit tests. Prefer direct constructor instantiation with typed `jest.fn()` mocks.
- **Determinism**: Reset mocks in `afterEach(() => jest.restoreAllMocks())`.

### Verification Gate
Before committing or creating pull requests, all gate steps must exit 0:
```bash
bunx tsc --noEmit
bun run lint
bun run test
bun run build
```
