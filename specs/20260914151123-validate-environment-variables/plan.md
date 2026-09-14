# Plan: Validate environment settings at startup
Spec: specs/20260914151123-validate-environment-variables/spec.md

## 1. Approach

Today `src/config/config.ts` calls `process.loadEnvFile(...)` unconditionally, which throws
on a missing `.env`. It then builds the config object from `process.env` with `??`
fallbacks and `Number(...)` casts. Nothing is validated: `JWT_SECRET` silently falls back
to `''`, `PORT` stays a `string | number`, and a typo such as `RATE_LIMIT_MAX=abc` becomes
`NaN`.

The change follows the `node-express-typescript` skill §2 ("Config — parse env once, at the
edge") and splits the work in two (decision 3):

1. **`src/config/env.ts` (new, pure, unit-tested).** Holds the user-supplied `EnvSchema`
   (Zod 4, verbatim from the request), its inferred `Env` output type, and two functions:
   - `parseEnv(env)`: runs `EnvSchema.safeParse(env)`. On success it returns the typed
     `Env`. On failure it throws `InvalidEnvironmentError` carrying `z.treeifyError(error)`
     (decision 2).
   - `loadEnvFileIfPresent(filePath)`: calls `process.loadEnvFile(filePath)` only when the
     file exists (decision 1).
2. **`src/config/config.ts` (existing, thin edge).** Calls `loadEnvFileIfPresent` on the
   same `.env` path as today, then `parseEnv(process.env)`. On `InvalidEnvironmentError` it
   prints the tree with `console.error` and calls `process.exit(1)`. Any other error is
   rethrown. On success it maps the typed `Env` onto the **exact same default-exported
   object shape** as today, so none of its consumers change: `src/app.ts`, `src/index.ts`,
   `src/routes/auth/auth.routes.ts`, `src/modules/auth/services.ts`,
   `src/modules/shared/services.ts`, and `tests/integration/loginRateLimitMiddleware.test.ts`.

`drizzle.config.ts` is left untouched (decision 4). The schema is kept exactly as written,
so a blank value is invalid rather than defaulted (decision 5).

The user's snippet had two defects, corrected here. It called `schema.safeParse`, which
should be `EnvSchema.safeParse`. It also used `parsed.error.format()`, which is deprecated
in Zod 4 and is replaced by `z.treeifyError` (decision 2).

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Env schema + parser + file loader | new | `src/config/env.ts` | `EnvSchema`, `type Env = z.output<typeof EnvSchema>`, `parseEnv(env)`, `loadEnvFileIfPresent(filePath)` |
| Invalid environment error | new | `src/config/InvalidEnvironmentError.ts` | `class InvalidEnvironmentError extends Error`: fixed message, explicit `name`, public `details` tree |
| App config | existing | `src/config/config.ts` | Replace the unconditional `loadEnvFile` and the `??`/`Number()` reads with `loadEnvFileIfPresent` + `parseEnv`; print and `process.exit(1)` on `InvalidEnvironmentError`; map `Env` → the same exported shape |
| Env unit tests | new | `tests/unit/config/env.test.ts` | Tests for `parseEnv` (AC1–AC9) and `loadEnvFileIfPresent` (AC10–AC11) |
| Config startup test | new | `tests/integration/config/config.test.ts` | Spawns the config module in a child process with an invalid setting (AC12) |
| Project docs | existing | `CLAUDE.md`, `README.md` | Add `env.ts` / `InvalidEnvironmentError.ts` to the `src/config/` structure listing and state that env is validated at boot |

## 3. Interfaces & contracts

```ts
// src/config/env.ts
export const EnvSchema = z.object({ /* verbatim from the request, see §5 */ });
export type Env = z.output<typeof EnvSchema>;
export function parseEnv(env: NodeJS.ProcessEnv): Env;           // throws InvalidEnvironmentError
export function loadEnvFileIfPresent(filePath: string): void;    // existsSync → process.loadEnvFile

// src/config/InvalidEnvironmentError.ts
export class InvalidEnvironmentError extends Error {
    constructor(public readonly details: ReturnType<typeof z.treeifyError<Env>>) {
        super('Invalid environment variables');
        this.name = 'InvalidEnvironmentError';
    }
}
```

`src/config/config.ts` keeps its default export and shape, with tighter types:

| Key | Source | Type before → after |
|--|--|--|
| `port` | `PORT` | `string \| number` → `number` |
| `environment` | `ENVIRONMENT` | `string` → `'development' \| 'test' \| 'production'` |
| `jwtSecret` | `JWT_SECRET` | `string` (unchanged) |
| `jwtExpirationSeconds` | `JWT_EXPIRATION_SECONDS` | `number` (unchanged) |
| `database.{host,port,user,password,database}` | `DATABASE_HOST/PORT/USER/PASSWORD/DB` | unchanged (`DatabaseConfig`, `src/modules/shared/domain/Database.ts`) |
| `rateLimit.{windowMs,max}` | `RATE_LIMIT_WINDOW_MS/MAX` | `number` (unchanged) |
| `loginRateLimit.{windowMs,max}` | `LOGIN_RATE_LIMIT_WINDOW_MS/MAX` | `number` (unchanged) |
| `trustProxyHops` | `TRUST_PROXY_HOPS` | `number` (unchanged) |

Startup failure output (`config.ts`):
`console.error('❌ Invalid environment variables:', JSON.stringify(error.details, null, 4))`
then `process.exit(1)`. A Zod 4 tree looks like
`{ "errors": [], "properties": { "JWT_SECRET": { "errors": ["Too small: expected string to have >=32 characters"] } } }`.
The messages carry the expectation, never the received value (verified against the
installed Zod).

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `InvalidEnvironmentError` (thrown by `parseEnv`, caught in `config.ts`) | stderr `❌ Invalid environment variables:` + the pretty-printed `z.treeifyError` tree naming every invalid variable with its messages; process exits with code `1` before `app.listen` |

## 4. Data & persistence

None. No table, column, or migration change.

## 5. Validation

All rules are enforced by `EnvSchema` in `src/config/env.ts`, applied through `parseEnv`:

```ts
ENVIRONMENT: z.enum(['development', 'test', 'production']).default('development'),
PORT: z.coerce.number().int().positive().default(3000),
JWT_SECRET: z.string().min(32),
JWT_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(3600),
DATABASE_HOST: z.string().default('localhost'),
DATABASE_PORT: z.coerce.number().int().positive().default(5432),
DATABASE_USER: z.string().min(1),
DATABASE_PASSWORD: z.string().default(''),
DATABASE_DB: z.string().min(1),
RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
```

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | `ENVIRONMENT` ∈ development/test/production | `z.enum([...]).default('development')` | → E1 |
| V2 | `JWT_SECRET` required, ≥ 32 chars | `z.string().min(32)` (no default) | → E1 |
| V3 | `DATABASE_USER`, `DATABASE_DB` required, ≥ 1 char | `z.string().min(1)` (no default) | → E1 |
| V4 | Numeric settings: positive whole numbers | `z.coerce.number().int().positive()`; `''` coerces to `0` and fails `positive()`, `'abc'` → `NaN` fails, `'1.5'` fails `int()` | → E1 |
| V5 | `TRUST_PROXY_HOPS`: whole number ≥ 0 | `z.coerce.number().int().nonnegative()` | → E1 |
| V6 | `DATABASE_HOST`, `DATABASE_PASSWORD`: any text incl. blank | `z.string().default(...)` | — |
| V7 | Absent optional → default; blank ≠ absent | Zod `.default()` applies only to `undefined` | — (blank falls to V1/V4/V5 checks) |

Keys outside the schema (the rest of `process.env`) are stripped by `z.object`'s default
behavior and never reach `Env` (spec §1 "settings outside the list").

## 6. Dependency changes

None. `zod` (`^4.4.3`) is already a runtime dependency. `node:fs` `existsSync` and
`process.loadEnvFile` are Node built-ins.

## 7. Assumptions & risks

Assumptions:
1. `process.loadEnvFile` does not override variables already present in `process.env`, the
   same precedence as `node --env-file` (spec §1 step 2). Verified during planning:
   with `SDD_PROBE=from_env` already set, loading a file containing `SDD_PROBE=from_file`
   leaves `from_env`. AC12's child process relies on this to inject an invalid value over
   a valid `.env`. Consequence if wrong (e.g. a future Node change): the T12 test must run
   with a `cwd`/env that has no `.env`.
2. The error lives in `src/config/InvalidEnvironmentError.ts` as a plain `Error` subclass,
   not a `DomainError`: config is a process-edge concern, not business logic (same shape as
   `DatabaseNotConnectedError`, `src/modules/shared/infrastructure/database/DatabaseNotConnectedError.ts`).
   Consequence if wrong: move the file; no behavior change.
3. `parseEnv` throws a dedicated error whose `details` is the tree, instead of returning the
   safe-parse result. That lets every failure test use the project's single-statement form
   `expect(() => parseEnv(env)).toThrow(new InvalidEnvironmentError(<tree>))`. Vitest's
   `isErrorEqual` compares `name`, `message` and enumerable own properties, so the kind, the
   wording and the per-variable reasons are proven together (convention from
   `specs/20260914102603-single-statement-error-expectations/plan.md`). Consequence if
   wrong: tests assert on a returned result instead.
4. The exact Zod message strings in each expected tree are taken from the installed Zod's
   output at Red time. The spec fixes *which* variables are reported, not the library's
   wording. Consequence if wrong: a Zod upgrade that rewords messages breaks those
   expectations, and they are updated with the upgrade.
5. `config.ts` itself has no unit test. Its edge behavior (print + exit) is proven by T13's
   child-process test, and its mapping is proven by `npm run typecheck` plus every existing
   integration suite that imports it. Consequence if wrong: add a focused test.
6. `console.error` needs no `eslint-disable` comment: `no-console` is not enabled in
   `.eslintrc.json`, and `src/middleware/errorMiddleware.ts:23` already calls
   `console.error` bare. Consequence if wrong: add the disable comment as `src/index.ts:8`
   does.
7. `.env.example` needs no change: its `JWT_SECRET` (`test-jwt-secret-for-local-development`,
   36 chars) and the rest of its values already pass `EnvSchema`.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | The developer's local `.env` (not readable by AI) has a `JWT_SECRET` shorter than 32 chars or a blank numeric value, so `npm run dev` / `npm test` fail at boot after the change | med | Local boot and test suite fail with E1 | Intended fail-fast behavior. The report names the variable. During T12 the user is asked to fix `.env` **manually** if it fails (README: AI cannot edit `.env`) |
| R2 | `loadEnvFileIfPresent` tests mutate `process.env` and leak a key into other tests in the same worker | low | Flaky tests | Use a unique key name, delete it and the temp file in `afterEach` |
| R3 | The child-process test is slow or depends on `tsx` resolution | low | Slower integration run | One spawn only, using `process.execPath` with `--import tsx` (tsx is already a dev dependency) |
| R4 | Tightening `port`/`environment` types breaks a consumer at compile time | low | typecheck fails | Only `app.listen(config.port)` reads `port` (accepts a number); `environment` has no consumers. `npm run typecheck` in T13 |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| All valid | every variable supplied validly | typed `Env`, numbers as numbers | AC1 |
| Only required | just `JWT_SECRET`, `DATABASE_USER`, `DATABASE_DB` | all defaults applied | AC2 |
| All required missing | `{}` | E1 naming `JWT_SECRET`, `DATABASE_USER`, `DATABASE_DB` together | AC3 |
| Short secret | `JWT_SECRET` of 31 chars | E1 naming `JWT_SECRET`, secret absent from details | AC4 |
| Bad numbers | `PORT='abc'`, `DATABASE_PORT='0'`, `RATE_LIMIT_MAX='1.5'`, `LOGIN_RATE_LIMIT_MAX=''` | E1 naming all four | AC5 |
| Zero hops | `TRUST_PROXY_HOPS='0'` | accepted as `0` | AC6 |
| Negative hops | `TRUST_PROXY_HOPS='-1'` | E1 naming `TRUST_PROXY_HOPS` | AC7 |
| Bad environment | `ENVIRONMENT='prod'` | E1 naming `ENVIRONMENT` | AC8 |
| Blank password | `DATABASE_PASSWORD=''` | accepted as `''` | AC9 |
| No `.env` file | path does not exist | no throw, `process.env` unchanged | AC10 |
| `.env` file present | temp file with a unique key | key present in `process.env` | AC11 |
| Invalid at boot | child process, `JWT_SECRET` too short | exit code 1, stderr names `JWT_SECRET`, not the value | AC12 |
| Blank host | `DATABASE_HOST=''` | accepted as `''` (V6) | none (same rule as AC9) |
| Blank environment | `ENVIRONMENT=''` | E1 (V1, V7) | none (same rule as AC8) |
| Unknown extra variable | e.g. `PATH`, `HOME` present | ignored, not in `Env` (`z.object` strips unknown keys by default) | none (library default; T12 boots with the full `process.env`) |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| §2 fields | §5 `EnvSchema`; §3 config key mapping table |
| V1 | §5 `z.enum` row |
| V2 | §5 `z.string().min(32)` row |
| V3 | §5 `z.string().min(1)` row |
| V4 | §5 `z.coerce.number().int().positive()` row |
| V5 | §5 `nonnegative()` row |
| V6 | §5 `z.string().default(...)` row |
| V7 | §5 Zod default semantics row; decision 5 |
| E1 | §3 `InvalidEnvironmentError` + E# table; §1 `config.ts` print + exit |
| §1 step 2 / "no local settings file" | §3 `loadEnvFileIfPresent`; §7 assumption 1 |
| §1 "database tooling" | §1 `drizzle.config.ts` untouched |
| AC1–AC9 | §3 `parseEnv`; §8 rows; `tests/unit/config/env.test.ts` |
| AC10–AC11 | §3 `loadEnvFileIfPresent`; `tests/unit/config/env.test.ts` |
| AC12 | §1 `config.ts` edge; `tests/integration/config/config.test.ts` |
