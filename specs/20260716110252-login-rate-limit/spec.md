# Spec: Login attempt rate limiting
Status: READY TO IMPLEMENT
Story: As an API operator, I want repeated failed login attempts from a client to be limited, so that attackers cannot brute-force user credentials.

> Related: `specs/20260716084012-api-rate-limit` (IMPLEMENTED) introduced the
> general per-client request allowance. This feature adds a **stricter,
> login-specific** allowance on top of it; the general one keeps applying
> unchanged.

## 1. Behavior

Main flow:

- Every **failed** login attempt counts against the requesting client's
  login allowance: a maximum number of failed attempts per fixed time window.
  The window opens when the client's first counted attempt arrives and lasts
  the configured lock window duration (decision #4).
- While the client has failed attempts remaining, login behaves exactly as it
  does today: correct credentials authenticate the client; wrong credentials
  produce the normal invalid-credentials failure (and consume one attempt).
- A **successful** login never consumes the allowance (decision #1) and does
  **not** clear failures already counted in the window — failures accumulate
  for the whole window regardless of interleaved successes (decision #5).
- When a client has used its full allowance of failed attempts within the
  window, every further login attempt — even one carrying correct
  credentials — is rejected with the rate-limit-exceeded error (E1), including
  an indication of when it may retry. Once the window elapses, the client's
  allowance is restored.

Alternate flows:

- **Client identity** — the client whose failures are counted is identified
  exactly as the general request allowance identifies it (decision #2): the
  direct connection, or the original requester as relayed when the service is
  configured to trust intermediaries. Each client holds an independent login
  allowance; one client being locked never affects another.
- **Scope** — the lock applies to login attempts only. A locked-out client can
  still reach every other part of the service normally (subject to the general
  request allowance, which keeps applying to login attempts too).
- **Counting state is in-memory** — allowances live in the running service; a
  service restart clears them (same trade-off the general limit accepted).

## 2. Fields

Operator-configured parameters; login requests themselves gain no new fields.

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| failed-attempt allowance | Maximum failed login attempts a client may make within one window | number | Yes | 5 |
| lock window duration | Length of the fixed window in which failures accumulate and a locked client stays locked | duration | Yes | 15 minutes |

## 3. Validation rules

None — the feature introduces no new client-supplied fields; the two
operator parameters fall back to their defaults when unset.

## 4. Error responses

- **E1 — login attempts exceeded.** Trigger: a client that has used its full
  failed-attempt allowance within the current window makes another login
  attempt (regardless of the credentials it carries). The client is told
  "Too many requests, please try again later." with an indication of when it
  may retry — **the same error, under the same stable identifier, as the
  general rate limit's rejection** (decision #3). It is distinguished from an
  invalid-credentials failure by that identifier; it is deliberately *not*
  distinguishable from the general limit's rejection.

## 5. Acceptance criteria

- **AC1** — Given a client with fewer failed login attempts than its allowance
  in the current window, when it submits correct credentials, then it is
  authenticated normally.
- **AC2** — Given a client that has used its full failed-attempt allowance
  within the current window, when it makes a further login attempt with
  correct credentials, then the attempt is rejected with E1 in the standard
  error shape, including an indication of when to retry.
- **AC3** — Given a client that logs in successfully more times than its
  failed-attempt allowance within one window, when it logs in again with
  correct credentials, then it is authenticated — successes never consume the
  allowance.
- **AC4** — Given a client one failure short of its allowance that then logs
  in successfully, when it fails once more and afterwards attempts to log in,
  then the attempt is rejected with E1 — the success did not clear the counted
  failures.
- **AC5** — Given one client locked out of login, when a different client
  submits correct credentials, then that client is authenticated — allowances
  are independent per client.
- **AC6** — Given a client locked out of login, when it makes a request to
  another part of the service, then the request is served normally — the lock
  applies to login attempts only.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | What counts toward the 5-attempt limit — every login request, or only failed ones? | Only failed attempts | §1 main flow: successes never consume the allowance; AC3 |
| 2 | What identifies the client being locked out? | Client identity, same as the general request allowance (direct connection / relayed original requester) | §1 "Client identity" flow; AC5 |
| 3 | What error does a locked-out client receive? | The same rate-limit-exceeded error as the general limit, same stable identifier | §4 E1; AC2 |
| 4 | How does the 15-minute window behave once failures start? | Fixed window opening at the first counted attempt; locked until that window ends | §1 main flow; §2 "lock window duration" |
| 5 | Does a successful login clear earlier failures? | No — failures accumulate for the whole window; a success just doesn't count | §1 main flow; AC4 |
