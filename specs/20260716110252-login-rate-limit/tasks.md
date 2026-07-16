# Tasks: Login attempt rate limiting
Plan: specs/20260716110252-login-rate-limit/plan.md

- [ ] T1. Login rate-limit config values
  - Type: config
  - Depends on: none
  - Red: none — `src/config/config.ts` is pure env mapping (composition; matching the existing file); values are proven behaviorally by T2–T7
  - Green: add `loginRateLimit.windowMs` (`LOGIN_RATE_LIMIT_WINDOW_MS` ?? 900000) and `loginRateLimit.max` (`LOGIN_RATE_LIMIT_MAX` ?? 5) to `src/config/config.ts`; add both vars to `.env.example` and the local `.env` (plan §2)
  - Covers: spec §2 fields "failed-attempt allowance", "lock window duration"

- [ ] T2. Lock after the full allowance of failed attempts
  - Type: route wiring
  - Depends on: T1
  - Red: new `tests/integration/loginRateLimitMiddleware.test.ts` (known-password user via `createUserFixture` + `passwordHasher.hash` in `beforeAll`, per `authenticateHandler.test.ts`): client `X-Forwarded-For: 10.10.0.1` sends `config.loginRateLimit.max` wrong-password attempts, then one attempt with **correct** credentials — assert the final response is `429` with body exactly `{ status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' }` and a `retry-after` header — fails: no login limiter mounted, correct credentials return `200 { token }`
  - Green: in `src/routes/auth.routes.ts`, mount `createRateLimitMiddleware(config.loginRateLimit)` as the first handler of `POST /authenticate`, before `validateRequestMiddleware` (no `skipSuccessfulRequests` yet — T3 adds it)
  - Covers: AC2 "Given a client that has used its full failed-attempt allowance within the current window, when it makes a further login attempt with correct credentials, then the attempt is rejected with E1 in the standard error shape, including an indication of when to retry."; E1

- [ ] T3. Successful logins never consume the allowance
  - Type: middleware + route wiring
  - Depends on: T2
  - Red: in `loginRateLimitMiddleware.test.ts`, client `X-Forwarded-For: 10.10.0.2` logs in successfully `config.loginRateLimit.max + 1` times — assert the final response is `200` with `{ token: expect.any(String) }` — fails: T2's plain limiter counts every request, so the `max + 1`-th is `429`
  - Green: add optional `skipSuccessfulRequests?: boolean` to `createRateLimitMiddleware`'s options, forwarded as `skipSuccessfulRequests: skipSuccessfulRequests ?? false` (plan §3; existing `app.ts` call site untouched); pass `{ ...config.loginRateLimit, skipSuccessfulRequests: true }` at the route
  - Covers: AC3 "Given a client that logs in successfully more times than its failed-attempt allowance within one window, when it logs in again with correct credentials, then it is authenticated — successes never consume the allowance."

- [ ] T4. Under-limit failures don't block a valid login (pinning)
  - Type: integration test (pinning)
  - Depends on: T3
  - Red: in `loginRateLimitMiddleware.test.ts`, client `X-Forwarded-For: 10.10.0.3` sends `max - 1` wrong-password attempts, then correct credentials — assert `200` with `{ token: expect.any(String) }` — expected to pass on arrival (plan §7.4): the allowance boundary is library-provided once T2/T3 are green; a failure reveals a misconfigured `max`
  - Green: none — test-only pinning task; production code unchanged
  - Covers: AC1 "Given a client with fewer failed login attempts than its allowance in the current window, when it submits correct credentials, then it is authenticated normally."

- [ ] T5. A success does not clear counted failures (pinning)
  - Type: integration test (pinning)
  - Depends on: T3
  - Red: in `loginRateLimitMiddleware.test.ts`, client `X-Forwarded-For: 10.10.0.4` sends `max - 1` wrong-password attempts, one successful login (assert `200`), one more wrong-password attempt (reaching the full allowance), then an attempt with correct credentials — assert the final response is `429` with the E1 envelope — expected to pass on arrival (plan §7.4): the library decrements only the successful request, never resetting the bucket; a failure reveals wrong lock semantics
  - Green: none — test-only pinning task; production code unchanged
  - Covers: AC4 "Given a client one failure short of its allowance that then logs in successfully, when it fails once more and afterwards attempts to log in, then the attempt is rejected with E1 — the success did not clear the counted failures."

- [ ] T6. Lock is independent per client (pinning)
  - Type: integration test (pinning)
  - Depends on: T3
  - Red: in `loginRateLimitMiddleware.test.ts`, lock client `X-Forwarded-For: 10.10.0.5` (`max` wrong-password attempts, then assert its next attempt is `429`), then client `X-Forwarded-For: 10.10.0.6` submits correct credentials — assert `200` with `{ token: expect.any(String) }` — expected to pass on arrival (plan §7.4): per-client buckets come from the existing factory + `trust proxy` setup; a failure reveals broken client keying
  - Green: none — test-only pinning task; production code unchanged
  - Covers: AC5 "Given one client locked out of login, when a different client submits correct credentials, then that client is authenticated — allowances are independent per client."

- [ ] T7. Lock is scoped to the login route (pinning)
  - Type: integration test (pinning)
  - Depends on: T3
  - Red: in `loginRateLimitMiddleware.test.ts`, lock client `X-Forwarded-For: 10.10.0.7` (`max` wrong-password attempts, then assert its next attempt is `429`), then the same client calls `GET /health` — assert `200 { status: 'ok' }` — expected to pass on arrival (plan §7.4): the limiter is mounted on the route, not the app; a failure reveals an app-level mount leaking the lock
  - Green: none — test-only pinning task; production code unchanged
  - Covers: AC6 "Given a client locked out of login, when it makes a request to another part of the service, then the request is served normally — the lock applies to login attempts only."

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a client with fewer failed login attempts than its allowance in the current window, when it submits correct credentials, then it is authenticated normally. | T4 |
| AC2 | Given a client that has used its full failed-attempt allowance within the current window, when it makes a further login attempt with correct credentials, then the attempt is rejected with E1 in the standard error shape, including an indication of when to retry. | T2 |
| AC3 | Given a client that logs in successfully more times than its failed-attempt allowance within one window, when it logs in again with correct credentials, then it is authenticated — successes never consume the allowance. | T3 |
| AC4 | Given a client one failure short of its allowance that then logs in successfully, when it fails once more and afterwards attempts to log in, then the attempt is rejected with E1 — the success did not clear the counted failures. | T5 |
| AC5 | Given one client locked out of login, when a different client submits correct credentials, then that client is authenticated — allowances are independent per client. | T6 |
| AC6 | Given a client locked out of login, when it makes a request to another part of the service, then the request is served normally — the lock applies to login attempts only. | T7 |
