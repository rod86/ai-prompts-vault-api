# Plan: Load and validate environment configuration safely
Spec: specs/20260914142139-safe-env-loading/spec.md

## 1. Approach
Today `src/config/config.ts:4` calls `process.loadEnvFile(...)` unconditionally (throws
`ENOENT` when `.env` is absent, crashing at import), then reads `process.env.X ?? default`
field by field with no validation (`jwtSecret` falls back to `''`, `Number('abc')` → `NaN`).
`drizzle.config.ts:4` repeats the unconditional `process.loadEnvFile()` with its own
unchecked defaults. This contradicts the `node-express-typescript` skill §2 ("read
`process.env` in exactly one module, validate + coerce + freeze", "never default a secret
to `''`").

The change splits the job into two small, separately tested units plus two thin wiring
sites:

1. **`loadEnvFileIfExists(filePath)`** — loads the file with Node's built-in
   `process.loadEnvFile` only if `existsSync(filePath)`. A missing file is a no-op; any
   other failure (unreadable, a directory at that path) propagates (E2). Node's loader
   never overrides a variable already in `process.env` (verified on Node v24.16.0:
   platform value kept, file-only value added), which gives AC3 for free.
2. **`EnvSchema` + `parseEnv(env)`** — one zod object schema declaring **every** env var
   (decision #7). `parseEnv` drops empty-string entries (V2), `safeParse`s, and on failure
   throws `InvalidEnvironmentError` carrying only the offending **names** (E1, AC14). On
   success it maps the `SCREAMING_SNAKE` env keys onto the existing camelCase config shape
   and deep-freezes it (AC16).
3. **`src/config/config.ts`** becomes composition only:
   `loadEnvFileIfExists(<project root>/.env)` then `export default parseEnv(process.env)`.
   The exported shape is unchanged, so none of its importers (`src/index.ts`, `src/app.ts`,
   `src/routes/auth/auth.routes.ts`, `src/modules/shared/services.ts`,
   `src/modules/auth/services.ts`, `tests/lib/utils.ts`) change.
4. **`drizzle.config.ts`** reuses both units (decisions #5, #8): load `.env` if present,
   `parseEnv(process.env)` (whole schema), and feed `config.database` into `dbCredentials`.

Fail-fast mechanism: `parseEnv` throws; `config.ts` does not catch. An uncaught throw
during module evaluation terminates the process with a non-zero exit code before
`app.listen` (or before drizzle-kit connects), printing the error. This keeps `config.ts`
logic-free and `parseEnv` unit-testable (the skill's `process.exit(1)` snippet would be
intercepted by Vitest) while honouring the skill's rule "do NOT boot half-configured".

No new dependency: `zod` (^4.4.3) is already installed.

## 2. Components & modules
| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| Env-file loader | new | `src/config/loadEnvFileIfExists.ts` | `loadEnvFileIfExists(filePath: string): void` — `existsSync` guard around `process.loadEnvFile(filePath)` |
| Env schema | new | `src/config/env.schema.ts` | `EnvSchema` — zod object declaring all 14 settings with coercion, ranges, defaults |
| Env parser | new | `src/config/parseEnv.ts` | `parseEnv(env: NodeJS.ProcessEnv): AppConfig` + `AppConfig` type — strips empties, validates, maps to camelCase, deep-freezes |
| Invalid-env error | new | `src/config/InvalidEnvironmentError.ts` | `class InvalidEnvironmentError extends Error` — message built from offending variable names |
| App config | existing | `src/config/config.ts` | Replace unconditional load + per-field `??` reads with `loadEnvFileIfExists(...)` + `export default parseEnv(process.env)` |
| Migrations config | existing | `drizzle.config.ts` | Replace `process.loadEnvFile()` + `??` reads with `loadEnvFileIfExists('.env')` + `parseEnv(process.env).database` |
| Parser unit tests | new | `tests/unit/config/parseEnv.test.ts` | AC5–AC16 |
| Loader integration tests | new | `tests/integration/config/loadEnvFileIfExists.test.ts` | AC1–AC4 against a real temp directory |
| Docs | existing | `CLAUDE.md`, `README.md`, `.env.example` | Describe `config.ts` as validated env config; mark required vars and ENVIRONMENT's allowed values |

## 3. Interfaces & contracts
- `loadEnvFileIfExists(filePath: string): void`
- `EnvSchema` (zod object, key order follows `.env.example`): `ENVIRONMENT`, `PORT`,
  `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_DB`,
  `JWT_SECRET`, `JWT_EXPIRATION_SECONDS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`,
  `TRUST_PROXY_HOPS`, `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_MAX`.
- `parseEnv(env: NodeJS.ProcessEnv): AppConfig` — throws `InvalidEnvironmentError`.
- `AppConfig` (deep `Readonly`, same shape `config.ts` exports today, but `port` is now
  always a `number`):
  ```ts
  {
      port: number;
      environment: 'development' | 'staging' | 'production';
      jwtSecret: string;
      jwtExpirationSeconds: number;
      database: { host: string; port: number; user: string; password: string; database: string };
      rateLimit: { windowMs: number; max: number };
      loginRateLimit: { windowMs: number; max: number };
      trustProxyHops: number;
  }
  ```
  `database` stays structurally assignable to `DatabaseConfig`
  (`src/modules/shared/domain/Database.ts`).
- `new InvalidEnvironmentError(variableNames: string[])` → message
  `Invalid environment variables: <NAME>, <NAME>` (names in `EnvSchema` key order,
  deduplicated); `name = 'InvalidEnvironmentError'`.

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `InvalidEnvironmentError` thrown by `parseEnv`, uncaught during `config.ts` / `drizzle.config.ts` evaluation | Process exits non-zero before listening / migrating; stderr shows `InvalidEnvironmentError: Invalid environment variables: DATABASE_USER, JWT_SECRET` (names only, never values) |
| E2 | Node's native error from `process.loadEnvFile` (e.g. `EACCES`, `EISDIR`), propagated by `loadEnvFileIfExists` | Process exits non-zero; stderr shows the file-system error code and path |

## 4. Data & persistence
None. No table, column, or migration change (the migrations *config* changes, not the
schema).

## 5. Validation
| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | JWT_SECRET, DATABASE_USER, DATABASE_DB required, non-empty | `EnvSchema`: `z.string().min(1)`, no default | → E1 |
| V2 | Empty value ≡ not provided | `parseEnv`: drops entries whose value is `''` before `safeParse`, so defaults apply / required keys are missing (`DATABASE_PASSWORD` defaults to `''`) | → E1 for required keys; — otherwise |
| V3 | ENVIRONMENT ∈ development/staging/production | `EnvSchema`: `z.enum([...]).default('development')` | → E1 |
| V4 | PORT, DATABASE_PORT whole 1–65535 | `EnvSchema`: `z.coerce.number().int().min(1).max(65535).default(...)` | → E1 |
| V5 | JWT_EXPIRATION_SECONDS, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT_MAX whole ≥ 1 | `EnvSchema`: `z.coerce.number().int().min(1).default(...)` | → E1 |
| V6 | TRUST_PROXY_HOPS whole ≥ 0 | `EnvSchema`: `z.coerce.number().int().min(0).default(0)` | → E1 |
| V7 | Unlisted variables ignored | `EnvSchema` is a plain `z.object` (strips unknown keys); `parseEnv` maps only declared keys | — |

## 6. Dependency changes
none

## 7. Assumptions & risks
Assumptions:
1. No minimum length on JWT_SECRET (decision #3 was declined); "required" = present and
   non-empty — consequence if wrong: add `.min(n)` to `JWT_SECRET` in a follow-up spec.
2. Only the literal empty string counts as "empty" for V2; whitespace-only values are
   passed to validation as-is (so `PORT="  "` coerces to `0` and fails V4) — consequence
   if wrong: trim before the emptiness check.
3. The E1 report lists names only (no per-variable reason). zod 4's messages were checked
   and don't echo values, but names-only keeps the error message deterministic for the
   one-statement `toThrow(new InvalidEnvironmentError([...]))` assertion — consequence if
   wrong: extend the constructor to accept reasons.
4. Fail fast by throwing (uncaught at import) instead of `console.error` +
   `process.exit(1)` — consequence if wrong: wrap the `parseEnv` call in `config.ts` with a
   catch that logs and exits.
5. File names and placement: all new units live in `src/config/` (the one module allowed to
   read `process.env`); the schema file follows the repo's `*.schema.ts` naming — consequence
   if wrong: rename only.
6. New `src/config/*` modules use relative imports only (no `@src` alias, no
   `import.meta`), because `drizzle.config.ts` imports them through drizzle-kit's CommonJS
   loader — verified in a scratch probe: relative `./x.js` → `x.ts` resolves, but
   `import.meta.dirname` is `undefined` there. Hence the loader takes the path as a parameter,
   `config.ts` computes it from `import.meta.dirname` (as today), and `drizzle.config.ts`
   passes `'.env'` (cwd-relative, as today) — consequence if wrong: migrations crash at
   config load; caught by T18's verification.
7. `parseEnv` tests build their input with a local `buildEnv(overrides)` helper returning a
   plain object with the three required keys (like `ListPromptsUseCase.test.ts`'s local
   builder); no model factory, since this is not a domain type.
8. The loader is tested as **integration** (real filesystem under `os.tmpdir()`, cleaned in
   `afterEach`, unique variable names deleted from `process.env` in `afterEach`); the parser
   is a pure function → **unit**.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | The developer's local `.env` has an ENVIRONMENT outside development/staging/production or lacks a required key → `npm run dev` and **both** Vitest projects fail at import (unit tests reach `config.ts` via `tests/lib/config.ts` → `src/modules/shared/services.ts`) | med | local startup/test failure | E1 names the variable; T19 updates `.env.example`; the user edits `.env` manually (AI access to `.env` is blocked) |
| R2 | A library mutates the now-frozen config (`pg` `Pool` options, `express-rate-limit` options) → `TypeError` in strict mode | low | runtime failure | T17 runs the full integration suite, which boots the app, rate limiters and DB pool against the frozen object |
| R3 | drizzle-kit's loader can't evaluate the shared modules | low (probed) | `db:migrate` fails | Assumption 6; T18 runs `npx drizzle-kit check` as its verification |
| R4 | Migrations now also require JWT_SECRET in any pipeline that runs them | med | pipeline config change | Accepted by decision #8; documented in T19 |
| R5 | `drizzle.config.ts` is outside `tsconfig.json` `include` and ESLint `ignorePatterns` (`*.config.ts`), so typecheck/lint won't catch mistakes there | med | undetected error in migrations config | T18 verifies by actually loading it with drizzle-kit |

## 8. Edge cases
| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| No `.env` (server/container) | file absent | no-op, env unchanged | AC1 |
| `.env` present | file defines a new var | var available in `process.env` | AC2 |
| Platform var + `.env` var | both define the same key | platform value kept | AC3 |
| Path is a directory | `existsSync` true, not a readable file | native `EISDIR` error propagates | AC4 |
| Only required keys | three keys | all defaults, `DATABASE_PASSWORD === ''`, `TRUST_PROXY_HOPS === 0` | AC5 |
| Full valid env | all 14 keys, ENVIRONMENT=staging | provided values, numbers typed as numbers | AC6 |
| All required missing | `{}` | E1 naming DATABASE_USER, DATABASE_DB, JWT_SECRET | AC7 |
| Empty optional | `PORT=''` | port 3000 | AC8 |
| Empty required | `JWT_SECRET=''` | E1 naming JWT_SECRET | AC9 |
| Typo'd environment | `ENVIRONMENT='prod'` | E1 naming ENVIRONMENT | AC10 |
| Out-of-range / non-numeric port | `PORT='65536'`, `DATABASE_PORT='abc'` | E1 naming both | AC11 |
| Fractional / zero counters | `JWT_EXPIRATION_SECONDS='1.5'`, `RATE_LIMIT_MAX='0'` | E1 naming both | AC12 |
| Negative hops | `TRUST_PROXY_HOPS='-1'` | E1 naming TRUST_PROXY_HOPS | AC13 |
| Secret-looking invalid value | `ENVIRONMENT='s3cr3t-value'` | message contains `ENVIRONMENT`, not `s3cr3t-value` | AC14 |
| Unrelated vars | `PATH`, `HOME`, … | ignored, absent from config | AC15 |
| Mutation attempt | assign to `config.port` / `config.database.host` | config and nested groups frozen | AC16 |
| Built app path | `dist/config/config.js` | `import.meta.dirname/../../.env` still resolves to project root (unchanged from today) | AC17 |
| Whitespace-only value | `PORT='  '` | coerces to 0 → E1 (assumption 2) | none |

## 9. Traceability
| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| §2 fields (all 14) | §3 `EnvSchema` key list; §3 `AppConfig` mapping |
| V1 | §5 V1; `EnvSchema` required keys |
| V2 | §5 V2; `parseEnv` empty-stripping |
| V3 | §5 V3; `EnvSchema.ENVIRONMENT` |
| V4 | §5 V4 |
| V5 | §5 V5 |
| V6 | §5 V6 |
| V7 | §5 V7 |
| E1 | §3 E1 row; `InvalidEnvironmentError`; §1 fail-fast mechanism |
| E2 | §3 E2 row; `loadEnvFileIfExists` propagation |
| AC1–AC4 | `loadEnvFileIfExists`; §8 rows 1–4 |
| AC5–AC16 | `EnvSchema` + `parseEnv` + `InvalidEnvironmentError`; §8 rows 5–16 |
| AC17 | `src/config/config.ts` wiring; §1 item 3; R2 |
| AC18 | `drizzle.config.ts` wiring; §1 item 4; assumption 6; R3, R5 |
| Decisions #1–#8 | §1 approach; §7 assumptions 1, 6; R4 |
