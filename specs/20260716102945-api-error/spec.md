# Spec: Unified boundary error (ApiError)
Status: IMPLEMENTED
Story: As an API maintainer, I want every controlled boundary failure (invalid request data, rate limit exceeded, unknown route) raised and rendered through a single shared error mechanism, so that error responses stay uniform and adding a new controlled failure requires no duplicated handling.

## 1. Behavior

Main flow:

- Every controlled failure detected at the service boundary — invalid request
  data, an exhausted request allowance, a request to an unknown route — is
  reported to the client in the one standard error shape: the failure's
  transport status, a stable identifier, and a human-readable message.
- Each such failure is raised at its point of detection carrying that
  information, and a single central rendering step turns it into the reply;
  no boundary failure builds its reply by hand anymore.
- When a failure carries additional detail (today only invalid request data
  does), the detail is included alongside the standard shape. When it carries
  none, no detail property appears on the reply at all — absent, never empty.

Alternate flows:

- **Business-rule failures** (e.g. a prompt that does not exist, invalid
  credentials) are out of scope: they continue through their existing
  dedicated path unchanged.
- **Unexpected/technical failures** are out of scope: they continue to
  produce the generic internal error, with the underlying cause never sent to
  the client.
- **No client-visible change** — every reply a client can observe today stays
  identical; this story unifies how boundary failures are raised and
  rendered, not what clients receive.

## 2. Fields

No client-supplied fields and no new configuration values.

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |

## 3. Validation rules

None new — existing request-validation rules are unchanged and out of scope;
this story changes only how their failure is raised and rendered.

## 4. Error responses

- **E1 — invalid request data.** Trigger: a request whose data fails
  validation. The client is told "Request Validation data failed" in the
  standard error shape under this error's own stable identifier, together
  with per-field detail of what failed. It is the only boundary failure that
  carries detail.
- **E2 — rate limit exceeded.** Trigger: a client makes a request after using
  its full allowance within the current window. The client is told "Too many
  requests, please try again later." in the standard error shape under its
  own stable identifier, with no detail property.
- **E3 — unknown route.** Trigger: a request to a route the service does not
  expose. The client is told, in the standard error shape under this error's
  own stable identifier, a message naming the attempted action and path, with
  no detail property.

## 5. Acceptance criteria

- **AC1** — Given a request whose data fails validation, when it is
  submitted, then it is rejected with E1 in the standard error shape,
  including the per-field detail of what failed.
- **AC2** — Given a client that has used its full allowance within the
  current window, when it makes a further request, then it is rejected with
  E2 in the standard error shape, with no detail property present.
- **AC3** — Given a request to a route the service does not expose, when it
  is made, then it is rejected with E3 in the standard error shape whose
  message names the attempted action and path, with no detail property
  present.
- **AC4** — Given a controlled boundary failure that carries no additional
  detail, when it is rendered, then the reply contains the standard shape and
  no detail property at all — the property is absent, not empty.
- **AC5** — Given a controlled boundary failure that carries additional
  detail, when it is rendered, then the reply includes that detail alongside
  the standard shape.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should controlled boundary failures each get their own error type sharing an abstract base, or be a single concrete error carrying its status, identifier, message, and optional detail? (session discussion) | A single concrete error, raised with its data inline | §1 single mechanism; E1–E3 all raised the same way. |
| 2 | Which "not found" failures are in scope — the unknown-route failure only, or also business not-found failures? | Unknown route only; business failures keep their existing dedicated path untouched | §1 alternate flows; E3 limited to unknown routes. |
| 3 | Where should the shared error live? | In a dedicated top-level errors home, one error per file | No spec-visible effect; recorded for the plan. |
| 4 | Should the transport status the error carries be constrained to a fixed allowed set? | No — keep it a simple number | No spec-visible effect; recorded for the plan. |
| 5 | May an absent detail appear as an empty or null property on the reply? | No — the property is omitted entirely when there is no detail | §1 main flow; E2/E3 wording; AC4. |
| 6 | Does this story capture the feature? "As an API maintainer, I want every controlled boundary failure (invalid request data, rate limit exceeded, unknown route) raised and rendered through a single shared error mechanism, so that error responses stay uniform and adding a new controlled failure requires no duplicated handling." | Yes, that's it | Story line adopted verbatim. |
