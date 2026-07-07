---
name: boundaries-lint-cross-context
description: Exact eslint-plugin-boundaries config shape and the gap it leaves for a genuine cross-context (context-to-context) dependency, discovered planning 009-login
metadata:
  type: project
---

`.eslintrc.json`'s `boundaries/elements` declares exactly four element types:
`domain`, `application`, `infrastructure` (each pattern `src/logic/*/domain|
application|infrastructure`, folder mode, capturing `context`), and `shared`
(`src/logic/shared`). `boundaries/dependencies` `default: disallow`, with allow
rules that only ever permit a layer to import same-layer-or-inward **within
the same captured `context`** (or `shared`). There is **no rule permitting
context A's domain/application/infrastructure to import context B's** — as of
008-user-registration this was moot (`prompt` and `user` never referenced each
other). A `services.ts` file (e.g. `src/logic/user/services.ts`) sits directly
under `src/logic/<context>/` and matches **none** of the four patterns above,
so the plugin treats it as an unrecognized/unclassified element; combined with
`"boundaries/no-unknown": "off"`, importing a context's `services.ts` from
anywhere (including another context, or `src/handlers/**`) is **not**
restricted by this rule today. This is exactly why
`Handler -> services.ts -> UseCase` already works across the
`src/handlers/**` / `src/logic/<context>/**` split.

**Implication for the first true cross-context dependency (009-login, `auth`
reading `user`'s credentials):** the only lint-legal path today for
`auth`'s infrastructure to reach `user`'s data is through `user`'s
`services.ts` public surface (mirroring the Handler pattern) — not by
importing `user`'s domain port/entity or infrastructure adapter directly,
which the current rules block. Loosening `boundaries/dependencies` to add an
explicit `auth -> user` allowance is the alternative, but that edits a
shared/global lint config affecting every future context pair, not just this
one — a materially bigger footprint than routing through `services.ts`.

**Why:** this was undocumented until 009-login's planning surfaced it — no
prior spec exercised context-to-context data access, so the boundary rule's
"same context only" restriction had never been tested end to end.
**How to apply:** whenever a new feature's plan.md needs to describe a
cross-context read/write (bounded context §1 "Cross-context interactions"),
check this file first and default to routing through the target context's
`services.ts`-exposed use case rather than reaching into its domain/
infrastructure layers or editing the boundaries lint rules.
