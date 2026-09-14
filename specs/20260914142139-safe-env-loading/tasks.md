# Tasks: Load and validate environment configuration safely
Plan: specs/20260914142139-safe-env-loading/plan.md

<!--
Loader tests (T1–T4) live in tests/integration/config/loadEnvFileIfExists.test.ts: each test
works in its own mkdtempSync(os.tmpdir()) directory removed in afterEach, and uses unique
variable names deleted from process.env in afterEach.
Parser tests (T5–T16) live in tests/unit/config/parseEnv.test.ts and build input with a
local buildEnv(overrides) helper (the three required keys + overrides).
Error assertions use one statement: expect(() => parseEnv(env)).toThrow(new InvalidEnvironmentError([...])).
-->

- [ ] T1. Loader: missing file is a no-op
  - Type: config
  - Depends on: none
  - Red: `loadEnvFileIfExists` — given a path inside an empty temp dir, calling it does not
    throw and leaves `process.env` without the probe variable. Fails: module does not exist.
  - Green: create `src/config/loadEnvFileIfExists.ts` with an `existsSync(filePath)` guard
    around `process.loadEnvFile(filePath)` (relative imports only, no `import.meta`).
  - Covers: AC1 "Given no local settings file exists, When the configuration is loaded, Then loading completes without failure and no setting is added to the environment."

- [ ] T2. Loader: existing file is loaded
  - Type: config
  - Depends on: T1
  - Red: write `SDD_ENV_PROBE=from_file` to a temp `.env`, call the loader, assert
    `process.env.SDD_ENV_PROBE === 'from_file'`. Fails if T1's Green didn't call
    `process.loadEnvFile` (write T1 Green minimally as a no-op if needed so this is red).
  - Green: ensure `process.loadEnvFile(filePath)` runs when the file exists.
  - Covers: AC2 "Given a local settings file exists, When the configuration is loaded, Then the settings it defines become available in the environment."

- [ ] T3. Loader: environment value wins over file value
  - Type: config
  - Depends on: T2
  - Red: set `process.env.SDD_ENV_PROBE = 'from_platform'`, file defines
    `SDD_ENV_PROBE=from_file`, call the loader, assert value is `'from_platform'`. Node's
    loader already has this behavior (verified on v24.16.0), so this may pass on first run —
    if so, confirm it goes red by temporarily assigning file values over `process.env`, then
    revert. It stays as a regression guard.
  - Green: none expected beyond T2 (rely on `process.loadEnvFile`; do not hand-parse).
  - Covers: AC3 "Given a setting is already provided by the environment and the local settings file defines the same setting with a different value, When the configuration is loaded, Then the environment's value is kept."

- [ ] T4. Loader: unreadable path propagates the read error
  - Type: config
  - Depends on: T2
  - Red: create a **directory** at the temp `.env` path, assert
    `expect(() => loadEnvFileIfExists(dirPath)).toThrow(expect.objectContaining({ code: 'EISDIR' }))`.
    May pass on first run — if so, confirm red by temporarily wrapping the load in a
    catch-all, then revert.
  - Green: no `try/catch` around `process.loadEnvFile`; only the `existsSync` guard.
  - Covers: AC4 "Given something exists at the local settings file's location but cannot be read as a file, When the configuration is loaded, Then loading fails with the reason it could not be read."; E2

- [ ] T5. Parser: required-only env yields defaults
  - Type: config
  - Depends on: none
  - Red: `parseEnv(buildEnv())` equals the full default `AppConfig` (environment
    `'development'`, port `3000`, database `{ host: 'localhost', port: 5432, user, password: '', database }`,
    jwtExpirationSeconds `3600`, rateLimit `{ windowMs: 900000, max: 100 }`, loginRateLimit
    `{ windowMs: 900000, max: 5 }`, trustProxyHops `0`, provided jwtSecret). Fails: module
    does not exist.
  - Green: create `src/config/env.schema.ts` (`EnvSchema` with all 14 keys in `.env.example`
    order, defaults, coercion) and `src/config/parseEnv.ts` (`parseEnv` + `AppConfig`,
    `safeParse` + camelCase mapping).
  - Covers: AC5 "Given only JWT_SECRET, DATABASE_USER and DATABASE_DB are provided, When the configuration is validated, Then it is accepted and every other setting takes its default value."; V1

