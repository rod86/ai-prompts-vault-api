# Spec: Request validation and consistent error responses

Status: IMPLEMENTED
Story: As a developer maintaining this API, I want a reusable request-validation mechanism that rejects malformed requests with a clear error, so that handlers stop duplicating inline parsing logic and validation failures are reported consistently across the whole API.

## 1. Behavior

**Main flow:** Every request handled by the API has its input checked
against the rules defined for the operation it targets, before that
operation does anything else. An operation may define rules over more than
one area of a request's input at once; all of them are checked together, as
a single step. When the input satisfies every rule, the request proceeds
and the operation behaves exactly as it is defined to behave — nothing
about this mechanism changes a valid request's outcome.

**Alternate flow — malformed request:** When the input for an operation
fails one or more of that operation's own rules, the user is told the
request was invalid, together with which piece(s) of the input failed and
why. No result specific to that operation is returned in this case.

## 2. Fields

| Field         | Meaning                                                       | Domain type   | Required | Default |
| ------------- | -------------------------------------------------------------- | ------------- | -------- | ------- |
| message       | A short summary telling the user what happened                 | text          | true     | —       |
| errors        | Which specific piece(s) of the request were invalid, and why   | list of error | true     | —       |
| error.field   | The name of the invalid piece of input                         | text          | true     | —       |
| error.error   | Human-readable reason that piece of input was rejected          | text          | true     | —       |

## 3. Validation rules

- **V1:** Every piece of input required for a given operation that fails
  that operation's own rules is reported as one issue naming which field it
  concerns and what was wrong with it.
- **V2:** When more than one piece of input fails at once — whether within
  one area of the request's input or spread across more than one area
  checked together for the same operation — every failing issue is
  reported together in the same response, never only the first one
  encountered.

## 4. Error responses

- **E1 — Malformed request:** Triggered when the input for an operation
  fails one or more of that operation's own rules. The user is told the
  request was invalid, together with the message and the full list of
  errors (§2). No operation-specific result is returned. Distinguished from
  a successful response by carrying no operation result and a non-empty
  `errors` list.

## 5. Acceptance criteria

- **AC1:** Given an operation whose input satisfies every rule defined for
  it, When the request is handled, Then it proceeds and produces that
  operation's normal result, with no invalid-request notice.
- **AC2:** Given an operation whose input fails one of its rules, When the
  request is handled, Then the user is told the request was invalid (E1),
  naming the failing field and why.
- **AC3:** Given an operation whose input fails more than one rule at
  once — including cases where the failing pieces belong to different
  areas of the request's input checked together — When the request is
  handled, Then the user is told about every failing field together in the
  same notice (E1), not only the first one found.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | --------------- | ------ | -------------------- |
| 1 | What should this planning pass produce? | The full set of planning artifacts (this spec, its plan, and its task list), not a shortened version. | Process/deliverable scope only; no effect on spec content. |
| 2 | Should this feature also introduce a single shared way of turning any thrown failure into a consistent response, rather than continuing today's per-operation handling? | Yes — introduced now, deliberately reversing an earlier decision (from a prior feature) to defer this until a second failure case existed. | Added an "unexpected failure" alternate flow, an E2, and an AC4 at the time. **Superseded by decision #7 below.** |
| 3 | Is where this mechanism lives fixed, or open for this planning pass to decide? | Fixed by prior architecture convention; not a spec-level concern. | None — no technology or placement is named in this spec (see plan.md §1/§5). |
| 4 | How much detail should a malformed-request notice give the user? | Field-level detail: a message plus a structured list of which field(s) failed and why, in plain language — not a bare generic message, and not raw low-level validator output. | Added the `issues`/`issue.field`/`issue.problem` fields (§2), V1, V2, and AC2/AC3. |
| 5 | Should today's existing, operation-specific failure notices (e.g. a requested item not existing) be replaced by this new general mechanism, or continue exactly as before, with the general mechanism reserved for failures not already covered? | Continue exactly as before for now; the general mechanism only covers malformed requests and genuinely unforeseen failures. Fully unifying every failure notice under one mechanism is a deliberately named future improvement, not part of this feature. | Added an AC5 and an E2 qualifier at the time. **Superseded by decision #7 below** (there is no longer any general/unforeseen-failure mechanism for this to qualify). |
| 6 | Does one check evaluate one piece of the request at a time, or the whole request at once? | One piece of the request is evaluated per check. | None on user-visible behavior at the time — an internal mechanism detail. **Superseded by decision #8 below.** |
| 7 | Should this feature still introduce a shared/centralized way of turning any thrown failure into a response (per decision #2), or should it be scoped purely to reporting malformed input, directly from the same mechanism that checks it? | Scoped purely to malformed input: the same mechanism that checks the input is also what tells the user about a violation, directly — no separate shared failure-handling flow. | Removes the "unexpected failure" alternate flow, E2, and AC4/AC5 that decisions #2/#5 had added; supersedes decisions #2 and #5. |
| 8 | Should checking stay limited to one area of a request's input per check (per decision #6), or should one check cover several areas at once? | One check now covers several areas of a request's input at once, combined together. | Broadened V2 and AC3 to explicitly cover violations found across more than one area of input in a single response; supersedes decision #6. |
| 9 | Is this mechanism's internal code organization (how its logic is split across files/folders) a spec-level concern? | No — fixed by direct instruction; a pure implementation detail. | None on this spec (see plan.md §2/§3). |
