# Tasks: Validate environment settings at startup
Plan: specs/20260914151123-validate-environment-variables/plan.md

There is no migration, dependency, domain, or application task. The change sits entirely in
the config edge (`src/config/`), outside the bounded contexts (plan §1).

T1–T11 live in the new `tests/unit/config/env.test.ts`, mirroring `src/config/env.ts`.
Declare two file-scope `const`s at the top:
- `validEnv`: every variable in spec §2 with a valid, distinct, non-default string value
  (for example `PORT: '8080'`, `ENVIRONMENT: 'production'`, a 40-char `JWT_SECRET`).
- `requiredEnv`: only `JWT_SECRET`, `DATABASE_USER`, `DATABASE_DB`.

Every failure test uses the project's single-statement form
`expect(() => parseEnv(input)).toThrow(new InvalidEnvironmentError(<exact tree>))`
(plan §7 assumption 3). The expected trees quote the installed Zod 4 messages, which
were confirmed against it during planning (plan §7 assumption 4). If a message differs
at Red, copy the library's actual wording into the expectation. Never loosen it to a
class-only or substring check.

- [x] T1. A fully valid environment is returned typed
  - Type: config
  - Depends on: none
  - Red: `expect(parseEnv(validEnv)).toEqual({ ...every key with its coerced value })`. Numbers are numbers (`PORT: 8080`, `TRUST_PROXY_HOPS: 2`, …), strings are strings, `ENVIRONMENT: 'production'`. Fails now: `@src/config/env.js` does not exist.
  - Green: create `src/config/env.ts` exporting `EnvSchema` (verbatim from plan §5), `type Env = z.output<typeof EnvSchema>`, and `parseEnv(env: NodeJS.ProcessEnv): Env`, which returns `EnvSchema.parse(env)` for now.
  - Covers: AC1 "Given every setting in §2 is supplied with a valid value, When the settings are checked, Then each value is returned converted to its domain type: numbers as numbers and the environment as its choice."; §2 fields

- [ ] T2. Absent optional settings take their defaults
  - Type: config
  - Depends on: T1
  - Red: `expect(parseEnv(requiredEnv)).toEqual({ ...requiredEnv, ENVIRONMENT: 'development', PORT: 3000, JWT_EXPIRATION_SECONDS: 3600, DATABASE_HOST: 'localhost', DATABASE_PORT: 5432, DATABASE_PASSWORD: '', RATE_LIMIT_WINDOW_MS: 900000, RATE_LIMIT_MAX: 100, LOGIN_RATE_LIMIT_WINDOW_MS: 900000, LOGIN_RATE_LIMIT_MAX: 5, TRUST_PROXY_HOPS: 0 })`.
  - Green: none expected. The `.default(...)` calls from T1 already produce this.
  - Covers: AC2 "Given only the required settings are supplied, When the settings are checked, Then every optional setting takes its default from §2."; V7

- [ ] T3. Missing required settings are all reported together
  - Type: config
  - Depends on: T1
  - Red: `expect(() => parseEnv({})).toThrow(new InvalidEnvironmentError({ errors: [], properties: { JWT_SECRET: { errors: ['Invalid input: expected string, received undefined'] }, DATABASE_USER: { errors: ['Invalid input: expected string, received undefined'] }, DATABASE_DB: { errors: ['Invalid input: expected string, received undefined'] } } }))`. Fails now: `InvalidEnvironmentError` does not exist, and `parseEnv` throws a raw `ZodError`.
  - Green: create `src/config/InvalidEnvironmentError.ts` (plan §3: `extends Error`, message `'Invalid environment variables'`, `this.name = 'InvalidEnvironmentError'`, `public readonly details`). Change `parseEnv` to `EnvSchema.safeParse(env)`: return `result.data` on success, otherwise `throw new InvalidEnvironmentError(z.treeifyError(result.error))`.
  - Covers: AC3 "Given `JWT_SECRET`, `DATABASE_USER`, and `DATABASE_DB` are all absent, When the settings are checked, Then an invalid-settings error (E1) is raised that names all three settings together, each with its reason."; V2, V3, E1

- [ ] T4. A too-short secret is rejected without echoing it
  - Type: config
  - Depends on: T3
  - Red: `expect(() => parseEnv({ ...validEnv, JWT_SECRET: 'a'.repeat(31) })).toThrow(new InvalidEnvironmentError({ errors: [], properties: { JWT_SECRET: { errors: ['Too small: expected string to have >=32 characters'] } } }))`. The exact-tree equality proves that no other text, including the secret, is in the details.
  - Green: none expected. `z.string().min(32)` from T1 plus T3's error.
  - Covers: AC4 "Given a `JWT_SECRET` shorter than 32 characters, When the settings are checked, Then an invalid-settings error (E1) is raised naming `JWT_SECRET` with its reason and without the supplied secret."; V2, E1

