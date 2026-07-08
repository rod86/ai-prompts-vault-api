# Plan: <feature name>
Spec: specs/<YMDHMS>-<slug>/spec.md

<!--
HOW. Maps every spec element onto a concrete design. Stack-agnostic: describe the design
in terms of this project's actual structure and conventions — no assumed architecture.
Every spec item lands somewhere here; every plan item traces back to a spec item.
-->

## 1. Approach
The overall shape of the change in a few sentences: what gets built or modified and why
this approach. Reuse existing patterns and utilities before inventing new ones.

## 2. Components & modules
Modules/units to add or change. Mark each **existing** (with file path) or **new**, and
say what changes.

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |

## 3. Interfaces & contracts
Function/method/API signatures, request/response shapes, and data structures (as a short
list). Then map every **E#** from spec §4 to a concrete error and response:

| E# | Domain error | Response the user sees |
|--|--|--|
| <E1> | <ErrorType> | <what is returned / shown> |

## 4. Data & persistence
Storage changes *if applicable*. Write "none" if the feature touches no storage. Otherwise,
for each table added or changed, list its columns in a table, then note the migration,
its rollback, and any domain↔storage name mapping.

**Table**: <table_name>
| Column | Type | Nullable | Default | Constraints | Description |
|--|--|--|--|--|--|
| id | UUID | No | | Primary key | Surrogate identifier |
| <name> | <type> | Yes/No | <default or —> | PK / FK → other(col) / Unique / — | Meaning; traces to field or V# |

- Migration: <what the migration does>
- Rollback: <how to revert it>
- Mapping: <domain field ↔ column>, only where names differ

## 5. Validation
Where and how each rule is enforced. Every row traces to a **V#** in spec §3; "On failure"
names the resulting **E#** (or "—" if it is not an error path).

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| <V1> | <constraint> | <component / layer> | → <E#> or — |

## 6. Dependency changes
ONLY dependencies that change — never inventory ones merely used. Write "none" if nothing
changes. Otherwise list each as a row. Action is install, update, or uninstall; for an
update, give the Version as `from → to`.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| <name> | <version, or `from → to` for update> | install / update / uninstall | <one-line why> |

## 7. Assumptions & risks
Assumptions — numbered; trivial silent decisions only, each with the consequence if wrong:
1. <assumption> — consequence if wrong: <...>

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | <risk> | low/med/high | <impact> | <mitigation> |

## 8. Edge cases
Concrete inputs/states and expected behavior, each coverable by a test. "Covers" cites an
**AC#** where one exists, or "none" (an uncovered edge case may spawn a new test task).

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| <case> | <input or state> | <expected> | <AC#> or none |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |

<!-- Any spec item with no home is a defect. -->
