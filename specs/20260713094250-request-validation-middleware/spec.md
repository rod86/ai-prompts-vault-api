# Spec: Request validation middleware
Status: IMPLEMENTED
Story: As an API developer, I want a reusable way to validate an endpoint's incoming request inputs (path parameters, query values, and body) against declared rules before the endpoint runs, so that endpoint logic only ever sees valid, normalized input and callers get a clear, consistent message when their request is malformed.

## 1. Behavior

Main flow (valid request):
1. An endpoint declares, in one place, the rules for whichever request parts it
   cares about — any of: path parameters, query values, request body.
2. When a request arrives, each declared part is checked against its rules
   *before* the endpoint's own logic runs.
3. When every declared part satisfies its rules, the checked and normalized
   values are made available to the endpoint as a single grouped result, and the
   endpoint logic runs.

Alternate flow (invalid request):
- If any declared part fails its rules, the request is rejected before the
  endpoint's logic runs. The caller is told the request failed validation, along
  with — per offending field — a human-readable reason. The endpoint logic never
  runs.

Alternate flow (unexpected failure):
- If handling a request raises an unexpected error (not a validation failure),
  the caller is told an internal error occurred, distinct from a validation
  failure.

Notes:
- An endpoint declares rules only for the parts it needs; undeclared parts are
  not part of the normalized result exposed to the endpoint.
- Rules for the specific fields of any given endpoint are defined by that
  endpoint, not by this feature. This feature provides the checking mechanism,
  the exposure of normalized input, and the failure reporting.

## 2. Data

Conceptual inputs and outputs of the mechanism (no specific field set — those
belong to each endpoint):

| Item | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |
| Declared rules | The rules an endpoint attaches to its path-parameter, query, and/or body parts | choice of any subset of {path parameters, query, body}, each with field rules | Yes (at least one part) | — |
| Path parameters | Named values taken from the request address | list of named values | No | — |
| Query values | Named values supplied alongside the request address | list of named values | No | — |
| Request body | The structured payload sent with the request | structured content | No | — |
| Normalized request | The checked and normalized inputs exposed to the endpoint, grouped by part, containing only the declared parts | structured content | Yes on success | — |
| Field reason | Per invalid field, a human-readable reason it failed | text | Yes on failure | — |

## 3. Validation rules

- **V1** — For each request part an endpoint declares rules for, that part's
  values must satisfy all of the declared rules. A request proceeds to the
  endpoint only if every declared part passes.
- **V2** — On success, the normalized request exposed to the endpoint contains
  exactly the declared parts (each holding its checked, normalized values) and no
  undeclared part.
- **V3** — On failure, the rejection identifies every field that failed, each
  paired with a human-readable reason, grouped under the request part it belongs
  to (path parameters / query / body). A part with no failing fields is omitted
  from the report.

## 4. Error responses

- **E1 — Request validation failed.** Trigger: one or more declared request parts
  fail their rules (V1). The caller is told the request failed validation, with
  the failing fields grouped by request part (each part → a map of field name →
  reason); parts with no failures are omitted. Distinguished from other failures
  by being labelled a request-validation failure and by carrying the grouped
  per-field reasons.
- **E2 — Unexpected internal failure.** Trigger: an error other than a validation
  failure occurs while handling the request. The caller is told a generic
  internal error occurred. Distinguished from E1 by its internal-error label and
  the absence of per-field reasons.

## 5. Acceptance criteria

- **AC1** — Given an endpoint declaring rules for one or more request parts, When
  a request satisfies every declared rule, Then the endpoint runs and receives a
  normalized request containing exactly the declared parts with their normalized
  values, and nothing for undeclared parts. *(covers V1, V2)*
- **AC2** — Given an endpoint declaring rules, When a request has invalid values
  in one or more declared parts, Then the request is rejected as a validation
  failure whose reasons name each invalid field with a human-readable reason
  grouped under its request part (path parameters / query / body), omitting parts
  with no failures, and the endpoint logic does not run. *(covers V1, V3, E1)*
- **AC3** — Given a request whose handling raises an unexpected, non-validation
  error, When it is processed, Then the caller is told a generic internal error
  occurred, distinct from a validation failure and without per-field reasons.
  *(covers E2)*

## 6. Decisions log

| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
| D1 | How should a route validate more than one request part? | One named schema per route composed of the parts (path params / query / body); the middleware takes the whole schema. | Shapes the mechanism: a single declared rule-set per endpoint (V1, AC1). |
| D2 | Where does the normalized/validated output land for the endpoint to read? | A single grouped result exposed to the endpoint (not written back over the original parts). | V2, AC1 — "normalized request" grouped by part. |
| D3 | On failure, what does the caller receive? | `error: RequestValidationError`, message "Request Validation data failed", and `details` as a flat `{ field: reason }` map keyed by the plain field name (no part prefix), one reason per field. | E1, V3, AC2. |
| D4 | How should an unexpected (non-validation) error be treated? | Treated as a generic internal failure, reported distinctly from a validation failure. | E2, AC3 — establishes the app's general failure branch. |
| D5 | Should request-body parsing be enabled so body rules work end to end? | Yes — enable body parsing now so declared body rules are effective on real requests. | Supports V1/AC1 for the body part (see plan for the concrete wiring). |
| D6 | Flat `{ field: reason }` map (collision-prone across parts) or grouped? | Group `details` by request part — `{ query?: {field:reason}, params?: {field:reason}, body?: {field:reason} }` — omitting any part with no failures. | Supersedes D3's flat map; revises E1, V3, AC2 and removes the leaf-name collision (plan R1). |
| D7 | Does the validator throw, or return a result? | The `validator` is pure — returns `{ success:true, data }` or `{ success:false, errors }` and never throws; the middleware throws `RequestValidationError` from a failed result. | Internal design only — no change to spec behavior; revises plan §1–§3, §5 and tasks T2–T5. |