- [ ] T6. Parser: full valid env is mapped with numbers as numbers
  - Type: config
  - Depends on: T5
  - Red: `parseEnv(buildEnv({ ...all 14 keys as strings, ENVIRONMENT: 'staging' }))` equals the
    matching `AppConfig` with numeric fields as `number`. Fails if any mapping/coercion is
    missing (e.g. `staging` not in the enum yet).
  - Green: complete enum (`development`/`staging`/`production`), coercions and mapping.
  - Covers: AC6 "Given every setting is provided with a valid value, including ENVIRONMENT set to staging, When the configuration is validated, Then it is accepted and each setting holds the provided value, with numeric settings held as numbers."; V3, V4, V5, V6

- [ ] T7. Parser: missing required settings are all reported
  - Type: config
  - Depends on: T5
  - Red: `expect(() => parseEnv({})).toThrow(new InvalidEnvironmentError(['DATABASE_USER', 'DATABASE_DB', 'JWT_SECRET']))`.
    Fails: error class does not exist / zod error thrown instead.
  - Green: create `src/config/InvalidEnvironmentError.ts` (message
    `Invalid environment variables: ${names.join(', ')}`, `name` set); in `parseEnv`, on
    failure collect issue `path[0]` names, dedupe, order by `Object.keys(EnvSchema.shape)`,
    throw.
  - Covers: AC7 "Given JWT_SECRET, DATABASE_USER and DATABASE_DB are all missing, When the configuration is validated, Then it is rejected and the report names all three settings."; V1, E1

- [ ] T8. Parser: empty optional value falls back to default
  - Type: config
  - Depends on: T5
  - Red: `parseEnv(buildEnv({ PORT: '' })).port === 3000`. Fails: `''` coerces to `0` →
    rejected.
  - Green: in `parseEnv`, drop entries whose value is `''` before `safeParse`.
  - Covers: AC8 "Given PORT is provided with an empty value, When the configuration is validated, Then it is accepted and PORT takes its default value."; V2

- [ ] T9. Parser: empty required value is rejected
  - Type: config
  - Depends on: T7, T8
  - Red: `expect(() => parseEnv(buildEnv({ JWT_SECRET: '' }))).toThrow(new InvalidEnvironmentError(['JWT_SECRET']))`.
    Should fail only if emptiness handling/required rules regress; confirm red by temporarily
    disabling the empty-stripping and `.min(1)`, then revert.
  - Green: `JWT_SECRET`, `DATABASE_USER`, `DATABASE_DB` as `z.string().min(1)` with no default.
  - Covers: AC9 "Given JWT_SECRET is provided with an empty value, When the configuration is validated, Then it is rejected and the report names JWT_SECRET."; V1, V2, E1

- [ ] T10. Parser: unknown ENVIRONMENT is rejected
  - Type: config
  - Depends on: T7
  - Red: `expect(() => parseEnv(buildEnv({ ENVIRONMENT: 'prod' }))).toThrow(new InvalidEnvironmentError(['ENVIRONMENT']))`.
  - Green: `ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development')`.
  - Covers: AC10 "Given ENVIRONMENT is provided as "prod", When the configuration is validated, Then it is rejected and the report names ENVIRONMENT."; V3, E1

- [ ] T11. Parser: invalid ports are rejected
  - Type: config
  - Depends on: T7
  - Red: `expect(() => parseEnv(buildEnv({ PORT: '65536', DATABASE_PORT: 'abc' }))).toThrow(new InvalidEnvironmentError(['PORT', 'DATABASE_PORT']))`.
  - Green: `PORT`/`DATABASE_PORT` as `z.coerce.number().int().min(1).max(65535).default(...)`.
  - Covers: AC11 "Given PORT is provided as "65536" and DATABASE_PORT as "abc", When the configuration is validated, Then it is rejected and the report names both PORT and DATABASE_PORT."; V4, E1

