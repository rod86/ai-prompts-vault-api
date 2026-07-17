# Spec: Reorganize route schemas and make the health check a first-class resource
Status: IMPLEMENTED
Story: As a maintainer of the API, I want each resource's request and response definitions grouped together, cross-resource field checks defined once, and the health check structured like every other endpoint, so that the codebase stays consistent and easy to navigate as resources grow — without changing anything an API client can observe.

<!--
This is a structural reorganization. Its overriding behavioral contract is: the
externally observable surface does not change. The acceptance criteria therefore
pin the invariants a client can see (validation, responses, errors, docs, rate
limiting) plus the one genuinely new observable outcome — the health check served
by its own endpoint handler with its response shape pinned like the others.
-->

## 1. Behavior

Main flow — the reorganization is invisible to any API client:

- Every existing endpoint (authenticate, register user, list prompt categories, create prompt, update prompt, delete prompt) accepts exactly the same input, applies exactly the same validation with exactly the same messages, and returns exactly the same success and error results as before.
- The health check continues to answer with a healthy status and continues to count against the general request-rate allowance, so a caller who exceeds that allowance receives the rate-limit response on the health check just as before.
- The published API documentation continues to describe the same set of operations with the same request and response shapes.

Developer-facing outcome (not client-observable, but the point of the change):

- Each resource's input definitions and output definitions are grouped together per resource.
- A field check shared across resources (identifier format, email format) is defined once and reused, rather than repeated per endpoint.
- The health check is a first-class endpoint served by its own handler, consistent in structure with the other endpoints, and its response shape is verified against its documented shape.

## 2. Fields

No new fields are introduced. Every existing request and response field keeps its
current meaning, type, requiredness, and wire name.

The only field described by a newly-pinned response is the health check's:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| status | Service health indicator | choice of `ok` (the only value) | Yes | — |

## 3. Validation rules

No validation behavior changes. The rules below assert preservation.

- **V1 — Identifier format preserved.** Every endpoint that accepts an identifier value rejects a value that is not a well-formed identifier, and a missing value, with the same distinct messages as today ("Invalid" vs "Missing required value").
- **V2 — Email format preserved.** Every endpoint that accepts an email rejects a malformed email, and a missing email, with the same distinct messages as today ("Invalid email" vs "Missing required value").
- **V3 — All other field validation preserved.** Every other request field (titles, prompt text, password strength, etc.) keeps its current constraints and messages unchanged.

## 4. Error responses

No error behavior changes. The rules below assert preservation.

- **E1 — Invalid input preserved.** A request failing any validation rule returns the same validation-failure result, with the same per-field messages, as before.
- **E2 — Business and auth errors preserved.** Every existing not-found, forbidden, unauthorized, unprocessable, and duplicate-email outcome returns the same result as before.
- **E3 — Rate-limit on health preserved.** A caller exceeding the general request-rate allowance receives the same rate-limit result on the health check as on any other endpoint.

## 5. Acceptance criteria

- **AC1 — Existing endpoints unchanged.** Given the running API, when the full existing test suite for authenticate, register user, list prompt categories, and create/update/delete prompt is run, then every request-validation, success, and error assertion passes unchanged. (Covers V1, V2, V3, E1, E2.)
- **AC2 — Health check response unchanged.** Given the running API, when a client requests the health check, then it returns the healthy status body exactly as before. (Covers §1 main flow.)
- **AC3 — Health check documented shape pinned.** Given the running API, when a client requests the health check, then the response body conforms to the health check's documented response shape. (Covers §2 health field.)
- **AC4 — Health check stays rate-limited.** Given a client that has exhausted the general request-rate allowance, when it requests the health check, then it receives the rate-limit response. (Covers E3.)
- **AC5 — Documentation surface unchanged.** Given the running API, when the API documentation document is retrieved, then it still validates and describes the same operations and the same request/response shapes as before. (Covers §1 documentation flow.)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | How should the route/schema files be organized? | Per-resource folders, each holding its router + request/response schemas; shared helpers in their own folder; docs stay in src/docs | Establishes the per-resource grouping outcome in §1 |
| 2 | Put the health response schema inline in the docs file? | Superseded — see Q3 | — |
| 3 | Move the health endpoint to its own handler and replicate the same structure as the other resources? | Yes — health becomes a first-class resource (handler + router + response schema), so its response shape is pinned like the others | Drives AC2, AC3; §1 developer outcome |
| 4 | Should the health check remain subject to the request-rate limiter? | Yes — it is a deliberate denial-of-service guard; keep it behind the limiter | AC4, E3 |
| 5 | Include the documentation-layer response-fragment deduplication in scope? | Yes, include it (implementation detail; no change to the documented surface) | Reinforces AC5 (docs output unchanged) |
| 6 | Name the routes-side shared-helpers folder to match the docs naming? | No — keep it named "shared" | No spec effect (naming is an implementation detail) |
| 7 | Where should the health check's test live? | Its own dedicated handler test, including a documented-shape assertion; removed from the app-level test | AC2, AC3 |
