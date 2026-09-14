# Spec: Get a prompt by id
Status: IMPLEMENTED
Story: As an API consumer, I want to fetch a single prompt by its identifier so that I can read its full details without retrieving the whole collection.

## 1. Behavior
Main flow:
1. A consumer asks for a specific prompt, identified by its unique identifier, without providing any credentials.
2. When a prompt with that identifier exists, the consumer receives the prompt's full details: its identifier, title, prompt text, description, its category (identifier and name), its owner (identifier and name), and its creation and last-update instants.
3. The details returned are exactly the same set of details a consumer receives after creating or updating a prompt.

Alternate flows:
- If the prompt has no description, the description is reported as empty rather than omitted.
- If no prompt matches the given identifier, the consumer is told the prompt was not found and nothing else is returned.
- If the given identifier is malformed, the consumer is told the identifier is invalid.
- Reading a prompt is open to everyone: credentials are neither required nor consulted. Supplying credentials neither grants nor changes anything.
- The published API description lists this read operation among the prompt operations, declaring exactly the outcomes it can produce and marking it as needing no credentials.

## 2. Fields
Input:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | Unique identifier of the prompt to fetch | text (unique identifier) | Yes | — |

Returned details (unchanged from the create/update result):

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| id | The prompt's unique identifier | text (unique identifier) | Yes | — |
| title | The prompt's title | text | Yes | — |
| prompt | The prompt's text | text | Yes | — |
| description | Free-text description, empty when the prompt has none | text or empty | Yes | empty |
| category | The prompt's category: its identifier and name | record of (text, text) | Yes | — |
| user | The prompt's owner: their identifier and name | record of (text, text) | Yes | — |
| created_at | Instant the prompt was created | date | Yes | — |
| updated_at | Instant the prompt was last updated | date | Yes | — |

## 3. Validation rules
- **V1** — `id` must be a well-formed unique identifier. An identifier that does not match the expected identifier format is invalid.

## 4. Error responses
- **E1** — Prompt not found: the given identifier is well-formed but matches no existing prompt. The consumer is told the prompt was not found, naming the identifier. Distinguished from E2 by the identifier being valid in shape but absent.
- **E2** — Invalid identifier: the given identifier is malformed (fails V1). The consumer is told the identifier is invalid, naming the offending field. Distinguished from E1 by the failure being about the shape of the identifier, not its existence.

## 5. Acceptance criteria
- **AC1** — Given a prompt exists with a known identifier, When a consumer fetches it by that identifier **without supplying any credentials**, Then the prompt's full details are returned: identifier, title, prompt text, description, category (identifier and name), owner (identifier and name), and creation and last-update instants. (Covers §1 main flow, §2 returned details, the open-access flow.)
- **AC2** — Given a prompt that has no description, When a consumer fetches it by its identifier, Then the description is reported as empty rather than omitted. (Covers §1 empty-description flow, field `description`.)
- **AC3** — Given no prompt exists with a given well-formed identifier, When a consumer fetches by that identifier, Then a prompt-not-found error (E1) is returned. (Covers E1.)
- **AC4** — Given a malformed identifier, When a consumer fetches by that identifier, Then an invalid-identifier error (E2) is returned. (Covers V1, E2.)
- **AC5** — Given a prompt exists, When a consumer fetches it by its identifier, Then the returned details conform to the documented shape of a prompt result. (Covers §1 step 3, §2 returned details.)
- **AC6** — Given the running API, When the API description document is retrieved, Then it lists the read-a-prompt operation with exactly the outcomes it can produce — success, invalid identifier, prompt not found, and allowance exhausted — and without a credential requirement. (Covers §1 documentation flow.)

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | Should fetching a prompt by id require credentials? | Public — no credentials needed | §1 open-access flow; AC1 fetches without credentials; no unauthorized/forbidden error in §4; AC6 documents no credential requirement |
| 2 | Since the endpoint is public, its result would expose the owner's identifier and name to anyone holding a prompt identifier. Keep the same details as the create/update result? | Keep the full shape, owner included | §2 keeps the `user` field; §1 step 3 states the details are identical to the create/update result; AC5 pins that shape |
