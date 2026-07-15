# Spec: Uniform Error Envelope + Domain Error Classification
Status: IMPLEMENTED
Story: As an API client, I want every error response to share one predictable shape with a stable machine-readable code, so that I can handle failures uniformly without depending on internal class names.

## 1. Behavior

Main flow — a request fails and the API returns an error:

1. When any request fails, the client receives a single, uniform error body carrying:
   an outcome **status**, a stable **code**, and a human **message**.
2. The **status** in the body always equals the response's transport status.
3. The **code** is a stable identifier independent of any internal class name, so
   renaming internal code never changes the client contract.

Alternate flows:

- **Invalid request input** — the error body additionally carries a **details**
  breakdown describing which submitted fields were invalid and why. This is the only
  error that adds a fourth property; its shape is unchanged from today.
- **Unknown route** — a request to a path the API does not serve returns the same
  uniform body (an unknown-route outcome), not a bespoke shape.
- **Unexpected / technical failure** — any failure that is not an expected business
  condition or an invalid request returns a **generic** body only: a fixed code and a
  fixed message. No internal detail (class name, stack, underlying cause, storage
  wording) is ever revealed to the client. The underlying cause is recorded server-side
  so operators can diagnose it.

Expected business conditions (below) each carry their own stable code and map to an
outcome family (not-found, forbidden, unauthorized, unprocessable). Adding a new
business condition that reuses an existing family must not require editing the central
place that renders responses.

## 2. Fields

The error response envelope:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| status | Outcome status indicator, mirrored from the transport status into the body | number | Yes | — |
| code | Stable, machine-readable error identifier, independent of internal names | text | Yes | — |
| message | Human-readable description of the failure | text | Yes | — |
| details | Field-level breakdown of an invalid request (existing nested shape) | object | Only for invalid-request errors | — |

## 3. Validation rules

Response-shape invariants (each precise enough to become a test):

- **V1** — Every error response body contains exactly `status`, `code`, and `message`,
  and no other property, except an invalid-request error which additionally contains
  `details`.
- **V2** — The `status` value inside the body equals the response's transport status.
- **V3** — A technical/unexpected failure exposes only the generic `code` and `message`;
  it never leaks an internal class name, stack, underlying cause, or storage wording.

## 4. Error responses

Each row: trigger, outcome family, stable `code`, what the client sees, and how it is
distinguished.

| # | Trigger condition | Outcome family | code | Client sees | Distinguished by |
| - | ----------------- | -------------- | ---- | ----------- | ---------------- |
| E1 | A requested prompt does not exist | NotFound | `PROMPT_NOT_FOUND` | status + code + message | `code` |
| E2 | A user acts on a prompt they do not own | Forbidden | `PROMPT_OWNERSHIP` | status + code + message | `code` |
| E3 | A referenced category does not exist | Unprocessable | `CATEGORY_NOT_FOUND` | status + code + message | `code` |
| E4 | A registration email is already in use | Unprocessable | `EMAIL_ALREADY_IN_USE` | status + code + message | `code` |
| E5 | Supplied credentials are invalid | Unauthorized | `INVALID_CREDENTIALS` | status + code + message | `code` |
| E6 | No authentication token was provided | Unauthorized | `MISSING_TOKEN` | status + code + message | `code` |
| E7 | The authentication token is invalid | Unauthorized | `INVALID_TOKEN` | status + code + message | `code` |
| E8 | The authentication token has expired | Unauthorized | `TOKEN_EXPIRED` | status + code + message | `code` |
| E9 | Request input fails validation | InvalidRequest | `VALIDATION_ERROR` | status + code + message + `details` | presence of `details` |
| E10 | A request targets an unknown route | NotFound | `NOT_FOUND` | status + code + message | `code` |
| E11 | Any unexpected/technical failure (incl. failed create/update/registration, storage not connected) | InternalFailure | `INTERNAL_ERROR` | generic status + code + message only | fixed generic `code`; no detail |

## 5. Acceptance criteria

- **AC1** — Given a prompt id that does not exist, When a client requests an operation on
  it, Then the response is a not-found outcome with `code` `PROMPT_NOT_FOUND`, a message,
  and a body `status` equal to the transport status. (E1, V1, V2)
- **AC2** — Given a prompt owned by another user, When a client attempts to modify or
  delete it, Then the response is a forbidden outcome with `code` `PROMPT_OWNERSHIP`. (E2)
- **AC3** — Given a category id that does not exist, When a client creates or updates a
  prompt referencing it, Then the response is an unprocessable outcome with `code`
  `CATEGORY_NOT_FOUND`. (E3)
- **AC4** — Given an email already registered, When a client registers with it, Then the
  response is an unprocessable outcome with `code` `EMAIL_ALREADY_IN_USE`. (E4)
- **AC5** — Given invalid credentials, When a client authenticates, Then the response is
  an unauthorized outcome with `code` `INVALID_CREDENTIALS`. (E5)
- **AC6** — Given no token, When a client calls a protected route, Then the response is an
  unauthorized outcome with `code` `MISSING_TOKEN`. (E6)
- **AC7** — Given an invalid token, When a client calls a protected route, Then the
  response is an unauthorized outcome with `code` `INVALID_TOKEN`. (E7)
- **AC8** — Given an expired token, When a client calls a protected route, Then the
  response is an unauthorized outcome with `code` `TOKEN_EXPIRED`. (E8)
- **AC9** — Given request input that violates a field rule, When it is submitted, Then the
  response is an invalid-request outcome with `code` `VALIDATION_ERROR` and a `details`
  object (existing nested shape), and body `status` equals the transport status. (E9, V1)
- **AC10** — Given a path the API does not serve, When a client requests it, Then the
  response is a not-found outcome with `code` `NOT_FOUND` and a message naming the
  method and path. (E10)
- **AC11** — Given an unexpected/technical failure, When it occurs during a request, Then
  the response is a generic internal-failure outcome with `code` `INTERNAL_ERROR` and a
  fixed message, no internal detail is leaked, and the underlying cause is recorded
  server-side. (E11, V3)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should the unknown-route response also adopt the uniform envelope? | Migrate it too | E10/AC10 added: unknown route returns `{ status, code: 'NOT_FOUND', message }` instead of the old `{ error, message }` |
| 2 | Should validation `details` become the doc's array or keep the existing nested-object shape? | Keep existing object | E9/AC9 preserve the current `details` object shape; only `status` + `code` are added around it |
| 3 | How should technical-failure errors (create/update/registration/storage-not-connected) be modeled, given every named error is thrown from application use cases, not adapters? | Drop the separate family; generic internal-failure fallback | No `InfrastructureError` base is introduced. Those errors stay as-is and are rendered by the generic internal-failure path (E11). Only a business-error base with `code` + family classification is introduced |
| 4 | Wrap each handler in try/catch mapping to a generic error-with-status, instead of a centralized handler? | Keep centralized | Handlers keep throwing; a single central renderer maps family → status → envelope. Chosen on engineering merits (auth/token errors are thrown pre-handler and cannot be caught per-handler; avoids duplicating HTTP mapping across handlers) and aligns with the node-express-typescript guideline |
