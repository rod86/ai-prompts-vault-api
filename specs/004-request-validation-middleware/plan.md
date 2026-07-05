# Plan: Request validation and consistent error responses

Spec: specs/004-request-validation-middleware/spec.md
Status: READY FOR REVIEW

## 1. Bounded context

No owning bounded context. This feature is cross-cutting HTTP-adapter
infrastructure, used identically by every context's handlers — it holds no
business logic and no context-specific knowledge. It lives directly under a
new top-level `src/middleware/` folder, sibling to `src/handlers/` (per
explicit user direction), not under `src/logic/**`.

Because `src/middleware/**` is outside `src/logic/**`, it is not one of the
`boundaries/elements` types the ESLint boundary plugin tracks (only
`src/logic/*/{domain,application,infrastructure}` and `src/logic/shared` are
covered, per `.eslintrc.json`) — exactly like `src/handlers/` already sits
outside those rules today.

Cross-context interaction: none. Every context's handlers use this
middleware identically.

## 2. Entities and value objects

No new domain entities in any bounded context — this feature adds no
business data.

**`RequestValidationIssue`** (new) — a plain value type, not an `Error`
subclass (per spec Decision #7: there is no throw/catch boundary in this
feature anymore, so no error class is needed): defined in
`src/middleware/validateRequest/validation.ts`

```ts
export interface RequestValidationIssue {
    field: string;
    problem: string;
}
```

- Not placed under any bounded context's `domain/errors/` (per
  `hexagonal-architecture`, that folder is for a context's own domain
  errors); this type belongs to the HTTP adapter layer itself.
- Satisfies spec §2 `issues`/`issue.field`/`issue.problem`, §4 E1, AC2/AC3.

## 3. Ports

No new domain ports — no business logic is orchestrated by this feature.
Instead, this feature introduces one middleware factory, split across two
files inside its own folder `src/middleware/validateRequest/` (per explicit
user direction — the folder itself drops the `Middleware` suffix; the file
and exported function that wrap Express keep it):

**`src/middleware/validateRequest/validation.ts`** (new) — pure types +
logic, no Express import, no I/O:

```ts
import { type ZodTypeAny } from 'zod';

export type RequestPart = 'body' | 'params' | 'query';

export interface RequestValidationIssue {
    field: string;
    problem: string;
}

export type RequestSchemas = Partial<Record<RequestPart, ZodTypeAny>>;

export type RequestValidationResult =
    | { valid: true; data: Partial<Record<RequestPart, unknown>> }
    | { valid: false; issues: RequestValidationIssue[] };

export function validateRequestParts(
    schemas: RequestSchemas,
    request: Partial<Record<RequestPart, unknown>>,
): RequestValidationResult {
    const data: Partial<Record<RequestPart, unknown>> = {};
    const issues: RequestValidationIssue[] = [];

    for (const [part, schema] of Object.entries(schemas) as [RequestPart, ZodTypeAny][]) {
        const result = schema.safeParse(request[part]);

        if (!result.success) {
            issues.push(
                ...result.error.issues.map((issue) => ({
                    field: [part, ...issue.path].join('.'),
                    problem: issue.message,
                })),
            );
            continue;
        }

        data[part] = result.data;
    }

    return issues.length > 0 ? { valid: false, issues } : { valid: true, data };
}
```

**`src/middleware/validateRequest/validateRequestMiddleware.ts`** (new) —
the thin Express-facing wrapper (the only file in this folder that imports
Express or the shared `Request` augmentation):

```ts
import { type NextFunction, type Request, type Response } from 'express';
import { type RequestSchemas, validateRequestParts } from '@src/middleware/validateRequest/validation.js';

export function validateRequestMiddleware(
    schemas: RequestSchemas,
): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
        const result = validateRequestParts(schemas, {
            body: req.body,
            params: req.params,
            query: req.query,
        });

        if (!result.valid) {
            res.status(400).json({ message: 'The request was invalid.', issues: result.issues });
            return;
        }

        req.validated = result.data;
        next();
    };
}
```

