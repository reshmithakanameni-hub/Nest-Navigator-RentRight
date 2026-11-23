# Deployment and HTTPS

The app is one Node.js 22 process plus one SQLite file, so it deploys as a single container with one persistent volume.

## 1. Docker (local or any server)

```bash
docker compose up --build        # http://localhost:3000
```

`Dockerfile`: `node:22-alpine`, runs as the non-root `node` user, copies only application code (no tests, data or secrets), has a `/api/health` health check and two volumes: `/app/data` (SQLite database) and `/app/backups` (verified snapshots). `docker-compose.yml` wires the volumes, health check and restart policy.

Chrome and Firefox accept `Secure` cookies on `http://localhost`, so sign-in works locally even with `NODE_ENV=production`. Use a different browser profile or set `NODE_ENV=development` in the compose file if your browser rejects them.

## 2. Docker with automatic HTTPS (own server + domain)

Point a DNS A record for your domain at the server, open ports 80 and 443, then:

```bash
DOMAIN=rent.example.com docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Caddy (`deploy/Caddyfile`) obtains and renews a Let's Encrypt certificate and proxies to the app. The overlay sets `TRUST_PROXY=true` and `FORCE_HTTPS=true`.

## 3. Managed hosting (Render)

`render.yaml` is a Render blueprint (Docker runtime, `/api/health` check, 1 GB disk mounted at `/app/data`, HTTPS provided by the platform). A persistent disk requires a paid plan; on a free plan the SQLite file is lost on restart.

## 4. HTTPS settings reference

| Variable | Effect |
|---|---|
| `TLS_KEY_FILE` + `TLS_CERT_FILE` | The Node server terminates TLS itself (TLS 1.2+). Both are required. |
| `TRUST_PROXY=true` | Believe `X-Forwarded-Proto` from a reverse proxy. Enable only when a proxy you control sets it. |
| `FORCE_HTTPS=true` | Redirect plain HTTP with `308`, send `Strict-Transport-Security`, mark session cookies `Secure`. `/api/health` stays reachable over HTTP for platform probes. |
| `NODE_ENV=production` | `Secure` cookies and HSTS as well. |

Quick self-signed test certificate (development only):

```bash
mkdir certs && openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=localhost" -keyout certs/key.pem -out certs/cert.pem
TLS_KEY_FILE=certs/key.pem TLS_CERT_FILE=certs/cert.pem npm start      # https://localhost:3000
```

## 5. Password reset email

Reset links go through `lib/mailer.js`. Set `SMTP_HOST` (plus `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) and messages are delivered over SMTP by the built-in client in `lib/smtp.js` (implicit TLS on 465 or STARTTLS on 587, AUTH PLAIN, header-injection checks, dot-stuffing). Without `SMTP_HOST` the message is printed to the server console, and outside production the API response also contains `devResetLink` so the flow can be demonstrated without a mail server. Delivery failures are logged and never change the API response (no account enumeration through errors or timing). Example with a Gmail app password: `SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true SMTP_USER=you@gmail.com SMTP_PASS=<app password>`.

The SMTP client is tested against in-process fake servers (plain, STARTTLS, implicit TLS); it has not been exercised against a real provider in the environment where this revision was prepared.

## 6. Operations

Back up with `npm run db:backup` (also automatic every 24 h, 7 kept). Restore with `npm run db:restore -- <backup>` after stopping the app. Persist `/app/data` and `/app/backups` on volumes; the database is a single-host store.

## 7. Observability and CI

Every response has an `X-Request-Id`, and the server prints one JSON access-log line per request (method, path without query string, status, duration; no bodies or tokens). Set `LOG_REQUESTS=false` to silence it. `.github/workflows/ci.yml` runs `npm run check` on Node 22 and 24, the Playwright journey, and a Docker build plus health-check smoke test. `openapi.yaml` documents the API and `tests/openapi.test.js` fails if a documented operation is not routed.
