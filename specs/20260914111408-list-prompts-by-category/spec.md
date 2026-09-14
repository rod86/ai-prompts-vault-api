# Spec: List prompts, optionally filtered by category
Status: IMPLEMENTED
Story: As an API consumer, I want to retrieve the collection of prompts and optionally narrow it to a single category so that I can browse the catalogue and find the prompts relevant to one topic without fetching them one by one.

## 1. Behavior

Main flow:
1. A consumer asks for the collection of prompts, without providing any credentials.
2. The consumer receives every existing prompt, each with the same full set of details a consumer receives when fetching a single prompt: its identifier, title, prompt text, description, its category (identifier and name), its owner (identifier and name), and its creation and last-update instants.
3. The prompts are ordered most-recently-created first; prompts created at the same instant are ordered by their identifier, ascending.

Alternate flows:
- The consumer may narrow the collection by supplying a category filter — the unique identifier of a category. Only prompts belonging to that category are returned, with the same details and the same ordering as the unfiltered collection.
- When the category filter is well-formed but matches no prompts — whether because no such category exists or because the category holds no prompts — the consumer receives an empty collection, not an error. The two situations are deliberately indistinguishable.
- When no prompts exist at all and no filter is supplied, the consumer receives an empty collection.
- When the supplied category filter is malformed, the consumer is told the filter value is invalid and no collection is returned.
- When a prompt has no description, its description is reported as empty rather than omitted — identical to how a single prompt reports it.
- Listing prompts is open to everyone: credentials are neither required nor consulted. Supplying credentials neither grants nor changes anything.
- The published API description lists this collection-read operation among the prompt operations, declaring exactly the outcomes it can produce and marking it as needing no credentials.

## 2. Fields

Input:

| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| category_id | Unique identifier of the category to narrow the collection to; when absent, every prompt is returned | text (unique identifier) | No | — (no filter) |

Returned: a list of prompts. Each entry carries exactly the details of a single prompt result, unchanged:

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

- **V1** — `category_id`, when supplied, must be a well-formed unique identifier. A value that does not match the expected identifier format is invalid. Omitting `category_id` entirely is always valid and means "no filter".
- **V2** — A well-formed `category_id` is never checked for existence. A filter naming a category that does not exist is a valid request that simply matches nothing.

## 4. Error responses

- **E1** — Invalid category filter: the supplied `category_id` is malformed (fails V1). The consumer is told the value is invalid, naming the offending field. This is the only error this operation can produce of its own accord; it is distinguished from an empty result by the request being rejected outright rather than answered with a collection.

## 5. Acceptance criteria

- **AC1** — Given prompts exist, When a consumer asks for the collection **without supplying any credentials** and without a filter, Then every one of those prompts is returned with its full details: identifier, title, prompt text, description, category (identifier and name), owner (identifier and name), and creation and last-update instants. (Covers §1 main flow steps 1–2, §2 returned fields, the open-access flow.)
- **AC2** — Given prompts created at different instants, When a consumer asks for the collection, Then they are returned most-recently-created first. (Covers §1 main flow step 3.)
- **AC3** — Given prompts belonging to more than one category, When a consumer asks for the collection narrowed to one category's identifier, Then only the prompts belonging to that category are returned. (Covers §1 filter flow, field `category_id`.)
- **AC4** — Given a well-formed category identifier that matches no prompts, When a consumer asks for the collection narrowed to it, Then an empty collection is returned rather than an error. (Covers V2, §1 empty-result flow.)
- **AC5** — Given a malformed category filter, When a consumer asks for the collection narrowed to it, Then an invalid-filter error (E1) is returned. (Covers V1, E1.)
- **AC6** — Given a prompt that has no description, When a consumer asks for the collection, Then that prompt's description is reported as empty rather than omitted. (Covers §1 empty-description flow, field `description`.)
- **AC7** — Given prompts exist, When a consumer asks for the collection, Then the returned collection conforms to the documented shape of a prompt list. (Covers §2 returned fields.)
- **AC8** — Given the running API, When the API description document is retrieved, Then it lists the list-prompts operation with its optional category filter and exactly the outcomes it can produce — success, invalid filter, and allowance exhausted — and without a credential requirement. (Covers §1 documentation flow.)

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| 1 | The collection-read operation does not currently exist — it was retired by an earlier clean-up — while the underlying capability already accepts an optional category filter. What should this spec cover? | Build the collection-read operation together with its filter | §1 specifies the whole operation, not only the filter; the story covers browsing plus narrowing |
| 2 | Should asking for the collection require credentials? | Public — no credentials needed | §1 open-access flow; AC1 asks without credentials; no unauthorized error in §4; AC8 documents no credential requirement |
| 3 | How should a malformed category filter be handled? | Reject it as an invalid value | V1 and E1; AC5 |
| 4 | What should a well-formed category filter that matches no existing category return? | An empty collection, not an error | V2; §1 states the "no such category" and "category with no prompts" cases are indistinguishable; AC4 |
| 5 | Should the returned collection leave room for page information later? | No — a plain list, matching the existing category collection | §2 returns a list with no surrounding page metadata; paging is out of scope and would be a separate spec |
