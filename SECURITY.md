# Security notes

## Implemented

- Passwords use Node scrypt with a random per-user salt. Passwords/hashes are not returned by account APIs.
- Sessions use a 256-bit random token; SQLite stores only its SHA-256 digest. Cookies are HttpOnly, SameSite=Strict and Secure in production. Sessions expire after eight hours and are invalidated at logout.
- Owner access checks role and property ownership. Shortlists are user-scoped. Owner visit responses mask visitor email.
- Server-side validation, parameterized SQL, 12 KB request limit, origin checks for browser mutations, persistent hashed SQLite rate limits (12 login attempts/minute and 120 general API requests/minute by default) and generic unexpected errors.
- An append-only audit log records registrations, logins (successful and failed), property claims and visit status changes.
- CSP, frame denial, `nosniff`, referrer and permissions policies. HSTS is enabled in production.

## Deployment responsibilities and gaps

Set `NODE_ENV=production` behind correctly configured HTTPS. `.env` is ignored; `.env.example` has only non-secret settings. Restrict database/backup file access and encrypt or replicate backups as appropriate. Rate-limit buckets are persisted and shared by processes using the same SQLite file. Multi-host deployments with separate databases need a dedicated shared limiter. There is no MFA, email verification, real email delivery (reset links go to the console transport), owner verification or formal threat model. Complete a security review before handling real tenant/property data.


## HTTPS and password recovery

- TLS: the server can terminate TLS (`TLS_KEY_FILE`, `TLS_CERT_FILE`, TLS 1.2+) or run behind a proxy (`TRUST_PROXY`). `FORCE_HTTPS=true` redirects HTTP (308), sends HSTS and marks session cookies `Secure`. Forwarded headers are ignored unless `TRUST_PROXY=true`.
- Reset tokens: 256-bit random, stored as SHA-256 digests, 30-minute expiry, single use (atomic `UPDATE ... RETURNING`), older links replaced by a new request, all sessions revoked after reset, events audited without tokens. Forgot-password answers identically for unknown emails (no account enumeration) and shares the strict rate limit with login.
- Email: with `SMTP_HOST` set, reset mail is sent through the built-in SMTP client (TLS/STARTTLS, header-injection checks); delivery errors never reach the caller. Without it the message goes to the console. There is no multi-factor authentication.
- Traceability: every response has `X-Request-Id`; the access log records method, path (no query string), status and duration only.
