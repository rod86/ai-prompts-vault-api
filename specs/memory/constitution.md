# Project Constitution — AI Prompt Vault API

> This is the governing document for the project. It is intentionally short: it
> states **what is non-negotiable** and points to the detailed guides in
> [`docs/`](../../docs). When in doubt, this constitution wins; the guides
> explain how to comply.

---

## 1. Project Overview

- **Name:** AI Prompt Vault API
- **Purpose:** A REST API to manage AI prompts (create, read, update, delete, and
  organize prompts used with AI models).
- **Current scope:** core Prompt CRUD.
- **Out of scope for now (deferred):** authentication, tags/full-text search,
  database setup (PostgreSQL + Prisma), Docker, CI, and generated API docs. These
  are future increments, not abandoned goals.

---

## 2. Core Principles (non-negotiable)

1. **TDD is mandatory.** No production code is written without a failing test
   first. The cycle is **red → green → refactor**.
2. **Hexagonal architecture, per bounded context.** The domain is
   framework-agnostic. Dependencies point inward. Express, Prisma, and any other
   framework live in `infrastructure` as adapters behind ports.
3. **Clean Code.** Small, single-responsibility functions; intention-revealing
   names; no infrastructure concepts leaking into the domain.
4. **Validation at the boundary.** All external input is validated with Zod in
   the HTTP layer before it reaches application logic. Parsed, typed data flows
   inward; raw input never does.
5. **Explicit errors.** Domain errors are typed classes and are mapped to HTTP
   status codes in exactly one place. Never throw raw strings; never swallow
   errors silently.
6. **Create structure on demand.** Do **not** scaffold empty
   `domain`/`application`/`infrastructure` folders. A layer or bounded context is
   created only when a feature actually needs it.

---

## 3. The SDD Flow (summary)

All work flows through Spec-Driven Development. There are two areas with a hard
boundary between them:

```
PLAN area  ──────────────────────────▶  IMPLEMENT area
user story → spec → plan → tasks   ─┊─   red → green → refactor → verify
        (no production code)              (TDD only, no new scope)
```

- **Plan area** produces documents only (`spec.md`, `plan.md`, `tasks.md`). No
  production code.
- **Implement area** writes code test-first, strictly following `tasks.md`. No
  new scope is introduced here — if scope changes, go back to the Plan area.

**Authoritative guide:** [`docs/spec-driven.md`](../../docs/spec-driven.md).

---

## 4. Technology Stack

| Concern        | Choice                              | Status                         |
| -------------- | ----------------------------------- | ------------------------------ |
| Runtime        | Node.js (>= 20), TypeScript         | active                         |
| HTTP framework | Express                             | active                         |
| Validation     | Zod (at the HTTP boundary)          | active                         |
| Testing        | Vitest (unit) + Supertest (HTTP)    | active                         |
| Persistence    | In-memory adapter                   | active (stand-in)              |
| Database       | PostgreSQL via Prisma               | **deferred** (target adapter)  |

Rationale: a strict, framework-agnostic core keeps the business rules testable
and lets the database be introduced later behind the existing repository port
without touching domain or application code.

---

## 5. Architecture Rules

- Code is organized by **bounded context** under `src/logic/<context>/`, each with
  `domain`, `application`, and `infrastructure` layers (created on demand).
- **Dependency direction is inward only:** `infrastructure → application →
  domain`. Nothing imports `infrastructure` inward. The domain imports no
  framework.
- `src/logic/shared/` holds **only** genuinely cross-context code.
- The edges — `src/config/env.ts`, `src/app.ts`, `src/index.ts` — wire everything
  together and are the only place composition happens.

**Authoritative guide:** [`docs/architecture.md`](../../docs/architecture.md).

---

## 6. Testing Strategy

Unit tests cover the domain and application layers against in-memory adapters;
integration tests cover HTTP behavior via Supertest. Tests are written first.

**Authoritative guide:** [`docs/tests.md`](../../docs/tests.md).

---

## 7. Coding Standards

TypeScript `strict`, no `any`, no non-null assertions, small clean functions,
domain-specific errors. Enforced by ESLint (including hexagonal boundary rules)
and Prettier.

**Authoritative guide:** [`docs/coding-style.md`](../../docs/coding-style.md).

---

## 8. Definition of Done

A change is done when:

- [ ] The relevant `spec.md` acceptance criteria each have a passing test.
- [ ] All tests pass (`npm test`).
- [ ] `npm run typecheck` and `npm run lint` are clean.
- [ ] Error/edge cases are covered, not just the happy path.
- [ ] Code complies with the four `docs/` guides.

---

## 9. Governance

This constitution supersedes any other practice or preference. Amendments are
made by editing this file **and** the relevant `docs/` guide in the same change,
with a short note on what changed and why.
