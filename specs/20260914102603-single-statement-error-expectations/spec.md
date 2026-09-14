# Spec: Single-statement error expectations in tests
Status: READY TO IMPLEMENT
Story: As a developer maintaining this codebase, I want every test of a failing operation to state its expected failure as one complete expectation, so that a single readable step proves both the kind of failure and its wording, and the two can never drift apart.

## 1. Behavior

**Main flow.** A test that exercises an operation expected to fail states **one**
expectation describing the expected failure completely — the kind of failure *and* the
wording it carries, together, as a single expected value. The failing operation is
exercised once.

**Alternate flow — failures that were previously described in two steps.** Where a test
today states the kind of failure in one step and its wording in a second step, the two
collapse into the single expectation above. Because each step re-ran the failing
operation, the operation now runs once instead of twice; any follow-up expectation in the
same test about how many times a collaborator was consulted becomes correspondingly
stricter, and must still hold.

**Alternate flow — failures previously described only by kind.** Where a test today names
only the kind of failure and says nothing about its wording, the single expectation adds
the wording. This makes the test stricter than before; it must still hold.

**Alternate flow — failures that wrap an underlying cause.** A test that proves a failure
carries the *identical* underlying cause it was given keeps its existing shape. The
single-expectation form can only prove an *equivalent* cause, not the same one, so
converting such a test would weaken it.

**Throughout.** No behavior of the system under test changes. Every test that passed
before passes after, and the suite stays green.

## 2. Fields

None — this story changes how expectations are written, not any data the product handles.

## 3. Validation rules

- **V1.** Every failure expectation states the expected failure as one complete expected
  value carrying both the kind of failure and its wording. Naming the kind alone is
  invalid; stating the wording alone is invalid.
- **V2.** One expected failure is proven by exactly one expectation, and the failing
  operation is exercised exactly once for it. Two expectations describing one expected
  failure is invalid.
- **V3.** The wording in a failure expectation is the wording the failure itself produces,
  obtained from the failure's own definition. A wording spelled out independently in the
  test is invalid — the failure is the sole authority on its own wording.
- **V4.** Where a failure's wording incorporates identifying information (the identifier of
  a missing item, an email address already taken), the expectation supplies the very value
  the test arranged. Supplying an unrelated or re-generated value is invalid.
- **V5.** A failure that carries an underlying cause must still be proven to carry the
  *identical* cause it was given. An expectation that would accept a merely equivalent
  cause in its place is invalid.
- **V6.** V1–V4 apply to every failure expectation in the test suite, whether the operation
  fails immediately or only after it is awaited, and whether the failure is a business
  failure or a technical one.

## 4. Error responses

This story changes only how tests describe expected failures; it introduces no failure
that any end user of the product can reach. The one developer-facing failure it governs:

- **E1 — expectation not met.** When the kind or the wording of a failure diverges from
  what a test states, the suite reports a single failed expectation naming the complete
  expected failure alongside the complete actual one. It is distinguished from a
  never-failed operation, which the same expectation reports as "expected an operation to
  fail, but it did not".

## 5. Acceptance criteria

- **AC1.** Given a request to read a prompt that does not exist, When the read is
  exercised, Then one expectation proves the failure is a *prompt not found* failure whose
  wording names the requested identifier.
- **AC2.** Given a request to create a prompt naming a category that does not exist, and
  separately a request naming a creator that does not exist, When each is exercised, Then
  one expectation each proves the failure is a *category not found* / *creator not found*
  failure whose wording names the offending identifier, and the follow-up expectations
  that nothing was persisted and no further lookup happened still hold.
- **AC3.** Given a request to update a prompt that does not exist, a request whose category
  does not exist, and a request from someone who is not the prompt's owner, When each is
  exercised, Then one expectation each proves the failure is the *prompt not found* /
  *category not found* / *not the owner* failure whose wording names the offending
  identifier, and the follow-up expectations that nothing was looked up, persisted, or
  timestamped still hold.
- **AC4.** Given a request to delete a prompt that does not exist, and a request from
  someone who is not the prompt's owner, When each is exercised, Then one expectation each
  proves the failure is the *prompt not found* / *not the owner* failure whose wording
  names the offending identifier, and the follow-up expectation that nothing was deleted
  still holds.
- **AC5.** Given a registration whose email is already taken, and separately one whose
  password is too weak, When each is exercised, Then one expectation each proves the
  failure is the *email already in use* failure whose wording names that email / the
  *password too weak* failure with its wording, and the follow-up expectations that
  nothing was hashed, persisted, timestamped, or looked up still hold.
- **AC6.** Given a token that identifies no existing user, When it is validated, Then one
  expectation proves the failure is the *invalid token* failure with its wording.
- **AC7.** Given an expired token, a token signed with the wrong secret, an unreadable
  token, and a token carrying no subject, When each is verified, Then one expectation each
  proves the failure is the *token expired* / *invalid token* failure with its wording.
- **AC8.** Given a data store connection that has never been established, and separately
  one that has been released, When a connection is requested, Then one expectation each
  proves the failure is the *not connected* failure with its wording.
- **AC9.** Given the tests that prove a create or update failure wraps the underlying cause
  it was given, When the suite runs, Then those tests are unchanged and still prove the
  carried cause is the identical one supplied.
- **AC10.** Given the whole test suite, When it is run together with the project's linting
  and type checking, Then all three pass and no failure expectation anywhere states a kind
  without its wording or a wording without its kind.

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Three tests prove a wrapper failure carries its underlying cause, checking that the carried cause is the *identical* object supplied. Should those move to the single-expectation form too? | Leave them as-is. The single-expectation form can only match an equivalent cause, never the identical one, so converting would weaken the proof. | Added the "failures that wrap an underlying cause" alternate flow in §1, V5, and AC9, which pins those tests as explicitly unchanged. |
| 2 | Seven expectations today name only the kind of failure, with no wording at all. Converting them adds a wording check and makes them stricter. Include them? | Convert all of them — one uniform rule, no exceptions to remember, including the failure that surfaces immediately rather than after awaiting, and the technical (non-business) failure. | Added the "failures previously described only by kind" alternate flow in §1, V6, and AC3/AC4/AC5/AC6/AC7/AC8, which all include kind-only sites. |
| 3 | The project's testing guidance already states this rule. Should this story also add an automated guard so the two-step form cannot return? | No guard — the guidance already covers it; a mechanical rule would need bespoke matching for marginal benefit and risks false positives. | §1 and the criteria stay scoped to the tests themselves; AC10 verifies conformance by running the existing checks rather than by a new enforcement mechanism. |
