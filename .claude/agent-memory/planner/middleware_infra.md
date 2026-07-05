---
name: middleware-infra
description: Cross-cutting src/middleware/ request-validation infra — current actual shape (post-004 reorganization) plus lessons from designing it
metadata:
  type: project
---

**Current actual shape (verify against real files before reuse — 004's own
spec/plan.md are stale on this):**
- `src/middleware/` (sibling to `src/handlers/`) holds cross-cutting Express
  middleware — not owned by any bounded context, not under `src/logic/**`, so
  it falls outside the boundaries-plugin's tracked element types (only
  `src/logic/*/{domain,application,infrastructure}` + `src/logic/shared` are
  covered in `.eslintrc.json`).
- `src/middleware/validateRequest/validation.ts` exports `validate(data, schema)`
  and `RequestSchema = { body?, params?, query? }` (one `z.object(schema)`
  call combining all parts at once, not one `safeParse` per part); response
  field is `errors: { field, error }[]` (not `issues`/`problem`).
- `src/middleware/validateRequest/validateRequestMiddleware.ts` — the thin
  Express-facing wrapper; responds `res.status(400).json({ message, errors })`
  directly on failure (no throw), stores parsed data on `req.parsedRequest`
  (not `req.validated`).
- Route schemas live at `src/schemas/<Verb><Resource>Schema.ts` (e.g.
  `GetPromptSchema.ts`, `GetPromptsSchema.ts`, `CreatePromptSchema.ts`),
  default-exporting a plain object `satisfies RequestSchema` — **not**
  `src/handlers/schemas/` as 004's own plan.md still says.
- **Lesson:** always read the actual current files under
  `src/middleware/validateRequest/` and `src/schemas/` rather than trusting a
  past spec/plan's file paths/field names verbatim — this codebase already
  reorganized once after a spec/plan was marked READY FOR REVIEW.

**Design lessons from building this (still valid heuristics for future
cross-cutting infra):**
- Middleware files: one function per file, **named** export (not default,
  unlike handlers), suffixed `Middleware`. The **folder** holding a
  middleware's files does NOT need the `Middleware` suffix even though the
  file/export inside it does (e.g. `src/middleware/validateRequest/` holds
  `validateRequestMiddleware.ts`).
- A middleware needing more than one file gets its **own subfolder**, split
  as: one thin file importing Express types and doing only req/res/next
  wiring, one pure file with types + logic and zero framework imports
  (easier to unit-test without Express mocking).
- **No shared/global error-handling middleware exists in this codebase** — a
  user correction reversed an initial plan that added an `errorMiddleware`
  catching a thrown error class plus a generic 500 fallback. Validation now
  responds directly, synchronously, no throw. Lesson: don't assume a
  validation-rejection mechanism implies a thrown-error/catch-middleware
  architecture — "emit the response inline, in the same middleware" is an
  equally valid, simpler default.
- A user can override their own already-answered interview decisions in a
  later message, without a new interview round — treat as a direct
  instruction, apply it, and mark old spec.md Decisions-log entries
  "superseded by #N" rather than deleting them.
- `req.params` values are always plain strings (never malformed shape-wise
  through real HTTP); a **repeated query key** (`?x=a&x=b`) reliably becomes
  an array under any Express query-parser mode — a robust way to make a real
  HTTP request fail a `z.string()` schema for an end-to-end test.
- Storing parsed data for a handler: augment Express's `Request` type via
  declaration merging with a dedicated property instead of overwriting
  `req.body`/`req.params`/`req.query` directly (Express 5 makes some of those
  non-writable in some configs).
- Recurring interview-worthy axes for a "generic mechanism" feature
  (validation/error-handling/rate-limiting/auth): (1) how much failure detail
  leaks to the caller, (2) whether it fully replaces existing per-feature
  handling or is scoped to net-new cases (a scope cut is a legitimate
  low-risk default to offer), (3) the exact granularity of one "unit" of the
  mechanism (one schema per call vs. a combined shape).

**Why:** avoids re-deriving this mechanism's shape from a stale spec, and
keeps future cross-cutting-infra planning consistent with what the user has
already corrected toward once.
**How to apply:** cite these exact file paths/exports when a new route needs
validation; re-verify by reading the files if this memory is more than a few
specs old.
