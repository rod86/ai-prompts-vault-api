# Spec: API rate limiting
Status: IMPLEMENTED
Story: As an API operator, I want incoming requests rate-limited per client, so that the service stays available and no single client can overload it.

## 1. Behavior

Main flow:

- Every request to the service — the health check included — counts against the
  requesting client's allowance: a maximum number of requests per fixed time
  window.
- While the client has allowance remaining, the request is served normally and
  the response carries the client's current allowance state (its limit, how much
  remains, and when the window resets), using the current standard convention
  for communicating rate limits.
- When a client has used its full allowance within the window, every further
  request is rejected with the rate-limit-exceeded error (E1), including an
  indication of when it may retry. Once the window elapses, the client's
  allowance is restored.

Alternate flows:

- **Behind trusted intermediaries** — when the service is configured to trust a
  number of relaying intermediaries (hops), the identity used for counting is
  the original requester's, as relayed by the intermediary — not the
  intermediary itself. Each original client then holds an independent allowance.
- **No trusted intermediary (default)** — relayed identity claims are ignored;
  the direct connection identifies the client, so a client cannot forge a fresh
  identity to escape its allowance.
- **Counting state is in-memory** — allowances live in the running service
  instance's memory: a restart resets all counters, and each running instance
  counts independently (accepted for the current single-instance deployment;
  revisit when scaling out).

## 2. Fields

No client-supplied fields. The feature adds three operator configuration values:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| window duration | length of the fixed counting window | number (milliseconds) | No | 900000 (15 minutes) |
| request allowance | maximum requests per client per window | number | No | 100 |
| trusted intermediary hops | how many relaying intermediaries to trust when identifying the client | number | No | 0 (trust none) |

## 3. Validation rules

None — the feature introduces no client-supplied fields. Configuration values
fall back to their defaults when unset.

## 4. Error responses

- **E1 — rate limit exceeded.** Trigger: a client makes a request after using
  its full allowance within the current window. The client is told
  "Too many requests, please try again later." in the standard error shape,
  under this error's own stable identifier, together with an indication of when
  it may retry. It is the only error the limiting behavior produces, and its
  identifier distinguishes it from every other error in the service.

## 5. Acceptance criteria

- **AC1** — Given a client with remaining allowance, when it makes a request to
  any limited endpoint, then the request is served normally and the response
  carries the client's current allowance state.
- **AC2** — Given a client that has used its full allowance within the current
  window, when it makes a further request, then the request is rejected with E1
  in the standard error shape, including an indication of when to retry.
- **AC3** — Given a client that has used its full allowance within the current
  window, when it calls the health check, then the request is rejected with E1
  like any other endpoint.
- **AC4** — Given the service trusts one relaying intermediary and one original
  client has exhausted its allowance, when a different original client makes a
  request through the intermediary, then that request is served — allowances are
  independent per original client.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Which store should hold the counters — in-memory, Redis, or Postgres? (session discussion) | In-memory | Counting state is per-instance and resets on restart (§1 alternate flows); shared stores out of scope. |
| 2 | Should any endpoint be exempt? (session discussion) | Health check exempt for now | §1 health-check exemption; AC3. |
| 3 | How should the rejection be produced — direct response or through the central error pipeline? (session discussion) | The limiter raises an error; the central error handler formats the standard shape | E1 uses the standard error shape with a stable identifier. |
| 4 | Fixed limits or configurable? (session discussion) | Window duration and allowance from environment configuration, defaults 15 min / 100 | §2 fields; defaults in §2. |
| 5 | Which rate-limit headers? (session discussion) | Current standard convention (modern draft standard), drop legacy variants, include retry hint on rejection | §1 allowance state wording; E1 retry indication; AC1/AC2. |
| 6 | Include proxy awareness? (session discussion, initially deferred, then "add the proxy solution") | Yes — configurable number of trusted hops, default 0 | §2 trusted intermediary hops; §1 intermediary flows; AC4. |
| 7 | Does this story capture the feature? "As an API operator, I want incoming requests rate-limited per client, so that the service stays available and no single client can overload it." | Yes, that's it | Story line adopted verbatim. |
| 8 | Should the trust-proxy behavior get its own integration test, or is it untested configuration? | Test it | AC4 exists and must be proven by a test. |
| 9 | Where should the rate-limit-exceeded error class live — with the shared business errors or with the boundary layer that raises it? | With the boundary (middleware) layer, mirroring the existing request-validation error precedent | No spec-visible effect; recorded for the plan. |
| 10 | The test environment reads the same configuration file as the app; proving AC4 requires trusting one hop there. Ship the example configuration with hops=1, or keep 0 and invert the test? | Ship the example configuration with hops=1 (commented); the built-in fallback stays 0 | §2 default remains 0 (trust none); AC4 provable as written. |
| 11 | (User instruction while authoring) How is the limiter constructed? | The rate-limit setup lives in an exportable function within the rate-limit middleware folder; the app calls it during wiring | No spec-visible effect; recorded for the plan. |
| 12 | (Spec update, 2026-07-16) Should the health check stay exempt? | No — include the health endpoint within the rate limit | **Supersedes #2.** Health-check exemption removed from §1; AC3 inverted: an exhausted client's health-check call is rejected with E1. |