- [ ] T5. Non-numeric, zero, fractional, and blank numbers are rejected
  - Type: config
  - Depends on: T3
  - Red: `expect(() => parseEnv({ ...validEnv, PORT: 'abc', DATABASE_PORT: '0', RATE_LIMIT_MAX: '1.5', LOGIN_RATE_LIMIT_MAX: '' })).toThrow(new InvalidEnvironmentError({ errors: [], properties: { PORT: { errors: ['Invalid input: expected number, received NaN'] }, DATABASE_PORT: { errors: ['Too small: expected number to be >0'] }, RATE_LIMIT_MAX: { errors: ['Invalid input: expected int, received number'] }, LOGIN_RATE_LIMIT_MAX: { errors: ['Too small: expected number to be >0'] } } }))`.
  - Green: none expected. `z.coerce.number().int().positive()` from T1.
  - Covers: AC5 "Given numeric settings that are non-numeric, zero, fractional, and blank, When the settings are checked, Then an invalid-settings error (E1) is raised naming each of those settings with its reason."; V4, V7, E1

- [ ] T6. Zero trusted proxy hops is accepted
  - Type: config
  - Depends on: T1
  - Red: `expect(parseEnv({ ...validEnv, TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS).toBe(0)`.
  - Green: none expected. `nonnegative()` from T1.
  - Covers: AC6 "Given `TRUST_PROXY_HOPS` is `0`, When the settings are checked, Then it is accepted as the number zero."; V5

- [ ] T7. Negative trusted proxy hops are rejected
  - Type: config
  - Depends on: T3
  - Red: `expect(() => parseEnv({ ...validEnv, TRUST_PROXY_HOPS: '-1' })).toThrow(new InvalidEnvironmentError({ errors: [], properties: { TRUST_PROXY_HOPS: { errors: ['Too small: expected number to be >=0'] } } }))`.
  - Green: none expected.
  - Covers: AC7 "Given a negative `TRUST_PROXY_HOPS`, When the settings are checked, Then an invalid-settings error (E1) is raised naming `TRUST_PROXY_HOPS` with its reason."; V5, E1

- [ ] T8. An unknown environment choice is rejected
  - Type: config
  - Depends on: T3
  - Red: `expect(() => parseEnv({ ...validEnv, ENVIRONMENT: 'prod' })).toThrow(new InvalidEnvironmentError({ errors: [], properties: { ENVIRONMENT: { errors: ['Invalid option: expected one of "development"|"test"|"production"'] } } }))`.
  - Green: none expected. `z.enum([...])` from T1.
  - Covers: AC8 "Given an `ENVIRONMENT` that is not one of development, test, or production, When the settings are checked, Then an invalid-settings error (E1) is raised naming `ENVIRONMENT` with its reason."; V1, E1

- [ ] T9. A blank database password is accepted
  - Type: config
  - Depends on: T1
  - Red: `expect(parseEnv({ ...validEnv, DATABASE_PASSWORD: '' }).DATABASE_PASSWORD).toBe('')`.
  - Green: none expected. `z.string().default('')` from T1.
  - Covers: AC9 "Given `DATABASE_PASSWORD` is supplied blank, When the settings are checked, Then it is accepted as empty text."; V6

- [ ] T10. A missing settings file is skipped silently
  - Type: config
  - Depends on: none
  - Red: in a new `describe('loadEnvFileIfPresent')`, build a path under `os.tmpdir()` that does not exist (unique name via `faker.string.uuid()`), and assert `expect(() => loadEnvFileIfPresent(missingPath)).not.toThrow()`. Fails now: `loadEnvFileIfPresent` is not exported.
  - Green: add `loadEnvFileIfPresent(filePath: string): void` to `src/config/env.ts`: `if (existsSync(filePath)) { process.loadEnvFile(filePath); }`.
  - Covers: AC10 "Given no local settings file exists, When the service loads its settings file, Then no error is raised and the environment is left unchanged."

