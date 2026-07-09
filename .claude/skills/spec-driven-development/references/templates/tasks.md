# Tasks: <feature name>
Plan: specs/<YMDHMS>-<slug>/plan.md

<!--
Ordered, test-first checklist. Each task is exactly ONE red→green step: one failing test,
then the minimal code to pass it. Ordered dependency-first; no task depends on a later
one; migration and dependency-change tasks (from plan §4 and §6) come before the code
that needs them. One test per task — if a task needs two tests, split it.
Exception: a task wiring a logic-less file (composition root, pure re-export — see
testing-practices/domain-driven-design) has no test; write `Red: none — <file> is pure
composition/re-export; see testing-practices` and go straight to Green.
- Type: the layer the task lands in — migration | domain | application | infrastructure.
  domain and application are the business-logic layers. For a task outside these standard
  layers, use a short custom name (e.g. route handler, middleware). Reading the Type tags
  top to bottom should show dependency-first order.
- Depends on: earlier task IDs this one needs (or "none"). Must reference earlier tasks
  only — a reference to a later task is a forward-dependency defect.
-->

- [ ] T1. <short name>
  - Type: migration | domain | application | infrastructure | <custom, e.g. route handler>
  - Depends on: <earlier T# list, or "none">
  - Red: <exact test, what it asserts, expected failure>
  - Green: <minimal change: file(s)/module>
  - Covers: AC2 "<verbatim Given/When/Then text from spec §5>"; V#/E# IDs

- [ ] T2. <short name>
  - Type: …
  - Depends on: …
  - Red: …
  - Green: …
  - Covers: …

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |

<!--
Every AC# maps to at least one task, or spec.md must NOT be moved to READY TO IMPLEMENT.
Each AC# referenced above carries its full criterion text quoted verbatim from spec §5,
so the executor never has to open spec.md to know what a task proves.
-->
