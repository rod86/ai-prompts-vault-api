---
name: auth-and-new-context-conventions
description: Conventions established by 008-user-registration — first non-prompt bounded context, password hashing, uniqueness-conflict status code
metadata:
  type: project
---

**New bounded context precedent:** `user` (`src/logic/user/`) is the second
bounded context ever created in this codebase (after `prompt`). A genuinely
new concept with no shared entities/invariants with existing contexts gets
its own context, folder-structured identically
(`domain/`, `application/`, `infrastructure/`, `services.ts`) — don't bolt an
unrelated concept onto an existing context just because only one exists so
far. See [[domain-model]] for the `prompt` context's shape to contrast
against.

**Password hashing:** bcrypt, 10 salt rounds (`bcrypt` + `@types/bcrypt`
installed in 008 — first non-web-framework runtime dependency added since
initial scaffolding). Modeled as a `PasswordHasherInterface` domain port
(`hash(password): Promise<string>` only — no `compare()`/`verify()` yet,
since registration never needs to check a password against a stored hash),
implemented by `BcryptPasswordHasher` in `<context>/infrastructure/`, the
only file allowed to import `bcrypt` directly. A future login feature will
need to add `compare()` to this same port — treat that as a live open
question (see [[open-threads]]), not a settled shape, since it's unwritten.

**Case-insensitive uniqueness pattern (new, first instance):** when a field
(e.g. email) must be unique ignoring letter case, but the original case must
be preserved in storage/responses:
- App-level check: repository `findByEmail`-style method compares via
  `sql`lower(col) = lower(${value})``, returns `T | undefined` (never a
  thrown error at the port level, mirroring the existing `findById` absence
  pattern).
- DB-level backstop: a functional unique index on `lower(column)` (Drizzle:
  `uniqueIndex(...).on(sql`lower(${table.column})`)`), added as
  defense-in-depth against the check-then-insert race — the app-level check
  alone has a TOCTOU gap between two concurrent requests.
- Known gap left open in 008: a unique-index violation surfacing from that
  race is not translated into the domain error/409 at the HTTP layer — it
  would raise as an unmapped 500. Deliberately accepted as low-likelihood/
  low-impact; not yet a solved pattern in this codebase.

**First `409 Conflict` domain error:** `EmailAlreadyInUseError` (008) is the
first "value already exists" domain error in this codebase, distinguished
from [[write-operation-conventions]]'s existing "referenced-by-id doesn't
exist" 400 pattern (`CategoryNotFoundError`). The shapes are opposite
(missing vs. duplicate), so they get different status codes: 400 for a body
field referencing something absent, 409 for a body field colliding with
something that already exists. Reuse 409 for the next "already exists"
check rather than defaulting back to 400.

**Blank-string validation for a required text field:** a plain Zod
`.min(1)` only rejects an empty string, not whitespace-only input. Spec
language like "missing or blank" needs an explicit
`.refine((value) => value.trim().length > 0, { error: '...' })` in addition
to (or instead of) `.min(1)`.

**Why:** these are all first-instance decisions (new context, new external
dependency, new uniqueness pattern, new conflict-status precedent) that the
next feature touching auth, uniqueness, or a second new context should reuse
rather than re-deriving from scratch.
**How to apply:** cite this file when planning any feature that (a) adds a
new bounded context, (b) touches credentials/hashing, or (c) needs a
case-insensitive-unique-but-case-preserved field.
