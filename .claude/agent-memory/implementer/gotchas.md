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
  blocking Red-step failure. Seen repeatedly across features (e.g. 008's
  T3/T6/T7/T9/T10/T12-14 all passed immediately after an earlier task's Green
  step already implemented the full class/schema from plan.md).
- `npm install <pkg-with-native-binding>` (e.g. `bcrypt`) can silently skip its
  install/build script under this project's npm config (`npm warn
  allow-scripts ... have install scripts not yet covered by allowScripts`),
  leaving the package unusable (`require('bcrypt')` throws, no `build/`
  directory). Fix: `npm approve-scripts <pkg>` then `npm rebuild <pkg>`, and
  smoke-test with a one-off `node -e` require before writing the adapter that
  depends on it.
- **`.eslintrc.json`'s boundaries config only ever tested a `shared` with no
  internal layers** (`src/logic/shared/database/`, `src/logic/shared/services.ts`
  — no `domain`/`application`/`infrastructure` subfolders). The moment a
  feature puts files under `src/logic/shared/domain/**` or
  `src/logic/shared/infrastructure/**` (`009-login`, relocating
  `PasswordHasherInterface`/`BcryptPasswordHasher` into `shared`), those
  files get classified by the generic `src/logic/*/domain` /
  `src/logic/*/infrastructure` patterns (captured context `"shared"`) —
  which are declared *before* the folder-mode `shared` element in
  `boundaries/elements` — instead of the universal `shared` type, so the
  existing `boundaries/dependencies` rules (which only special-case `{ "to":
  { "type": "shared" } }`, not "type domain/infrastructure with context
  shared") reject every cross-context import of them, even though
  `hexagonal-architecture`'s rule ("shared usable by any layer/context") says
  they should be allowed. Fix applied: add `{ "to": { "type": ["domain",
  "application", "infrastructure"], "captured": { "context": "shared" } } }`
  as an extra allowed target to every `from` rule (`domain`, `application`,
  `infrastructure`, and `shared` itself) in `.eslintrc.json`'s
  `boundaries/dependencies`. Treated as a mechanical lint-config fix
  implementing an already-documented rule, not a scope-creep architecture
  change — but flag it explicitly in the completion report since it edits a
  config file plan.md didn't call out.
- A tasks.md-literal hardcoded fixture email can collide with an identical
  hardcoded email already used by an *existing* test file in another context
  (`009-login`'s `DrizzleUserCredentialsRepository.test.ts` and `008`'s
  `DrizzleUserRepository.test.ts` both hardcoded `'Ada.Fixture@Example.com'`)
  — since Vitest runs files in parallel and both insert into the same
  `users` table, this is an intermittent `23505 duplicate key` failure on the
  case-insensitive unique email index, not a deterministic one, so it may
  pass when the new test file is run alone and only fail under `npm test`'s
  full parallel run. Fix: never hardcode a literal fixture email verbatim
  from a plan/tasks example — always suffix it with `faker.string.uuid()` (as
  every other test file in this codebase already does) even when tasks.md's
  prose gives a literal example value.
- `jwt.verify(token, secret)` throws `TokenExpiredError` for any token whose
  `exp` claim is in the past relative to wall-clock "now" — a test built
  around a literal fixed `expiresAt` date (e.g. `new Date('2026-01-01...')`)
  goes stale once real time passes that date. Use `jwt.verify(token, secret,
  { ignoreExpiration: true })` when the test only cares about the decoded
  claim values (`sub`, `exp`), not about whether the token would currently be
  accepted.