- [ ] T11. A present settings file is loaded into the environment
  - Type: config
  - Depends on: T10
  - Red: in `beforeEach`, write a temp file under `os.tmpdir()` containing one line, `ENV_TEST_<unique suffix>=loaded`. Call `loadEnvFileIfPresent(tempPath)`, then `expect(process.env[key]).toBe('loaded')`. In `afterEach`, `delete process.env[key]` and remove the file (plan R2).
  - Green: none expected. T10's implementation loads existing files.
  - Covers: AC11 "Given a local settings file exists, When the service loads its settings file, Then its values become available in the environment."

- [ ] T12. The service refuses to start on an invalid setting
  - Type: config
  - Depends on: T3, T10
  - Red: new `tests/integration/config/config.test.ts`. Run `spawnSync(process.execPath, ['--import', 'tsx', 'src/config/config.ts'], { env: { ...process.env, JWT_SECRET: 'short-secret-sentinel' }, encoding: 'utf8' })` from the repo root, then assert `status` is `1`, `stderr` contains `'JWT_SECRET'`, and `stderr` does not contain `'short-secret-sentinel'`. Fails now: today's `config.ts` accepts any secret, so the child exits `0`.
  - Green: rewrite `src/config/config.ts` per plan §1/§3. Call `loadEnvFileIfPresent(path.join(import.meta.dirname, '..', '..', '.env'))`. Call `parseEnv(process.env)` inside a small local `loadEnv(): Env` helper: on `InvalidEnvironmentError` it runs `console.error('❌ Invalid environment variables:', JSON.stringify(error.details, null, 4))` and `process.exit(1)`, and rethrows anything else. Map the result onto the unchanged default-export shape (plan §3 table). Then run `npm run typecheck`, `npm run lint`, and the full `npm test`, all green. The existing integration suites exercise the mapped config. If boot fails on the developer's local `.env` (plan R1), stop and ask the user to fix `.env` **manually**.
  - Covers: AC12 "Given an invalid setting in the environment, When the service is started, Then it stops with a failure outcome and prints a report naming the invalid setting without echoing its value."; E1

- [ ] T13. Document env validation in the project structure docs
  - Type: docs
  - Depends on: T12
  - Red: none. Documentation only, no logic (see testing-practices).
  - Green: in `CLAUDE.md` "Project structure", list `env.ts` (Zod `EnvSchema` + `parseEnv` + `loadEnvFileIfPresent`) and `InvalidEnvironmentError.ts` under `src/config/`, and note that `config.ts` validates env at boot and exits on failure. Mirror the `src/config/` listing in `README.md`.
  - Covers: none (supporting docs for the plan §2 components)

## Coverage check

| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given every setting in §2 is supplied with a valid value, When the settings are checked, Then each value is returned converted to its domain type: numbers as numbers and the environment as its choice. | T1 |
| AC2 | Given only the required settings are supplied, When the settings are checked, Then every optional setting takes its default from §2. | T2 |
| AC3 | Given `JWT_SECRET`, `DATABASE_USER`, and `DATABASE_DB` are all absent, When the settings are checked, Then an invalid-settings error (E1) is raised that names all three settings together, each with its reason. | T3 |
| AC4 | Given a `JWT_SECRET` shorter than 32 characters, When the settings are checked, Then an invalid-settings error (E1) is raised naming `JWT_SECRET` with its reason and without the supplied secret. | T4 |
| AC5 | Given numeric settings that are non-numeric, zero, fractional, and blank, When the settings are checked, Then an invalid-settings error (E1) is raised naming each of those settings with its reason. | T5 |
| AC6 | Given `TRUST_PROXY_HOPS` is `0`, When the settings are checked, Then it is accepted as the number zero. | T6 |
| AC7 | Given a negative `TRUST_PROXY_HOPS`, When the settings are checked, Then an invalid-settings error (E1) is raised naming `TRUST_PROXY_HOPS` with its reason. | T7 |
| AC8 | Given an `ENVIRONMENT` that is not one of development, test, or production, When the settings are checked, Then an invalid-settings error (E1) is raised naming `ENVIRONMENT` with its reason. | T8 |
| AC9 | Given `DATABASE_PASSWORD` is supplied blank, When the settings are checked, Then it is accepted as empty text. | T9 |
| AC10 | Given no local settings file exists, When the service loads its settings file, Then no error is raised and the environment is left unchanged. | T10 |
| AC11 | Given a local settings file exists, When the service loads its settings file, Then its values become available in the environment. | T11 |
| AC12 | Given an invalid setting in the environment, When the service is started, Then it stops with a failure outcome and prints a report naming the invalid setting without echoing its value. | T12 |
