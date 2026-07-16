# Plan: API rate limiting
Spec: specs/20260716084012-api-rate-limit/spec.md

## 1. Approach

Add `express-rate-limit` (v8) as an app-level middleware. A factory function in
`src/middleware/rateLimit/` builds the limiter from passed-in options (decision
#11); `src/app.ts` calls it with values from `config` and mounts the result
right after `express.json()`, **before every route including `/health`**, so
all traffic — the health check (AC3, decision #12) and unknown paths included —
is limited. On rejection the limiter's `handler` calls
`next(new RateLimitExceededError())`, so the existing
`src/middleware/errorMiddleware.ts` formats the uniform
`{ status, code, message }` envelope through the existing
`DomainError → category → CATEGORY_STATUS` pipeline — extended with one new
category, `TooManyRequests → 429`. Client identity behind proxies is handled by
`app.set('trust proxy', config.trustProxyHops)` (AC4). Counters use the
library's default in-memory store (decision #1) — no new infrastructure.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| App config | existing | `src/config/config.ts` | Add `rateLimit: { windowMs, max }` (from `RATE_LIMIT_WINDOW_MS` ?? 900000, `RATE_LIMIT_MAX` ?? 100) and `trustProxyHops` (from `TRUST_PROXY_HOPS` ?? 0), following the file's existing `Number(process.env.X ?? default)` style |
| Env template | existing | `.env.example` | Add `RATE_LIMIT_WINDOW_MS=900000`, `RATE_LIMIT_MAX=100`, `TRUST_PROXY_HOPS=1` (comment: keep ≥1 behind a proxy and for the integration suite; set 0 when directly exposed) |
| Error category | existing | `src/modules/shared/domain/DomainError.ts` | Add `'TooManyRequests'` to the `ErrorCategory` union |
| Category → status map | existing | `src/middleware/domainErrorStatus.ts` | Add `TooManyRequests: 429` to `CATEGORY_STATUS` |
| Rate-limit error | new | `src/middleware/rateLimit/RateLimitExceededError.ts` | `RateLimitExceededError extends DomainError` — code `TOO_MANY_REQUESTS`, category `TooManyRequests`, fixed message. Middleware-owned, mirroring `src/middleware/validateRequest/RequestValidationError.ts` (decision #9) |
| Limiter factory | new | `src/middleware/rateLimit/createRateLimitMiddleware.ts` | Default-exported `createRateLimitMiddleware({ windowMs, max })` returning the configured `express-rate-limit` middleware (decision #11) |
| App wiring | existing | `src/app.ts` | `app.set('trust proxy', config.trustProxyHops)`; mount `createRateLimitMiddleware(config.rateLimit)` right after `express.json()`, before every route (`/health` included, decision #12) |
| Rate-limit route tests | new | `tests/integration/rateLimitMiddleware.test.ts` | Dedicated integration file (fresh app instance per file under Vitest isolation) covering AC1–AC4 |
| Error/status unit tests | existing/new | `tests/unit/middleware/domainErrorStatus.test.ts`, `tests/unit/middleware/rateLimit/RateLimitExceededError.test.ts` | Extend the `CATEGORY_STATUS` map assertion; new unit test for the error class |

## 3. Interfaces & contracts

- `config` additions (camelCase, wire env vars snake-cased per convention):

  ```ts
  rateLimit: {
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
      max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  },
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  ```

- `type ErrorCategory = ... | 'TooManyRequests'`; `CATEGORY_STATUS.TooManyRequests = 429`.
- `RateLimitExceededError` — no-arg constructor; `code = 'TOO_MANY_REQUESTS'`,
  `category = 'TooManyRequests'`, message
  `'Too many requests, please try again later.'`.
- `createRateLimitMiddleware({ windowMs, max }: { windowMs: number; max: number })`
  → returns `rateLimit({ windowMs, limit: max, standardHeaders: 'draft-8',
  legacyHeaders: false, handler: (_req, _res, next) => next(new RateLimitExceededError()) })`.
  Default export (single-export middleware-layer file convention).
- Response contracts:
  - Under limit: normal response + draft-8 headers `RateLimit-Policy` and
    `RateLimit` (assert presence, not exact format — format is the library's).
  - Over limit: `429` + `{ "status": 429, "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests, please try again later." }` + `Retry-After`
    header (set by the library before the handler runs, so it survives the
    error-middleware path).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `RateLimitExceededError` (via `errorMiddleware` + `CATEGORY_STATUS`) | `429 { status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' }` with `Retry-After` and `RateLimit-*` headers |

## 4. Data & persistence

None — counters live in the library's default in-memory store; no tables, no
migrations.

## 5. Validation

None — spec §3 defines no client-supplied fields; config values fall back to
defaults via `??` (existing `config.ts` style).

## 6. Dependency changes

| Dependency | Version | Action | Reason |
|--|--|--|--|
| express-rate-limit | ^8.5.2 | install | The rate-limiting middleware (counting, windows, draft-8 headers, custom handler) |

## 7. Assumptions & risks

Assumptions:

1. Unknown paths are limited too (limiter mounted before `notFoundMiddleware`) —
   consequence if wrong: none harmful; scanners hitting random paths get
   throttled, which is desirable.
2. Window-reset behavior (allowance restored after `windowMs`) is the library's
   responsibility and gets no direct test, keeping the suite fast and
   deterministic — consequence if wrong: a library regression would go unnoticed;
   low risk on a pinned major.
3. Config parsing follows the existing no-schema style (`Number(env ?? default)`)
   — consequence if wrong: an invalid env value yields `NaN`, which
   `express-rate-limit`'s option validation rejects at boot (fail-fast).
4. The integration tests run in one dedicated file and are order-aware: AC2's
   test asserts only on the **final** request of its `max + 1` loop, so earlier
   in-file consumption cannot break it; AC4 uses fresh `X-Forwarded-For`
   identities — consequence if wrong: flaky tests; mitigated by R2.
5. The factory takes `{ windowMs, max }` as parameters instead of importing
   `config` itself, keeping wiring in `app.ts` (composition) and the factory
   pure. The user intends `src/middleware/rateLimit/` to grow **multiple
   rate-limit settings** in the future (e.g. stricter per-route limits); the
   parameterized factory supports that as-is (one call per limit), and
   `RateLimitExceededError` lives in the same folder so every future limiter
   shares it — consequence if wrong: trivial refactor.

Risks:

| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Dev machines with a stale `.env` (no `TRUST_PROXY_HOPS=1`) fail the AC4 test | med | one failing test locally | T2 updates the local `.env` alongside `.env.example`; the `.env.example` comment documents the requirement |
| R2 | Shared in-memory buckets make tests order-sensitive within the file | med | flaky suite | Dedicated test file (fresh app per file), AC2 asserts the final request only, AC4 keys by unique forwarded IPs |
| R3 | Horizontal scaling multiplies the effective limit (per-process counters) | low | limit N× looser than configured | Documented in spec §1; trigger to swap in a shared store (e.g. `rate-limit-redis`) — the store is a factory option, nothing else changes |
| R4 | Health probes now consume allowance (decision #12): an aggressive uptime monitor sharing a client identity could see `429` on `/health` and report false downtime | low | false downtime alerts | Accepted by decision #12; probes from a distinct source IP hold their own allowance (100/15 min ≫ typical probe rates), and limits are env-tunable |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Unknown path | request to a non-existent route | counted against the allowance; 404 contract while allowance remains, E1 once exhausted | AC1 (used as the limited probe endpoint) |
| Spoofed forwarded identity, hops = 0 | `X-Forwarded-For` sent while `trust proxy` is 0 (production default) | header ignored; direct connection identifies the client | none (test env runs hops = 1; inverse of AC4) |
| Window elapses | client exhausted, `windowMs` passes | allowance restored | none (assumption 2 — library behavior) |
| Health after limit tripped | client exhausted, then `GET /health` | `429` E1 envelope, like any other endpoint (decision #12) | AC3 |
| Boundary request | exactly the `max`-th request in a window | served (allowance inclusive); the `max + 1`-th is rejected | AC1 / AC2 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| field: window duration | §2 App config / Env template (`RATE_LIMIT_WINDOW_MS` → `config.rateLimit.windowMs`) |
| field: request allowance | §2 App config / Env template (`RATE_LIMIT_MAX` → `config.rateLimit.max`) |
| field: trusted intermediary hops | §2 App config / Env template (`TRUST_PROXY_HOPS` → `config.trustProxyHops`); §2 App wiring (`trust proxy`) |
| E1 | §2 Error category + Category → status map + Rate-limit error; §3 E1 row |
| AC1 | §2 Limiter factory + App wiring; §3 under-limit contract |
| AC2 | §2 Limiter factory (`handler`) + Error category + Rate-limit error; §3 over-limit contract |
| AC3 | §2 App wiring (mount before every route, `/health` included) |
| AC4 | §2 App wiring (`trust proxy` from config); §2 Env template (hops = 1 in dev/test) |
