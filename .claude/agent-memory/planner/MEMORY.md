# Planner memory

Durable planning knowledge for ai-prompts-vault-api. Design/decision level
only (codepaths and concrete code patterns live in the implementer's memory).

- [Specs delivered so far](specs_delivered.md) — one-line summary of every spec (001-007) and its key design point
- [Domain model](domain_model.md) — the single `prompt` bounded context, `Prompt`/`PromptCategory` field shapes
- [List/read conventions](list_read_conventions.md) — defaults for GET features (empty-list, ordering, opaque filters)
- [Write operation conventions](write_operation_conventions.md) — defaults for create/update/delete (400-vs-404, existence-check ordering, no-body 204)
- [Naming precedents](naming_precedents.md) — file/class/table naming to reuse verbatim
- [Middleware infra](middleware_infra.md) — actual current shape of `src/middleware/validateRequest/` + design lessons
- [Open threads](open_threads.md) — unresolved/deferred design questions for future features
