---
name: gotchas
description: Non-obvious pitfalls and behaviors encountered while implementing ai-prompts-vault-api features
metadata:
  type: feedback
---

- Repeated `?category=` yields an **array** in Express; as of the
  `validateRequestMiddleware`, this now fails `z.string().optional()` (since
  an array isn't a string) and surfaces as a 400 with `field: 'query.category'`
  — this is the intended, spec'd behavior (a real E1 case), not a bug. Before
  that middleware existed, handlers had to take the first array value manually.
- `innerJoin` silently drops a prompt whose FK is orphaned — prevented by the
  NOT NULL + FK constraint, so it should never happen, but don't switch to a
  left join without a reason.
- `zod` was installed by feature 002 as the first HTTP-input dependency.
- Splitting a single cohesive Green implementation (given verbatim in plan.md)
  across multiple granular Red/Green tasks (e.g. tasks.md T1+T2, or T3+T4)
  means the second task's test can pass immediately once the first task's
  Green step is written — not a defect, just an artifact of task granularity
  vs. a plan that hands over one complete function/file at once. Note it as a
  minor deviation in the completion report rather than treating it as a
  blocking Red-step failure.
