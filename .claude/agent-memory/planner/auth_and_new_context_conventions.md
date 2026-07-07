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

---

**Cross-context read pattern — REJECTED, then corrected (009-login):** the
first-drafted 009 plan had a new context (`auth`) reach `user`'s stored
credential through a purpose-built use case
(`VerifyUserCredentialsUseCase`) exposed from `user/services.ts`, wrapped by
an `auth`-side adapter. **The user explicitly rejected this** after
reviewing the plan: "remove all changes related to user context ...
Better duplicate interfaces and code adjusted to needs than weird imports or
big classes." Do not reuse the "owning context exposes a use case via
`services.ts`, consuming context wraps it" shape for a future cross-context
*read* — it was tried once and rejected in favor of the pattern below.

**Corrected shape (009, final):** when a new context needs data that
physically lives in another context's table, **duplicate** the read
entirely inside the new context — its own entity/value object (e.g. `auth`'s
`UserCredentials`, a deliberate subset-duplicate of `user`'s `User`), its own
port, its own Drizzle table definition pointing at the same physical table
name under a different exported variable name (e.g. `authUsers` for the
`users` table), and its own repository-style adapter with its own query
(mirroring any case-insensitivity or other matching logic from the owning
context's original query by hand, since there is no shared code to inherit
it from). This new duplicate schema is **not** added to `config.ts`'s
aggregated `database.schema` (used by `drizzle-kit` for migration diffing) —
it is a read-only, unmigrated convenience local to the new context. Known
accepted risk: no compiler/lint-enforced link between the duplicate and the
original — a future migration to the owning table must be manually mirrored.
**Only promote genuinely identical, non-domain-specific logic to `shared`**
(e.g. the bcrypt password-hasher wrapper, needed byte-for-byte the same way
by both contexts) — never the "read this context's row" or "issue this
context's token" concerns themselves, which stay duplicated per-context.
This reverses the previous ("owning context's `services.ts`") entry above;
see [[boundaries_lint_cross_context]] for why routing through `services.ts`
was considered at all (still lint-legal, just no longer the preferred shape
for a *read* — it remains how `Handler -> services.ts -> UseCase` works
within a single context).

**`PasswordHasherInterface`/`BcryptPasswordHasher` promoted to `shared`
(009, corrected):** relocated from `user/domain/interfaces/` +
`user/infrastructure/` to `shared/security/`, with `compare(password, hash):
Promise<boolean>` added alongside the original `hash()`. This is the one
piece of 009's logic that *is* shared (not duplicated) — bcrypt-wrapping is
identical whichever context calls it. `user`'s `RegisterUserUseCase` and
`auth`'s token/crypto adapter both take this shared port as a constructor
dependency, sourced from a single instance exported by
`shared/services.ts` (mirroring how `databaseClient` is already centralized
there).

**Generic-message auth-failure pattern (009, first `401` precedent, shape
still valid after the correction):** when a spec explicitly requires two
different failure causes (unknown identifier vs. wrong secret) to produce
one indistinguishable message (anti-enumeration intent), throw exactly one
domain error with a fixed, non-parameterized message
(`InvalidCredentialsError`, unlike `EmailAlreadyInUseError` which safely
echoes its input) from the single use case that owns the whole login flow —
no longer via an intermediate `undefined`-returning verifier use case in
another context (that shape was rejected along with the cross-context call
above); the "no match" and "wrong password" cases are now just two
early-return branches inside one `LoginUseCase`, both throwing the same
error. Also extend this "don't distinguish" intent to request validation
itself: don't add shape/non-blank checks beyond bare presence on the
credential fields. Known accepted gap: this doesn't achieve constant-time
comparison (the no-such-email path skips the password-verify call entirely)
— a timing side channel remains, logged as an open risk, not solved.

**JWT via `jsonwebtoken` (009, corrected):** HS256, payload `{ sub: userId,
exp: <unix seconds> }` — `exp` is set **explicitly** on the payload, never
via `jsonwebtoken`'s `expiresIn` option (the two are mutually exclusive to
the library, and the point of the correction was to stop leaving expiration
to an implicit string). The expiration instant is computed inside the
use case, not the JWT adapter and not the library: `expiresAt =
clock.now() + tokenExpirationSeconds`, where `clock` is an injected
`ClockInterface` (`shared/time/`, new in 009 — the only file allowed to call
`new Date()` for "the current moment" is its `SystemClock` implementation)
and `tokenExpirationSeconds` is sourced from a new `.env` var
(`JWT_EXPIRATION_SECONDS`, default `3600`) read once in `config.ts` and
passed via DI into the use case's constructor. Secret injected into the
infra adapter's constructor from `config.jwtSecret`
(`process.env.JWT_SECRET ?? ''`). No fail-fast validation exists for a
missing secret (matches this codebase's existing no-fail-fast convention for
every other env var) — logged as an accepted risk, not a gap unique to this
feature. **Takeaway for future features:** if a use case needs "the current
time" for anything beyond trivial internal bookkeeping, inject a Clock port
rather than calling `new Date()` inline — this was a specific, named
correction the user asked for here and is likely to be asked for again.
