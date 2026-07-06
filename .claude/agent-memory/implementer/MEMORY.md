# Implementer memory

Durable codepaths and concrete implementation/test patterns for
ai-prompts-vault-api. Design rationale lives in the planner's memory; this file
is where things live and how they're built.

- [Codepaths](codepaths.md) — where entities, ports, use cases, adapters, handlers, middleware, wiring, and routes live; update/delete pattern precedents
- [Drizzle patterns](drizzle_patterns.md) — concrete schema/query conventions used in every adapter
- [Testing patterns](testing_patterns.md) — unit/integration fixture conventions, shared reference-data scoping, write-verification via raw select
- [Migrations](migrations.md) — drizzle-kit CLI usage, hand-authored seed rows
- [Gotchas](gotchas.md) — non-obvious pitfalls hit while implementing (Express array query params, innerJoin FK assumption, task-splitting artifacts)
