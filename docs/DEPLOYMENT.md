# Deployment Runbook — notification-service

> Terakhir diverifikasi: 2026-10-17 (live smoke test lokal, main `35e9ca1`).
> Deploy dijadwalkan lain waktu — dokumen ini supaya eksekusi nanti tinggal jalan.

## 1. Target

- **Portainer stack** (endpoint 3, house rule: semua container = Portainer stack) di host `soerjo-sever`
- Port host: **3400** (bebas — sudah diverifikasi tidak bentrok saat dev)
- Network: `internal_net` (external, static IP disarankan tinggi, mis. `172.19.0.240`)
- DB: `postgres_db.internal_net:5432/notification_db` (sudah ada + migrated)
- Redis: `redis_cache.internal_net:6379` (queue BullMQ — pakai DNS container, bukan IP)

## 2. Env stack (Portainer)

```
NODE_ENV=production
PORT=3400
DATABASE_URL=postgresql://<PGU>:<PGP>@postgres_db.internal_net:5432/notification_db?schema=public
REDIS_URL=redis://redis_cache.internal_net:6379/1
API_KEY=<32B secret untuk x-api-key dan x-signature service-to-service>
INTERNAL_API_TOKEN=<optional backward-compat fallback untuk API_KEY>
TELEGRAM_BOT_TOKEN=<KOSONG dulu — isi saat channel Telegram mau live>
SMTP_HOST= / SMTP_PORT=587 / SMTP_USER= / SMTP_PASS= / SMTP_FROM=noreply@soerjoprod.com
CORS_ORIGINS=http://localhost:3301,http://100.92.245.124:3301
```

Catatan:
- SMTP kosong = channel EMAIL otomatis disable (terverifikasi graceful di smoke test)
- Auth service-to-service menggunakan X-Api-Key dan X-Signature HMAC-SHA256 (kompatibel dengan billing-service).

## 3. Langkah deploy (urut)

1. `docker build --network=host -t notification-service:prod .` di host dari repo clone
2. Compose stack (single service, image hasil build, network internal_net + static IP)
3. Create stack via `POST /api/stacks/create/standalone/string?endpointId=3` (Portainer 2.39+, bukan POST lama)
4. Env via stack Env array ( plaintext di Portainer DB) — sesuai pola skill portainer-control
5. Verify: `docker ps` (RunningFor baru), health `http://<ip>:3400/api/health` (database+redis up), `docker logs` tanpa error
6. Smoke test di stack: POST /api/v1/notifications/send dengan key baru (202) + duplikat (200 existing) — pola sama dengan smoke lokal
7. **STANDING RULE**: backup env+compose ke `soerjo/container-envs` (clone `/home/soerjo-sever/container-envs`, `./sync.sh`, commit + push dengan hash sebagai bukti)

## 4. Yang sudah diverifikasi sebelumnya (bukan perlu diulang)

- Migrasi DB: ✓ applied (`notification_db`, tabel + unique index idempotency_key + pattern idx)
- Smoke lokal: ✓ health DB+Redis up, send 202 + trace_id, SOCKET_IO SENT, EMAIL graceful-fail 3 attempt dengan audit log per-attempt, idempotency dedupe (dup → 200 return existing, tanpa row baru), ingestion 42ms (≤150ms NFR)
- CI: PR #1 & #2 lulus build/quality/test
- Gates: tsc 0, eslint 0, jest 83/83, nest build 0

## 5. Known limitations v1

- Channel FCM/WHATSAPP: stub (schema-ready, adapter NOT_IMPLEMENTED)
- Templates: code-based map (src/templates/), bukan tabel DB
- Internal auth: static Bearer token (bukan mTLS per PRD full version)
- Socket.IO gateway handshake pakai INTERNAL_API_TOKEN via query param
- env validation legacy var (lihat catatan di atas)