- [ ] T12. Parser: non-positive / fractional counters are rejected
  - Type: config
  - Depends on: T7
  - Red: `expect(() => parseEnv(buildEnv({ JWT_EXPIRATION_SECONDS: '1.5', RATE_LIMIT_MAX: '0' }))).toThrow(new InvalidEnvironmentError(['JWT_EXPIRATION_SECONDS', 'RATE_LIMIT_MAX']))`.
  - Green: the five V5 keys as `z.coerce.number().int().min(1).default(...)`.
  - Covers: AC12 "Given JWT_EXPIRATION_SECONDS is provided as "1.5" and RATE_LIMIT_MAX as "0", When the configuration is validated, Then it is rejected and the report names both JWT_EXPIRATION_SECONDS and RATE_LIMIT_MAX."; V5, E1

- [ ] T13. Parser: negative proxy hops are rejected
  - Type: config
  - Depends on: T7
  - Red: `expect(() => parseEnv(buildEnv({ TRUST_PROXY_HOPS: '-1' }))).toThrow(new InvalidEnvironmentError(['TRUST_PROXY_HOPS']))`.
  - Green: `TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0)`.
  - Covers: AC13 "Given TRUST_PROXY_HOPS is provided as "-1", When the configuration is validated, Then it is rejected and the report names TRUST_PROXY_HOPS."; V6, E1

- [ ] T14. Parser: report never contains the provided value
  - Type: config
  - Depends on: T10
  - Red: `expect(() => parseEnv(buildEnv({ ENVIRONMENT: 's3cr3t-value' }))).toThrow(new InvalidEnvironmentError(['ENVIRONMENT']))`
    — `toThrow(instance)` pins the exact message (`Invalid environment variables: ENVIRONMENT`),
    so any message that includes the provided value fails it. (Don't use
    `expect.not.stringContaining`: it is matched against the Error object, not its message, and
    passes vacuously.) Confirm red by temporarily appending the input to the message, then revert.
  - Green: message built from variable names only (T7).
  - Covers: AC14 "Given a setting is rejected, When the report is produced, Then the report contains the setting's name but not the value that was provided for it."; E1

- [ ] T15. Parser: unrelated variables are ignored
  - Type: config
  - Depends on: T5
  - Red: `parseEnv(buildEnv({ PATH: '/usr/bin', SOME_OTHER_VAR: 'x' }))` equals the same
    default `AppConfig` as T5 (no extra keys).
  - Green: map only declared keys from the parsed data (plain `z.object` strips unknowns).
  - Covers: AC15 "Given environment variables not listed in the settings are present alongside valid settings, When the configuration is validated, Then it is accepted and those variables are not part of the configuration."; V7

- [ ] T16. Parser: built configuration is frozen
  - Type: config
  - Depends on: T5
  - Red: for `const config = parseEnv(buildEnv())`, assert
    `expect(() => { (config as { port: number }).port = 1; }).toThrow(TypeError)` and the same
    for `config.database.host`. Fails: plain object is mutable.
  - Green: `Object.freeze` the result and each nested group (`database`, `rateLimit`,
    `loginRateLimit`); type `AppConfig` as `Readonly`.
  - Covers: AC16 "Given a valid configuration has been built, When anything attempts to change one of its settings, Then the change is refused and the settings keep their values."

- [ ] T17. Wire the app config
  - Type: config (composition)
  - Depends on: T1–T16
  - Red: none — `src/config/config.ts` becomes pure composition (one loader call + one parser
    call re-exported); see testing-practices. Proven by `npm run typecheck` and the full
    `npm test` suite (every integration test boots the app, rate limiters and DB pool on the
    frozen config — R2).
  - Green: replace `src/config/config.ts` body with
    `loadEnvFileIfExists(path.join(import.meta.dirname, '..', '..', '.env'));` and
    `export default parseEnv(process.env);`. No importer changes.
  - Covers: AC17 "Given the API is started, When its configuration is prepared, Then the local settings file is loaded only if it exists and the whole configuration is validated before the API accepts requests, refusing to start if it is rejected."; E1, E2

