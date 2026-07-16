# Tasks: API rate limiting
Plan: specs/20260716084012-api-rate-limit/plan.md

- [x] T1. Install express-rate-limit
  - Type: dependency
  - Depends on: none
  - Red: none — dependency install, no logic to test; verified by `npm run typecheck` passing (logic-less exception; see testing-practices)
  - Green: `npm i express-rate-limit` (^8.5.2) — `package.json` + lockfile

- [x] T2. Rate-limit and trust-proxy config values
  - Type: config
  - Depends on: none
  - Red: none — `src/config/config.ts` is pure env mapping (composition; no schema, matching the existing file); values are proven behaviorally by T5–T8
  - Green: add `rateLimit.windowMs` (`RATE_LIMIT_WINDOW_MS` ?? 900000), `rateLimit.max` (`RATE_LIMIT_MAX` ?? 100), `trustProxyHops` (`TRUST_PROXY_HOPS` ?? 0) to `src/config/config.ts`; add the three vars to `.env.example` (`TRUST_PROXY_HOPS=1` with its comment, per plan §2) and to the local `.env` (plan R1)
  - Covers: spec §2 fields "window duration", "request allowance", "trusted intermediary hops"

- [x] T3. TooManyRequests category maps to 429
  - Type: domain + middleware (error mapping)
  - Depends on: none
  - Red: extend the `toEqual` assertion in `tests/unit/middleware/domainErrorStatus.test.ts` to include `TooManyRequests: 429` — fails: key absent from `CATEGORY_STATUS`
  - Green: add `'TooManyRequests'` to `ErrorCategory` (`src/modules/shared/domain/DomainError.ts`) and `TooManyRequests: 429` to `CATEGORY_STATUS` (`src/middleware/domainErrorStatus.ts`)
  - Covers: E1 "under this error's own stable identifier … distinguishes it from every other error" (status mapping half)

- [x] T4. RateLimitExceededError
  - Type: middleware (error class)
  - Depends on: T3
  - Red: new `tests/unit/middleware/rateLimit/RateLimitExceededError.test.ts` asserting a new instance has `code === 'TOO_MANY_REQUESTS'`, `category === 'TooManyRequests'`, `message === 'Too many requests, please try again later.'`, and is an `instanceof DomainError` — fails: module does not exist
  - Green: `src/middleware/rateLimit/RateLimitExceededError.ts` extending `DomainError` (plan §3), named-class default pattern mirroring `RequestValidationError.ts`
  - Covers: E1 "The client is told 'Too many requests, please try again later.' … under this error's own stable identifier"

- [x] T5. Limiter factory mounted; responses carry allowance headers
  - Type: middleware + app wiring
  - Depends on: T1, T2
  - Red: new `tests/integration/rateLimitMiddleware.test.ts`: a single `GET /does-not-exist` (limited probe path — no auth/DB needed, plan §8) returns its normal 404 contract **and** carries the `ratelimit-policy` and `ratelimit` headers — fails: no limiter mounted, headers absent
  - Green: `src/middleware/rateLimit/createRateLimitMiddleware.ts` — default-exported factory `createRateLimitMiddleware({ windowMs, max })` returning `rateLimit({ windowMs, limit: max, standardHeaders: 'draft-8', legacyHeaders: false })` (no custom handler yet); mount `createRateLimitMiddleware(config.rateLimit)` in `src/app.ts` after the `/health` route, before `apiRouter` (minimal placement to pass the probe test; final placement set by T7)
  - Covers: AC1 "Given a client with remaining allowance, when it makes a request to any limited endpoint, then the request is served normally and the response carries the client's current allowance state."

- [x] T6. Over-limit requests rejected with the E1 envelope
  - Type: middleware + app wiring
  - Depends on: T3, T4, T5
  - Red: in `rateLimitMiddleware.test.ts`, send `config.rateLimit.max + 1` requests to `GET /does-not-exist` and assert the **final** response (order-tolerant, plan §7.4) is `429` with body exactly `{ status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' }` and a `retry-after` header — fails: the library's default handler returns its own body, not the envelope
  - Green: add `handler: (_req, _res, next) => next(new RateLimitExceededError())` to the factory's `rateLimit(...)` options
  - Covers: AC2 "Given a client that has used its full allowance within the current window, when it makes a further request, then the request is rejected with E1 in the standard error shape, including an indication of when to retry."

- [x] T7. Health check included in the rate limit
  - Type: app wiring
  - Depends on: T5, T6
  - Red: in `rateLimitMiddleware.test.ts` (after T6's test has exhausted the direct client's allowance), `GET /health` returns `429` with the E1 envelope `{ status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' }` — fails: limiter currently mounted below `/health`, so health still answers `200 { status: 'ok' }`
  - Green: move the limiter mount in `src/app.ts` to right after `express.json()`, before every route (plan §1 final ordering, decision #12)
  - Covers: AC3 "Given a client that has used its full allowance within the current window, when it calls the health check, then the request is rejected with E1 like any other endpoint."

- [ ] T8. Trust proxy: allowances independent per forwarded client
  - Type: app wiring
  - Depends on: T2, T6
  - Red: in `rateLimitMiddleware.test.ts`, exhaust the allowance for forwarded client `X-Forwarded-For: 10.1.1.1` (`max + 1` requests, final one `429`), then a single request with `X-Forwarded-For: 10.2.2.2` is **not** `429` — fails: without `trust proxy`, both key to the direct connection's exhausted bucket (requires `TRUST_PROXY_HOPS=1` in `.env`, T2/plan R1)
  - Green: `app.set('trust proxy', config.trustProxyHops)` in `src/app.ts` before the routes
  - Covers: AC4 "Given the service trusts one relaying intermediary and one original client has exhausted its allowance, when a different original client makes a request through the intermediary, then that request is served — allowances are independent per original client."

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a client with remaining allowance, when it makes a request to any limited endpoint, then the request is served normally and the response carries the client's current allowance state. | T5 |
| AC2 | Given a client that has used its full allowance within the current window, when it makes a further request, then the request is rejected with E1 in the standard error shape, including an indication of when to retry. | T6 (supported by T3, T4) |
| AC3 | Given a client that has used its full allowance within the current window, when it calls the health check, then the request is rejected with E1 like any other endpoint. | T7 |
| AC4 | Given the service trusts one relaying intermediary and one original client has exhausted its allowance, when a different original client makes a request through the intermediary, then that request is served — allowances are independent per original client. | T8 |
