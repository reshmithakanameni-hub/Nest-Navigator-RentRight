# Attempt 3 improvement checklist

Attempt 2 rubric: Requirements 18/25, Code Quality 15/20, Functionality 16/20, System Design 8/20, Security 5/10, Innovation 2/5; total 64/100.

| Rubric category | Attempt 2 finding | Attempt 3 evidence and remaining gap |
|---|---|---|
| Requirements Fulfilment (25) | Visit scheduling was one-way; limited tests | Owner claim and visit management; server-side filters, comparison, affordability, commute, neighbourhood scorecard, price insight; per-user shortlist with no localStorage fallback; 34 automated tests (route-by-route integration tests with a Supertest-style helper) plus a Playwright journey. Commute, scorecard and panorama are illustrative samples. |
| Code Quality & Best Practices (20) | Monolithic frontend and backend | `app.js` is a short wiring file; `public/js/` has single-purpose modules with pure, unit-tested helpers; the API follows route -> controller -> service -> repository. |
| Functionality & Reliability (20) | Basic errors; weak recovery | SQLite constraints and transactions, validated tool inputs, backup verification/rotation/restore, stale-response protection on filters. No multi-host failover. |
| System Design & Architecture (20) | Two-tier design, flat JSON | Relational SQLite with versioned schema (v3), persistent hashed sessions and rate limits, audit log, business rules on the server only. Concurrent writers are proven safe across six processes (atomic claim, unique visit-slot index, WAL and busy timeout); SQLite is still a single-file, single-host database. |
| Security & Robustness (10) | No auth, privacy leak | scrypt, role/ownership checks, origin checks, headers, body cap, rate limits, session expiry, masked visitor email, audit log, static-file allow-list test. No MFA, email verification or formal audit. |
| Innovation & Technical Complexity (5) | Mostly standard CRUD | Explainable weighted matching, price-per-sq.ft. market insight, 360 tour, persistent rate limiting and backup/restore. Rule-based, not ML. |

No score is guaranteed. The evaluator's score depends on inspection and demonstration. The rubric is additive, so demonstrations of working features, tests, architectural rationale and honest limitations may help assessors award available points; this table is evidence mapping, not a predicted grade.

## Verification record

Verified in this revision (including a six-process write-contention test and double-booking prevention): `npm run check` passes (17 browser modules syntax-checked, 59 tests). Coverage includes listing filters and sorting, recommendations, tools validation, comparison, price insight, auth and roles, owner-only visit updates, shortlists, logout, origin rejection, security headers, body limits, brute-force throttling, audit-log contents, blocked static paths, backup integrity and a fake-DOM run of `app.js` against the real server. The Playwright spec was updated for the shortlist step but was not executed here; run `npx playwright install chromium` then `npm run test:e2e` before submitting. This revision also adds password reset, HTTPS support, map-based nearby search, Docker/Render deployment files and an architecture diagram (see README.md and DEPLOYMENT.md). Also added: built-in SMTP client for real reset emails, OpenAPI spec with a route-coverage test, request IDs with JSON access logs, a GitHub Actions workflow (not executed here).
