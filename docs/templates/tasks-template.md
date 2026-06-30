# Tasks — <Feature Name>

> **Plan area, step 4.** An ordered, test-first checklist. Each task is one
> red→green step: write the failing test, then make it pass. No task bundles
> multiple behaviors. See [docs/spec-driven.md](../../docs/spec-driven.md).

## Source plan

Link: `./plan.md`

## Tasks

1. [ ] **Domain entity** — failing unit test for `<Entity>` invariants → implement.
2. [ ] **Port + in-memory adapter** — define `<...>Repository` port; implement
       `InMemory<...>Repository`.
3. [ ] **Use case: <CreateX>** — failing unit test against in-memory repo → implement.
4. [ ] **Use case: <GetX>** — failing unit test → implement.
5. [ ] **Use case: <...>** — failing unit test → implement.
6. [ ] **HTTP boundary** — Zod schemas + controller/router; Supertest integration
       test (red → green).
7. [ ] **Wire into `app.ts`** — mount router; end-to-end Supertest passes.
8. [ ] *(Deferred)* Prisma adapter + DB-backed integration test.

## Verification

- [ ] Every acceptance criterion in `spec.md` maps to a passing test.
- [ ] `npm test`, `npm run lint`, `npm run typecheck` are all clean.
