# API reference

Requests and responses use JSON. Errors use `{ "error": "..." }`. Bodies are limited to 12,000 bytes. Cookies are HttpOnly, SameSite=Strict and expire after eight hours. Browser mutations must be same-origin; mismatched `Origin` is rejected.

| Method | Path | Access and input/output |
|---|---|---|
| GET | `/api/health` | Public SQLite status and property count |
| GET | `/api/properties?maxRent=30000&bhk=2&furnishing=Furnished&area=Hyderabad&pets=true&parking=true&sort=low` | Public filtered listings; `sort` is `featured`, `low` or `high`; unknown `furnishing` values are ignored |
| GET | `/api/properties/compare?ids=1,4,10` | Public: 2-3 listings side by side plus `lowestMonthlyCostId` |
| GET | `/api/properties/:id/insight` | Public: rent per sq.ft. versus the city median (`ABOVE_MARKET`, `FAIR`, `BELOW_MARKET`) |
| GET | `/api/tools/affordability?rent=&deposit=&maintenance=&income=` | Public: move-in cost and rent-to-income ratio; values 0-100,000,000 |
| GET | `/api/tools/commute?propertyId=1&mode=car&destination=HITEC City` | Public illustrative estimate; mode is `car`, `transit` or `walk` |
| GET | `/api/neighborhoods` , `/api/neighborhoods/:area` | Public list and illustrative scorecard |
| GET | `/api/recommendations?budget=30000&bhk=2&area=Gachibowli&pets=true&parking=true` | Public top-five scored matches; budget 1-1,000,000, BHK 1-3 |
| POST | `/api/auth/register` | `{name,email,password,role}`; tenant/owner; password 10+ characters with letters and digits |
| POST | `/api/auth/login` | `{email,password}`; returns safe user and sets session cookie |
| GET | `/api/auth/me` | Session: current safe user |
| POST | `/api/auth/logout` | Invalidates session and clears cookie |
| POST | `/api/visits` | `{propertyId,name,email,date,time}`; date today/future and allowed slot; 409 if that property/date/time already has a REQUESTED or CONFIRMED visit (DECLINED/COMPLETED free the slot) |
| POST | `/api/owner/properties/claim` | Owner: `{propertyId}` unclaimed demo listing |
| GET | `/api/owner/visits` | Owner's visit requests; visitor email masked |
| PATCH | `/api/owner/visits/:id` | Owner: `{status}` (`CONFIRMED`, `DECLINED`, `COMPLETED`) |
| GET/POST | `/api/shortlist` | Session: read ids / `{propertyId}` add |
| DELETE | `/api/shortlist/:propertyId` | Session: remove id |

Common status codes: 400 invalid input, 401 missing session, 403 role/origin rejected, 404 missing resource, 409 duplicate, double-booked or unavailable, 413 oversized body, 429 rate limited and 500 unexpected error. Internal error detail is logged server-side and not returned to clients.

Default throttles are 120 API requests/minute per remote address and 12 login attempts/minute. Set `RATE_LIMIT_PER_MINUTE` and `LOGIN_RATE_LIMIT_PER_MINUTE` to adjust. Hashed buckets persist in SQLite and are shared among processes using that database.


## Added: password recovery, map search

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/forgot-password` | Body `{email}`. Always `200` with the same message. Outside production the body also has `devResetLink`. Strict per-minute rate limit. |
| POST | `/api/auth/reset-password` | Body `{token, newPassword}`. `200` on success; `400` for invalid, used or expired token or weak password. Revokes all sessions of the account. |
| GET | `/api/landmarks` | `{landmarks:[{id,name,city,lat,lng}]}` |
| GET | `/api/properties/nearby?lat&lng&radiusKm=5&maxRent&bhk` | `{center,radiusKm,total,properties:[{...,distanceKm}]}` sorted by distance. Radius 0.5-50 km; `400` for invalid input. |

A machine-readable description is in `openapi.yaml`; `tests/openapi.test.js` verifies that each documented operation is routed. Every response includes an `X-Request-Id` header.