- One call validates any combination of `body`, `params`, and `query`
  together (spec Decision #8) — a route needing only one part passes a
  single-key object (e.g. `{ params: GetPromptParamsSchema }`); a route
  needing several passes several keys at once (e.g.
  `{ params: SomeParamsSchema, query: SomeQuerySchema }`), and every
  resulting issue across all parts is collected before responding (spec V2,
  AC3).
- `issue.field` is always prefixed with its part name (`params.id`,
  `query.category`, `body.title`, ...) so issues from different areas never
  collide when combined — see §9 Assumption 2.
- On failure: responds `res.status(400).json({ message, issues })` directly
  and returns — no `throw`, no separate error-handling middleware (spec
  Decision #7). On success: stores the parsed (typed) data under a new
  `req.validated` property (see §9 Assumption 1) and calls `next()`.
- Satisfies spec V1/V2 (full `issues` array across every part, not
  first-error-only), E1, AC1 (pass-through via `next()`), AC2, AC3.

There is no shared/global error-handling middleware in this feature (spec
Decision #7 reverses the earlier plan to add one): the validation
middleware is self-contained and responds on its own. No `errorMiddleware`
file exists, and nothing is registered as trailing global middleware in
`src/app.ts` for this feature.

## 4. Use cases

None. No business orchestration is introduced — this feature is entirely
HTTP-adapter infrastructure (middleware only; no application/domain layer
changes in any context).

## 5. Routes

No new routes. Existing routes gain a single `validateRequestMiddleware`
call each; `src/app.ts` gains no trailing global middleware for this
feature.

**Response shape** (spec §4 E1 mapped to a status code):

- E1 (malformed request) → `400`, body `{ message: string, issues: { field: string, problem: string }[] }`.

**Wiring in `src/app.ts`:**

```ts
app.get('/prompts/:id', validateRequestMiddleware({ params: GetPromptParamsSchema }), getPromptHandler);
app.get('/prompts', validateRequestMiddleware({ query: GetPromptsQuerySchema }), getPromptsHandler);
app.get('/categories', getCategoriesHandler); // no schema — unaffected, see §9 Assumption 4
// ... all other routes ...
```

- `GetPromptHandler.ts` and `GetPromptsHandler.ts` are updated to read
  `req.validated?.params` / `req.validated?.query` instead of calling
  `SomeSchema.parse(...)` themselves (satisfies the story's "replacing the
  current pattern where every handler calls a Zod schema's `.parse()`
  inline").
- `GetPromptHandler.ts`'s existing `try/catch` around
  `getPromptUseCase.invoke(...)` for `PromptNotFoundError` is left
  completely untouched (§9 Assumption 3).

## 6. Validation schemas

No new Zod schemas are introduced by this feature itself — it is the
generic mechanism that consumes whichever schema(s) a route already has
(`GetPromptParamsSchema`, `GetPromptsQuerySchema`) or that a future feature
defines, all still colocated under `src/handlers/schemas/` per existing
precedent. Every V# in spec §3 traces to `validateRequestParts`'s own logic
(§3 above), not to a specific schema's fields, since this feature has no
fields of its own to validate.

## 7. Persistence adapter

None. No schema, table, or migration changes.

## 8. Dependency changes

None. `zod` and `express` (v5) are already installed dependencies.

## 9. Assumptions and risks

**Assumptions**

1. Parsed request data is exposed to handlers via a new `req.validated.<part>`
   property (the Express `Request` type is augmented via TypeScript
   declaration merging: `validated?: Partial<Record<RequestPart, unknown>>`),
   rather than overwriting `req.body`/`req.params`/`req.query` directly.
   Handlers narrow the `unknown` to the exact shape their own schema
   guarantees (e.g. `req.validated?.params as { id: string }`). If wrong,
   only `validateRequestMiddleware`'s "store" step and each handler's read
   step change — no port/use-case/adapter impact.
2. `issue.field` is always prefixed with its part name (e.g. `params.id`),
   even when only one part is validated in a given call, so the shape is
   identical whether one or several parts are combined. If wrong, only the
   mapping step inside `validateRequestParts` changes.
3. Migrating `GetPromptHandler.ts` and `GetPromptsHandler.ts` off their
   inline `.parse()` calls onto `validateRequestMiddleware` is in scope for
   this feature (the story explicitly says "replacing the current
   pattern"), but this feature does not touch `GetPromptHandler.ts`'s
   existing local `try/catch` for `PromptNotFoundError`, and introduces no
   shared/global error-handling middleware at all (spec Decision #7) — any
   error other than a request-shape violation (including
   `PromptNotFoundError`, and any truly unexpected error) behaves exactly
   as it does today, uncaught by this feature. Centralizing that is
   explicitly out of scope, not merely deferred to "a future middleware" —
   there is no partial scaffolding for it in this feature.
4. `GetCategoriesHandler.ts` has no input to validate, so it is left
   unchanged — no schema, no `validateRequestMiddleware` call.

**Risks**

1. _(low likelihood, low impact)_ A future handler could still call a
   schema's `.parse()` inline instead of using the new middleware, silently
   reintroducing the old pattern — no lint rule enforces the new
   convention. Mitigation: code review against the `coding-style` skill;
   adding an enforcing lint rule is out of scope for this feature.
2. _(low likelihood, low impact)_ Combining several parts in one call means
   a single malformed request touching two areas of input (e.g. both an
   invalid `params` value and an invalid `query` value) now surfaces both
   issues in one response — a behavior change from "one issue set per
   part" to "one issue set per request" if a route were ever migrated from
   several separate calls to one combined call. Not a risk for the two
   routes this feature actually migrates (each uses only one part today),
   but worth flagging for future routes with multiple parts. Mitigation:
   this is the desired behavior per spec V2/AC3; no further action needed.

## 10. Edge cases

- The request part being validated is entirely absent (e.g. no query
  string at all) → handled like any other input against that route's
  schema (an all-optional schema simply parses to `{}`); not a special
  case of this mechanism.
- Multiple fields invalid at once within one area of input (e.g. two
  malformed query values) → single `400` response listing both issues
  together (AC3), never two separate notifications.
- Two different areas of input both invalid at once (e.g. a malformed
  `params` value and a malformed `query` value in the same request) →
  single `400` response listing issues from both, each prefixed by its
  part, in one combined list (AC3).
- A route with no schema configured for any part (e.g.
  `GetCategoriesHandler`, no params/query/body schema) →
  `validateRequestMiddleware` is simply never registered on that route;
  behavior is completely unaffected (no V#/E# applies), see §9 Assumption 4.
- Any error that is not a request-shape violation (e.g. `PromptNotFoundError`,
  a database failure, or any other unforeseen error) → completely outside
  this feature's scope; behaves exactly as it does today (§9 Assumption 3).
- A query parameter repeated more than once (e.g. `?category=a&category=b`)
  → Express represents it as an array, which fails a `z.string().optional()`
  schema like `GetPromptsQuerySchema`'s — a concrete way this mechanism's
  malformed-request path (E1) is exercised through a real, currently
  existing route (used in tasks.md T5).

## 11. Traceability

| Spec item | Plan element(s) |
| --------- | ---------------- |
| Behavior: main flow (valid input across every checked area proceeds) | §3 `validateRequestMiddleware` success branch (`next()`); AC1 |
| Behavior: malformed request | §2 `RequestValidationIssue`; §3 `validateRequestParts` failure branch; §5 `400` mapping; E1 |
| Field: message | §5 response body shape |
| Field: issues / issue.field / issue.problem | §2 `RequestValidationIssue`; §3 `validateRequestParts` mapping; §5 `400` body shape |
| V1 (each violation names field + reason) | §3 `validateRequestParts` failure branch; §5 `400` body shape |
| V2 (all violations reported together, across areas) | §3 `validateRequestParts` accumulating `issues` across every part in `schemas`, not first-failure-only |
| E1 | §2 `RequestValidationIssue`; §3 `validateRequestMiddleware`; §5 `400` |
| AC1 | §3 middleware success branch; §5 wiring (existing routes unaffected when input is valid) |
| AC2 | §2/§3/§5 (E1 path) |
| AC3 | §3 (`validateRequestParts` combining issues across parts) |
| Decision #7 (no shared error middleware; middleware responds directly) | §3 (no throw, direct `res.json`); §9 Assumption 3 |
| Decision #8 (combine several parts in one call) | §3 `RequestSchemas`/`validateRequestParts` signature |
| Decision #9 (fixed file/folder organization) | §1; §2/§3 file paths |
