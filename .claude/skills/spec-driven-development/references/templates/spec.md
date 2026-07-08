# Spec: <feature name>
Status:                        <!-- leave blank while drafting; set to READY TO IMPLEMENT when spec+plan+tasks are complete; IMPLEMENTED after code -->
Story: As a <user>, I want <X> so that <Y>.

<!--
WHAT, not HOW. A product person could approve this file.
HARD RULE: no technology anywhere — no frameworks, libraries, status codes, table
names, class names, file paths, or layer names. Errors in domain language
("duplicate email", not "409 Conflict").
-->

## 1. Behavior
Main flow first, then alternate flows, from the user's perspective.

## 2. Fields
| Field | Meaning | Domain type | Required | Default |
| ----- | ------- | ----------- | -------- | ------- |

<!-- Domain types only: text, number, date, boolean, choice of X/Y, list of Z. -->

## 3. Validation rules
Numbered V1, V2, … — field(s), constraint, and what "invalid" means. Precise enough to
become a test without interpretation.

## 4. Error responses
Numbered E1, E2, … — trigger condition, what the user is told, and how it is
distinguished from other errors.

## 5. Acceptance criteria
Numbered AC1, AC2, … in Given/When/Then form. Every V# and E# is covered by at least one
criterion. Each criterion is verifiable by a single automated test.

## 6. Decisions log
| # | Question asked | Answer | Effect on this spec |
| - | -------------- | ------ | ------------------- |
