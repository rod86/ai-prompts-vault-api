# Spec: Owner-only, authenticated update & delete of a prompt
Status: READY TO IMPLEMENT
Story: As a registered user, I want updating and deleting a prompt to require me to be authenticated and to be limited to prompts I created, so that only a prompt's owner can modify or remove it.

## 1. Behavior

**Main flow — update.** An authenticated user who is the prompt's owner (its
recorded creator) submits changes to that prompt. The system applies the changes
and returns the updated prompt, including its creator's identity and its category
— exactly as today.

**Main flow — delete.** An authenticated user who is the prompt's owner deletes
that prompt. The prompt is permanently removed and the user is told the deletion
succeeded, with no content returned — exactly as today.

**Alternate — not authenticated.** A request (to update or to delete) that does
not carry a valid authenticated identity is rejected as **unauthorized**; nothing
changes. Consistent with the established create-prompt behavior, authentication is
checked **before** the request is validated, so an unauthenticated request with an
otherwise-invalid body or identifier is still rejected as unauthorized (not as
invalid input).

**Alternate — not the owner.** An authenticated user who is **not** the prompt's
creator attempts to update or delete it. The request is rejected as **forbidden**
("you are not allowed to modify or delete this prompt"); nothing changes. This is
distinguished from *not found*: the prompt exists, but the requester did not create
it.

**Alternate — not found.** A well-formed identifier that matches no existing prompt
is rejected as **not found**; nothing changes. Existence is determined **before**
ownership, so a request for a prompt that does not exist is *not found*, never
*forbidden* — the ownership check never reveals whether some other user's prompt
exists.

**Alternate — unknown category (update only).** An authenticated owner naming a
category that does not exist is rejected as an **unknown category**; nothing
changes. (Pre-existing; now reached only after successful authentication and the
ownership check.)

**Alternate — invalid input.** A malformed identifier (update or delete) or an
invalid body (update) from an authenticated request is rejected as **invalid
input**; nothing changes. (Pre-existing.)

The owner is a prompt's **creator**, recorded when the prompt was created and
immutable. Ownership is decided from the authenticated identity of the request; it
is never taken from the request body.

## 2. Fields

This feature adds no stored fields. It introduces one input to the update and
delete actions:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| requester | The authenticated user making the request, used to decide ownership | reference to a user | Yes | the current authenticated user (system-derived, not client-provided) |

Existing update inputs — title, prompt text, category, optional description — and
the delete input (the prompt's identifier) are unchanged. `requester` is never
accepted from the body.

## 3. Validation rules

- **V1** — The request must carry a valid authenticated identity. A request with no
  identity, or one whose identity cannot be established, is invalid ("not
  authenticated"). Authentication follows the project's already-established
  authentication behavior and is evaluated **before** body/identifier validation.
- **V2** — For an existing prompt, the authenticated requester must be the prompt's
  **owner** (its recorded creator) for the update or delete to proceed. Evaluated
  **after** the prompt is found to exist and before any further processing (e.g.
  category resolution on update). The requester's ownership is derived from the
  authenticated identity, never from the request body.

## 4. Error responses

- **E1** — *Not authenticated.* Trigger: V1 fails (no/invalid identity). The user is
  told the request is unauthorized and nothing changes. Takes precedence over
  body/identifier validation. Its specific variants (e.g. absent vs. unreadable
  identity) follow the established authentication rules and are not redefined here.
- **E2** — *Not the owner (forbidden).* Trigger: V2 fails — the prompt exists but
  the authenticated requester is not its creator. The user is told they are not
  allowed to modify or delete the prompt and nothing changes. Distinguished from
  *not found* (E3): the prompt exists. The same error applies to both update and
  delete.
- **E3** — *Prompt not found.* Trigger: a well-formed identifier matches no existing
  prompt. The user is told the prompt was not found and nothing changes.
  (Pre-existing; unchanged except that it is now reached only after successful
  authentication, and is determined before ownership so it is never masked as
  *forbidden*.)
- **E4** — *Unknown category (update only).* Pre-existing; unchanged except that it
  is now reached only after authentication and the ownership check.
- **E5** — *Invalid input.* Malformed identifier or invalid body. Pre-existing;
  unchanged except that authentication (E1) takes precedence over it.

## 5. Acceptance criteria

- **AC1** — Given a prompt owned by the authenticated user, When that user updates
  it with valid data, Then the update succeeds and the response includes the updated
  prompt with its creator's id and name alongside its category. *(V2)*
- **AC2** — Given a prompt owned by the authenticated user, When that user deletes
  it, Then the prompt is removed and a success-with-no-content result is returned.
  *(V2)*
- **AC3** — Given a request to update a prompt that carries no valid authenticated
  identity, When the user attempts the update, Then it is rejected as unauthorized
  and the prompt is unchanged. *(V1, E1)*
- **AC4** — Given a request to delete a prompt that carries no valid authenticated
  identity, When the user attempts the delete, Then it is rejected as unauthorized
  and the prompt is not removed. *(V1, E1)*
- **AC5** — Given a request to update a prompt that carries no valid authenticated
  identity **and** an invalid body, When the user attempts the update, Then it is
  rejected as unauthorized (not as invalid input) and the prompt is unchanged.
  *(V1, E1 — ordering)*
- **AC6** — Given a prompt created by another user, When an authenticated user who is
  not its creator attempts to update it, Then the request is rejected as forbidden
  and the prompt is unchanged. *(V2, E2)*
- **AC7** — Given a prompt created by another user, When an authenticated user who is
  not its creator attempts to delete it, Then the request is rejected as forbidden
  and the prompt is not removed. *(V2, E2)*
- **AC8** — Given a well-formed identifier that matches no existing prompt, When an
  authenticated user attempts to update or delete it, Then the request is rejected as
  not found (not as forbidden) and nothing changes. *(E2/E3 — ordering)*

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | When an authenticated user who is not the prompt's owner tries to update or delete it, how should the API respond? | Reject as **forbidden** with a distinct ownership error (the prompt is confirmed to exist but the requester isn't its owner), rather than masking it as *not found*. | §1 "not the owner"; V2; E2; AC6, AC7 |
| 2 | *(Assumption — follows create-prompt Decision 4)* When is authentication evaluated relative to validation on update/delete? | Before body/identifier validation, so unauthenticated requests are rejected as unauthorized regardless of body/identifier. | §1 "not authenticated"; V1; AC5 |
| 3 | *(Assumption)* Is existence or ownership decided first? | Existence first — a non-existent prompt is *not found*, never *forbidden*, so ownership never reveals another user's prompt. | §1 "not found"; E2/E3 ordering; AC8 |
