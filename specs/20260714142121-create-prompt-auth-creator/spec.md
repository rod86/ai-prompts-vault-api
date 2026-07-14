# Spec: Authenticated create-prompt with recorded creator
Status: READY TO IMPLEMENT
Story: As a registered user, I want creating a prompt to require me to be authenticated and to record me as its creator, so that only authenticated users can create prompts and every prompt is attributed to the person who created it.

## 1. Behavior

**Main flow.** An authenticated user submits a new prompt (title, prompt text,
category, and optional description). The system creates the prompt, records the
submitting user as its **creator**, and returns the created prompt including its
creator's identity (id and name) alongside its category.

**Alternate — not authenticated.** A request that does not carry a valid
authenticated identity is rejected as **unauthorized**; no prompt is created.
Authentication is checked **before** the request body is validated, so an
unauthenticated request with an otherwise-invalid body is still rejected as
unauthorized (not as invalid input).

**Alternate — unknown category.** An authenticated request naming a category that
does not exist is rejected as an **unknown category**; no prompt is created.
(Pre-existing behavior, now reachable only once authenticated.)

The creator is always the authenticated user making the request. It is
**system-assigned** and is never taken from the request body. Once set at
creation, a prompt's creator does not change.

**Related — updating a prompt.** Updating an existing prompt does **not** require
authentication and never changes the creator. A successful update returns the
updated prompt including its creator's identity (id and name) — the same creator
shape returned on create — alongside its category.

## 2. Fields

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| creator | The user who created the prompt (exposed as identity: id + name) | reference to a user | Yes | the current authenticated user (system-set, not client-provided) |

Existing create inputs — title, prompt text, category, optional description — are
unchanged by this feature. `creator` is not accepted as an input; any attempt to
supply it in the body has no effect.

## 3. Validation rules

- **V1** — The request must carry a valid authenticated identity. A request with
  no identity, or one whose identity cannot be established, is invalid ("not
  authenticated"). Authentication follows the project's already-established
  authentication behavior and is evaluated before body validation.
- **V2** — The recorded creator must be the authenticated user of the request;
  it is never sourced from the request body.
- **V3** — The recorded creator must reference a user that exists. (Guaranteed by
  V1's established authentication behavior, which resolves the request to an
  existing user; referential integrity is preserved at persistence.)

## 4. Error responses

- **E1** — *Not authenticated.* Trigger: V1 fails (no/invalid identity). The user
  is told the request is unauthorized and no prompt is created. Distinguished from
  invalid-input (E-existing validation) and unknown-category (E2): E1 is an
  authentication failure and takes precedence over body validation. Its specific
  variants (e.g. absent vs. unreadable identity) follow the established
  authentication rules and are not redefined here.
- **E2** — *Unknown category.* Trigger: an authenticated request names a category
  that does not exist. The user is told the category is unknown and no prompt is
  created. (Pre-existing; unchanged except that it is now reached only after
  successful authentication.)

## 5. Acceptance criteria

- **AC1** — Given a valid authenticated request with valid prompt data, When the
  user creates a prompt, Then the prompt is stored with the authenticated user as
  its creator and the response includes the creator's id and name together with
  the category. *(V2, V3)*
- **AC2** — Given a request that carries no valid authenticated identity, When the
  user attempts to create a prompt, Then the request is rejected as unauthorized
  and no prompt is stored. *(V1, E1)*
- **AC3** — Given a request that carries no valid authenticated identity **and** an
  invalid body, When the user attempts to create a prompt, Then the request is
  rejected as unauthorized (not as invalid input) and no prompt is stored.
  *(V1, E1 — ordering)*
- **AC4** — Given a valid authenticated request naming a category that does not
  exist, When the user attempts to create a prompt, Then the request is rejected as
  unknown category and no prompt is stored. *(E2)*
- **AC5** — Given an existing prompt with a recorded creator, When it is updated
  (without authentication), Then the update succeeds and its response includes the
  original creator's id and name alongside the category, with the creator
  unchanged. *(§1 update behavior)*

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should the create action record who created the prompt, and is the creator exposed or only stored? | Store the creator and expose it in the create response as the user's identity (id + name), mirroring how the category is exposed. | §1 main flow returns creator; §2 creator field; AC1. |
| 2 | Is a creator mandatory for every prompt, or optional? | Mandatory — every prompt has a creator; no historical prompts need backfilling. | §2 Required = Yes; V3. |
| 3 | Where does the creator come from — the request body or the authenticated identity? | Always the authenticated user of the request; never the body. | §1, V2, §2 default. |
| 4 | When is authentication evaluated relative to body validation? | Before body validation, so unauthenticated requests are rejected as unauthorized regardless of body. | §1 alternate; V1; AC3. |
| 5 | Which actions are protected by authentication in this feature? | Only the create-prompt action. Update and delete are deferred and remain unauthenticated/unchanged. | Scope limited to create (§1); update/delete out of scope. |
| 6 | If a prompt is later edited, does its creator change? | No — the creator is immutable; it is preserved unchanged across edits. | §1 "creator does not change". |
| 7 | Should the update-prompt response also return the creator, and should update now require authentication? | Yes — the update response returns the creator in the same shape as create; no, update stays unauthenticated. This turns the earlier creator ripple on update into intended behavior. | §1 "updating a prompt"; AC5. |
