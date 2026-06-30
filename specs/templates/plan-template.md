# Plan — <Feature Name>

> **Plan area, step 3.** HOW, mapped onto the architecture. No production code
> yet. See [docs/architecture.md](../../docs/architecture.md).

## Source spec

Link: `./spec.md`

## Bounded context

`src/logic/<context>/` — <new or existing?>

## Domain layer

- **Entities / value objects:** <e.g. `Prompt`, `PromptId`>
- **Invariants:** <rules the entity enforces>
- **Ports:** <e.g. `PromptRepository` with these methods>
- **Domain errors:** <e.g. `PromptNotFoundError`>

## Application layer

- **Use cases:** <e.g. `CreatePrompt`, `GetPrompt`, …>
- **Inputs/outputs per use case:** <brief>

## Infrastructure layer

- **HTTP:** routes + controllers
  - `POST /<resource>` → <use case>
  - `GET /<resource>/:id` → <use case>
- **Validation:** Zod schemas at the boundary
- **Persistence:** in-memory adapter now (`InMemory<...>Repository`); Prisma
  adapter deferred

## Edges / wiring

- What gets mounted in [`src/app.ts`](../../src/app.ts) and composed in
  [`src/index.ts`](../../src/index.ts).

## Open questions / risks

- <Anything unresolved that might send us back to the spec.>
