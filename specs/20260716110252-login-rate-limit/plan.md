# Plan: Login attempt rate limiting
Spec: specs/20260716110252-login-rate-limit/spec.md

## 1. Approach

Reuse the rate-limit machinery the `api-rate-limit` spec put in place — no new
dependency, no new error, no new middleware file. Extend the existing factory
`src/middleware/rateLimit/createRateLimitMiddleware.ts` with one optional
option, `skipSuccessfulRequests` (default `false`, so the existing global
call site in `src/app.ts` is untouched), which passes straight through to
`express-rate-limit`'s option of the same name: the library increments the
client's counter on every request and decrements it again when the response
status is < 400 — so only *failed* attempts (401 invalid credentials, and any
other ≥ 400 outcome) stay counted (spec decision #1/#5: successes don't count
and don't reset). Mount a second, stricter limiter built from new
`config.loginRateLimit` values (5 attempts / 15 min defaults) as the **first
middleware of `POST /authenticate`** in `src/routes/auth.routes.ts` —
route-scoped, so no other endpoint is affected (AC6). Client identity, the
fixed window, per-client buckets, the in-memory store, and the E1 envelope
(`ApiError` → `429 TOO_MANY_REQUESTS` via `src/middleware/errorMiddleware.ts`)
all come from the existing factory unchanged (decisions #2, #3, #4). The
global limiter keeps running in front of it (both stack; global allows 100,
login allows 5).

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| App config | existing | `src/config/config.ts` | Add `loginRateLimit: { windowMs, max }` from `LOGIN_RATE_LIMIT_WINDOW_MS` ?? 900000 and `LOGIN_RATE_LIMIT_MAX` ?? 5, following the file's `Number(process.env.X ?? default)` style |
| Env template | existing | `.env.example` | Add `LOGIN_RATE_LIMIT_WINDOW_MS=900000`, `LOGIN_RATE_LIMIT_MAX=5`; mirror into the local `.env` (precedent: api-rate-limit plan R1) |
| Limiter factory | existing | `src/middleware/rateLimit/createRateLimitMiddleware.ts` | Add optional `skipSuccessfulRequests?: boolean` to the options object, forwarded to `rateLimit({ ..., skipSuccessfulRequests: skipSuccessfulRequests ?? false })`; existing behavior unchanged when omitted |
| Route wiring | existing | `src/routes/auth.routes.ts` | Mount `createRateLimitMiddleware({ ...config.loginRateLimit, skipSuccessfulRequests: true })` as the first handler of `POST /authenticate`, before `validateRequestMiddleware` |
| Login rate-limit tests | new | `tests/integration/loginRateLimitMiddleware.test.ts` | Dedicated integration file (fresh app instance per file under Vitest isolation) covering AC1–AC6; each test keys its own client via a unique `X-Forwarded-For` (test env runs `TRUST_PROXY_HOPS=1`), mirroring `tests/integration/rateLimitMiddleware.test.ts`; known-password user via `createUserFixture` + `passwordHasher.hash`, mirroring `tests/integration/handlers/auth/authenticateHandler.test.ts` |

## 3. Interfaces & contracts

- `config` addition (camelCase, snake-cased env vars per convention):

  ```ts
  loginRateLimit: {
      windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 900000),
      max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 5),
  },
  ```

- Factory signature becomes:

  ```ts
  createRateLimitMiddleware({ windowMs, max, skipSuccessfulRequests }: {
      windowMs: number;
      max: number;
      skipSuccessfulRequests?: boolean;
  }): RateLimitRequestHandler
  ```

  The existing `handler` already raises
  `new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many requests, please try again later.')`,
  which `errorMiddleware` formats into the uniform envelope — E1 reuses it
  verbatim (decision #3).

- Route contract (`POST /authenticate`):
  - Under the login allowance: unchanged — `200 { token }` on correct
    credentials, `401 INVALID_CREDENTIALS` envelope on wrong ones.
  - Allowance exhausted: `429 { status: 429, code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later.' }` + `Retry-After`
    header, regardless of credentials.

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `ApiError(429, 'TOO_MANY_REQUESTS', …)` raised by the shared factory's `handler` (via `errorMiddleware`) | `429 { status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' }` with `Retry-After` |

## 4. Data & persistence

None — counters live in the library's default in-memory store (spec §1), one
store instance per limiter; no tables, no migrations.

## 5. Validation

None — spec §3 defines no client-supplied fields; the two config values fall
back to defaults via `??` (existing `config.ts` style).

## 6. Dependency changes

None — `express-rate-limit` ^8.5.2 is already installed and supports
`skipSuccessfulRequests`.

## 7. Assumptions & risks

Assumptions:

1. "Failed attempt" is implemented as "response status ≥ 400" (the library's
   `skipSuccessfulRequests` definition). A request rejected by body validation
   (400) therefore also counts as a failed attempt, not only a 401 —
   consequence if wrong: malformed probes would need to be exempted; arguably
   desirable as-is since malformed floods are also brute-force noise.
2. Window-reset behavior (allowance restored after `windowMs`) stays untested,
   like the global limiter (api-rate-limit plan assumption 2) — consequence if
   wrong: a library regression would go unnoticed; low risk on a pinned major.
3. The login limiter is mounted **before** `validateRequestMiddleware` so a
   locked client is rejected without doing validation or credential work —
   consequence if wrong (mounted after): lock still works but locked requests
   would still exercise validation; trivial reorder.
4. ACs 1, 4, 5 and 6 pin behavior the library provides once T2/T3's changes
   land (allowance boundary, accumulation, per-client keying, route scoping) —
   their tests are expected to pass on arrival and exist to guard against
   misconfiguration/regression; only AC2 and AC3 drive production changes —
   consequence if wrong (one of them fails red): a real config/wiring gap was
   caught, fix inside the corresponding task.
5. The global limiter also counts every login request (both limiters stack).
   The dedicated test file issues far fewer than 100 requests per forwarded
   identity, so the global limiter never interferes — consequence if wrong:
   flaky 429s in the file; mitigated by unique per-test identities.

Risks:

| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | Two draft-8 limiters both write `RateLimit`/`RateLimit-Policy` headers on login responses; the login route's header values may reflect only one policy | med | cosmetic — clients see one of the two policies in headers | Tests assert the E1 envelope and `Retry-After`, never login-route header contents; if operators need both policies exposed, a follow-up spec can set distinct policy identifiers |
| R2 | Shared in-memory buckets make tests order-sensitive within the file | med | flaky suite | Each test keys its own client with a unique `X-Forwarded-For` (precedent: rateLimitMiddleware.test.ts / api-rate-limit R2) |
| R3 | Horizontal scaling multiplies the effective allowance (per-process counters) | low | brute-force budget N× looser | Same accepted trade-off as the global limiter; store is swappable via factory options later |
| R4 | bcrypt work makes the AC3 test (6+ successful logins) comparatively slow | low | a few hundred ms extra suite time | Accepted; one test, single-digit logins |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Correct credentials while locked | allowance exhausted, then valid email+password | E1 — lock wins over credentials | AC2 |
| Success interleaved with failures | 4 failures, 1 success, 1 more failure, then any attempt | E1 — success neither counted nor resetting | AC4 |
| Malformed body while counting | request failing body validation (400) | counts as a failed attempt (assumption 1) | none |
| Attempts while locked | further attempts during the lock | rejected with E1; fixed window means they do not extend the lock | AC2 (rejection); window non-extension untested (assumption 2) |
| Boundary attempt | exactly the `max`-th failed attempt in a window | still answered normally (401); the next attempt is rejected | AC1 / AC2 |
| Other endpoints while locked | locked client calls `GET /health` | served normally (subject only to the global limit) | AC6 |
| Service restart while locked | process restarts during a lock | allowance cleared (in-memory store; spec §1) | none — accepted trade-off |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| field: failed-attempt allowance | §2 App config / Env template (`LOGIN_RATE_LIMIT_MAX` → `config.loginRateLimit.max`) |
| field: lock window duration | §2 App config / Env template (`LOGIN_RATE_LIMIT_WINDOW_MS` → `config.loginRateLimit.windowMs`) |
| E1 | §3 E1 row — existing factory `handler` + `errorMiddleware`, reused unchanged (decision #3) |
| AC1 | §2 Route wiring (limiter mounted with `max` from config); §8 boundary attempt |
| AC2 | §2 Route wiring; §3 exhausted-route contract |
| AC3 | §2 Limiter factory (`skipSuccessfulRequests` pass-through) + Route wiring (`skipSuccessfulRequests: true`) |
| AC4 | §2 Limiter factory (library decrement-on-success semantics, no reset); §8 interleaved success |
| AC5 | §1 Approach (per-client buckets from the existing factory; identity via existing `trust proxy` setup) |
| AC6 | §2 Route wiring (route-scoped mount in `auth.routes.ts`, not `app.ts`) |