- [ ] T18. Wire the migrations config
  - Type: config (composition)
  - Depends on: T17
  - Red: none — `drizzle.config.ts` is pure composition (outside typecheck/lint, R5).
    Verified by running `npx drizzle-kit check` with a valid local `.env` (loads the config
    through drizzle-kit's CommonJS loader, no DB connection needed).
  - Green: in `drizzle.config.ts` replace `process.loadEnvFile()` and the `??` reads with
    `loadEnvFileIfExists('.env')`, `const config = parseEnv(process.env)`, and
    `dbCredentials: { ...config.database, ssl: false }` (relative imports
    `./src/config/loadEnvFileIfExists.js`, `./src/config/parseEnv.js`).
  - Covers: AC18 "Given database migrations are run, When their configuration is prepared, Then the local settings file is loaded only if it exists and the whole configuration is validated with the same rules as the API, refusing to run if it is rejected."; E1, E2

- [ ] T19. Update docs and `.env.example`
  - Type: docs
  - Depends on: T18
  - Red: none — documentation only.
  - Green: `CLAUDE.md` (project-structure `config.ts` line + Persistence bullet: env vars
    loaded from an optional `.env` and validated once by `EnvSchema`/`parseEnv`; the "no
    schema" wording refers to the Drizzle schema); `README.md` (`config.ts` line;
    note that migrations need the full env incl. `JWT_SECRET`); `.env.example` (comments
    marking `DATABASE_USER`, `DATABASE_DB`, `JWT_SECRET` as required and `ENVIRONMENT` as
    `development|staging|production`). If the local `.env` needs changes (R1), ask the user
    to edit it manually.
  - Covers: documentation of V1, V3 and decision #8 (no AC)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given no local settings file exists, When the configuration is loaded, Then loading completes without failure and no setting is added to the environment. | T1 |
| AC2 | Given a local settings file exists, When the configuration is loaded, Then the settings it defines become available in the environment. | T2 |
| AC3 | Given a setting is already provided by the environment and the local settings file defines the same setting with a different value, When the configuration is loaded, Then the environment's value is kept. | T3 |
| AC4 | Given something exists at the local settings file's location but cannot be read as a file, When the configuration is loaded, Then loading fails with the reason it could not be read. | T4 |
| AC5 | Given only JWT_SECRET, DATABASE_USER and DATABASE_DB are provided, When the configuration is validated, Then it is accepted and every other setting takes its default value. | T5 |
| AC6 | Given every setting is provided with a valid value, including ENVIRONMENT set to staging, When the configuration is validated, Then it is accepted and each setting holds the provided value, with numeric settings held as numbers. | T6 |
| AC7 | Given JWT_SECRET, DATABASE_USER and DATABASE_DB are all missing, When the configuration is validated, Then it is rejected and the report names all three settings. | T7 |
| AC8 | Given PORT is provided with an empty value, When the configuration is validated, Then it is accepted and PORT takes its default value. | T8 |
| AC9 | Given JWT_SECRET is provided with an empty value, When the configuration is validated, Then it is rejected and the report names JWT_SECRET. | T9 |
| AC10 | Given ENVIRONMENT is provided as "prod", When the configuration is validated, Then it is rejected and the report names ENVIRONMENT. | T10 |
| AC11 | Given PORT is provided as "65536" and DATABASE_PORT as "abc", When the configuration is validated, Then it is rejected and the report names both PORT and DATABASE_PORT. | T11 |
| AC12 | Given JWT_EXPIRATION_SECONDS is provided as "1.5" and RATE_LIMIT_MAX as "0", When the configuration is validated, Then it is rejected and the report names both JWT_EXPIRATION_SECONDS and RATE_LIMIT_MAX. | T12 |
| AC13 | Given TRUST_PROXY_HOPS is provided as "-1", When the configuration is validated, Then it is rejected and the report names TRUST_PROXY_HOPS. | T13 |
| AC14 | Given a setting is rejected, When the report is produced, Then the report contains the setting's name but not the value that was provided for it. | T14 (value absent), T10 (name present) |
| AC15 | Given environment variables not listed in the settings are present alongside valid settings, When the configuration is validated, Then it is accepted and those variables are not part of the configuration. | T15 |
| AC16 | Given a valid configuration has been built, When anything attempts to change one of its settings, Then the change is refused and the settings keep their values. | T16 |
| AC17 | Given the API is started, When its configuration is prepared, Then the local settings file is loaded only if it exists and the whole configuration is validated before the API accepts requests, refusing to start if it is rejected. | T17 |
| AC18 | Given database migrations are run, When their configuration is prepared, Then the local settings file is loaded only if it exists and the whole configuration is validated with the same rules as the API, refusing to run if it is rejected. | T18 |
