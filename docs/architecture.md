# Architecture

How the codebase is structured. This is the authoritative architecture guide
referenced by the [constitution](../specs/memory/constitution.md §5). Tests are
intentionally **not** covered here — see [`tests.md`](./tests.md).

---

## Overview

The project uses **hexagonal architecture (ports & adapters)**, organized by
**bounded context**. Each context is a self-contained slice of the domain with
its own three layers:

```
src/
  logic/
    <context>/            # e.g. prompt/  (created on demand, NOT up front)
      domain/             # business rules — framework-agnostic
      application/        # use cases — orchestrate the domain via ports
      infrastructure/     # adapters — Express, Prisma, Zod, external I/O
    shared/               # genuinely cross-context code only
  config/
    env.ts                # the only place env vars are read + validated
  app.ts                  # Express app: middleware + route wiring (no listen)
  index.ts                # composition root + server bootstrap
```

> Layers are created **on demand**. An empty `domain/application/infrastructure`
> trio is never scaffolded ahead of a feature that needs it.

---

## The Dependency Rule

Dependencies point **inward only**:

```
infrastructure  ──▶  application  ──▶  domain
     (adapters)        (use cases)      (rules)

shared  ◀── may be used by any layer
config  ◀── may be used by infrastructure / edges
```

- The **domain** imports nothing from `application`, `infrastructure`, or any
  framework.
- The **application** imports the domain (and ports), never `infrastructure`.
- The **infrastructure** implements the ports the inner layers declare.
- Nothing imports `infrastructure` from a more inner layer.

This rule is enforced automatically by `eslint-plugin-boundaries`
(see [`.eslintrc.json`](../.eslintrc.json)).

---

## Domain layer (`logic/<context>/domain`)

The heart. Pure business rules with **zero framework imports**.

Contains:

- **Entities** — objects with identity and invariants (e.g. `Prompt`). They
  protect their own validity; an invalid entity cannot be constructed.
- **Value objects** — immutable values defined by their attributes (e.g.
  `PromptId`).
- **Domain errors** — typed error classes (e.g. `PromptNotFoundError`).
- **Ports** — interfaces the inner layers depend on, implemented later by
  infrastructure (e.g. `PromptRepository`). Ports live with the domain because
  the domain owns the contract.

Rule of thumb: if it mentions HTTP, SQL, Express, or Prisma, it does **not**
belong here.

---

## Application layer (`logic/<context>/application`)

The use cases — one per meaningful operation (e.g. `CreatePrompt`,
`GetPrompt`, `ListPrompts`, `UpdatePrompt`, `DeletePrompt`).

- Each use case orchestrates domain objects and talks to the outside world
  **only through ports**.
- Coordinates flow and transactions; contains no framework code.
- Receives its dependencies (the port implementations) via the constructor /
  factory — it never news up an adapter itself.

---

## Infrastructure layer (`logic/<context>/infrastructure`)

The adapters — the **only** place frameworks appear.

- **Driven adapters (persistence):** repository implementations behind the
  domain ports (e.g. an in-memory `InMemoryPromptRepository` now; a
  `PrismaPromptRepository` later — no inner code changes when it lands).
- **Driving adapters (HTTP):** Express controllers and routers that translate
  HTTP ⇄ use-case calls.
- **Validation:** Zod schemas that parse requests at the boundary.
- **External integrations:** any third-party I/O.

---

## Shared (`src/logic/shared`)

Cross-context code **only** — things two or more contexts genuinely share (a
`Result` type, a base error, common value objects). Guidelines:

- If only one context uses it, it belongs to that context, not here.
- Keep it small and dependency-light. `shared` must not import from any context.
- When in doubt, leave it out — duplication is cheaper to fix than a wrong shared
  abstraction.

---

## The Edges

These wire everything together and are the only place composition happens:

- **`src/config/env.ts`** — reads and validates environment variables (via Zod)
  once. Nothing else touches `process.env`.
- **`src/app.ts`** — builds the Express app (middleware + route wiring) and
  returns it **without** calling `listen`, so tests can import it. Feature
  routers are mounted here.
- **`src/index.ts`** — the composition root: constructs adapters, injects them
  into use cases/routers, and starts the HTTP server.
