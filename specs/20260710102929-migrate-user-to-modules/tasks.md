# Tasks: Rebuild the user registration capability in the current module structure
Plan: specs/20260710102929-migrate-user-to-modules/plan.md

- [x] T1. Add the `User` entity
  - Type: domain
  - Depends on: none
  - Red: none — pure type declaration, no logic; see `testing-practices` "no logic, no test" rule.
  - Green: create `src/modules/user/domain/User.ts` — `export type User { id; name; email; passwordHash; createdAt; updatedAt }`, ported from `src/logic/user/domain/User.ts` (declared as `type` per `plan.md` §7 Assumption 1).
  - Covers: underlies AC1–AC3 (entity shape); V1

- [ ] T2. Add the `EmailAlreadyInUseError` domain error
  - Type: domain
  - Depends on: none
  - Red: none — no dedicated test; covered indirectly by the use-case duplicate-email branch in T4.
  - Green: create `src/modules/user/domain/errors/EmailAlreadyInUseError.ts`, ported unchanged from `src/logic/user/domain/errors/EmailAlreadyInUseError.ts` (extends `Error`, sets `name`, message `Email already in use: <email>`).
  - Covers: E1

- [ ] T3. Add the `UserRepositoryInterface` port
  - Type: domain
  - Depends on: T1
  - Red: none — contract only, no dedicated test.
  - Green: create `src/modules/user/domain/interfaces/UserRepositoryInterface.ts`, default-exported, ported unchanged from legacy: `findByEmail(email: string): Promise<User | undefined>`, `create(user: User): Promise<void>`.
  - Covers: V5

- [ ] T4. `RegisterUserUseCase` with internal id/timestamp generation
  - Type: application
  - Depends on: T1, T2, T3
  - Red: `tests/unit/modules/user/application/RegisterUserUseCase.test.ts` (ported from `tests/unit/logic/user/application/RegisterUserUseCase.test.ts`, substantively adjusted per `plan.md` §2) — mocks `UserRepositoryInterface`, `PasswordHasherInterface`, `DateTimeInterface`, `IdGeneratorInterface`; `buildQuery()` no longer includes `id`/`createdAt`/`updatedAt` (keeps `name`/`email`/`password`); asserts the returned account and the `userRepository.create` call use the mocked generator's id and the mocked clock's time for both `createdAt` and `updatedAt`, that the returned account omits the password, that `passwordHasher.hash` is called with the query password, and keeps the existing "email already in use → `EmailAlreadyInUseError`, `create` not called" case (which additionally asserts `dateTime.now()`/`idGenerator.generate()` were never called). Fails: class/constructor shape doesn't exist yet.
  - Green: create `src/modules/user/application/RegisterUserUseCase.ts` per `plan.md` §3 — constructor `(userRepository, passwordHasher, dateTime, idGenerator)`; `RegisterUserQuery = { name, email, password }`; self-assign `id = idGenerator.generate()`, `createdAt = updatedAt = dateTime.now()`; unchanged `RegisterUserResponse`.
  - Covers: AC1 "Given the rebuilt implementation, When an account is registered with a name, an email not already in use, and a password, Then a new account is created with a capability-assigned unique identifier and creation/last-updated moment, its password stored only in secured form, and the created account is returned without the password — exactly as `008-user-registration` describes"; AC2 "Given the rebuilt implementation, When an account is registered with an email that already belongs to an existing account (compared case-insensitively), Then the duplicate-email error (E1) is raised and no account is created, exactly as `008-user-registration` describes"; V1, V2, V3, V4, E1

- [ ] T5. Port the `users` Drizzle schema
  - Type: infrastructure
  - Depends on: none
  - Red: none — pure table declaration, no logic.
  - Green: create `src/modules/user/infrastructure/database/schema.ts`, ported unchanged (same table/column names, types, and `lower(email)` unique index) from `src/logic/user/infrastructure/database/schema.ts`.
  - Covers: V7 (no new migration); underlies AC3

- [ ] T6. `DrizzleUserRepository` on the current persistence convention
  - Type: infrastructure
  - Depends on: T1, T3, T5
  - Red: `tests/integration/modules/user/infrastructure/database/DrizzleUserRepository.test.ts` (ported from `tests/integration/logic/user/infrastructure/database/DrizzleUserRepository.test.ts`, import paths updated; real DB via `tests/lib/config.ts`; builds a `DatabaseClient` locally and passes the **client** to the repository, mirroring `tests/integration/modules/prompt/infrastructure/database/DrizzlePromptRepository.test.ts`) — `create` persists an account row (verified via `selectUsersByIds`); `findByEmail` finds an account case-insensitively and returns `undefined` when none matches. Reuses `userModelFactory` and `tests/lib/database/users.ts`. Fails: class doesn't exist.
  - Green: create `src/modules/user/infrastructure/database/DrizzleUserRepository.ts` per `plan.md` §3 — constructor takes `DatabaseClientInterface<DatabaseConnection>`; each method calls `this.database.getConnection()`; `lower(email)` match and insert bodies unchanged; `DatabaseConnection` imported from `@src/modules/shared/services.js`.
  - Covers: AC3 "Given the rebuilt persistence adapter, When accounts are created and looked up by email, Then the same account rows are stored and the same account is found (case-insensitively), exactly as the existing adapter does"; V1, V2, V4

- [ ] T7. User module composition root
  - Type: infrastructure
  - Depends on: T4, T6
  - Red: none — `services.ts` is pure composition; see `testing-practices`.
  - Green: create `src/modules/user/services.ts` — `new DrizzleUserRepository(databaseClient)`, `new RegisterUserUseCase(userRepository, passwordHasher, dateTimeService, idGenerator)` (all imported from `@src/modules/shared/services.js`); export `registerUserUseCase`.
  - Covers: AC4 "Given the rebuilt module, When its composition entry point is loaded, Then it exposes a ready-to-use registration capability wired to the shared current-time, secured-password, and unique-identifier providers"; V1, V3, V4

- [ ] T8. Full-suite verification and legacy-intact check
  - Type: infrastructure
  - Depends on: T1, T2, T3, T4, T5, T6, T7
  - Red: none — verification step, no new behavior.
  - Green: run `npm run lint` (incl. boundary rules — the new folder is already covered by the existing `src/modules/*` element, so no `.eslintrc.json` change), `npm run typecheck`, and `npm test` (all green); run `npx drizzle-kit generate` and confirm no new SQL migration is produced; confirm `src/logic/**`, `src/handlers/**`, `src/config.ts`, and every pre-existing test file are unchanged (`git diff`), and that the sign-in / auth suite still passes.
  - Covers: AC5 "Given the rebuilt module, When its structure is inspected, Then the capability's and its collaborators' contracts are placed separately from their concrete implementations, per the current architecture guidelines"; AC6 "Given the rebuild is complete, When the existing implementation, the other business areas, and the stored account records are inspected, Then they are unchanged, the sign-in capability still authenticates against the same account records, and their existing tests still pass"; AC7 "Given the rebuild is complete, When the project's lint, type-check, and full test suite are run, Then all pass and no change to stored data is required"; V5, V6, V7

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | *Register a new account.* Given the rebuilt implementation, When an account is registered with a name, an email not already in use, and a password, Then a new account is created with a capability-assigned unique identifier and creation/last-updated moment, its password stored only in secured form, and the created account is returned without the password — exactly as `008-user-registration` describes. | T4, T7 |
| AC2 | *Duplicate email rejected.* Given the rebuilt implementation, When an account is registered with an email that already belongs to an existing account (compared case-insensitively), Then the duplicate-email error (E1) is raised and no account is created, exactly as `008-user-registration` describes. | T4 |
| AC3 | *Account records stored and found.* Given the rebuilt persistence adapter, When accounts are created and looked up by email, Then the same account rows are stored and the same account is found (case-insensitively), exactly as the existing adapter does. | T5, T6 |
| AC4 | *Single composition entry point.* Given the rebuilt module, When its composition entry point is loaded, Then it exposes a ready-to-use registration capability wired to the shared current-time, secured-password, and unique-identifier providers. | T7 |
| AC5 | *Contracts separated.* Given the rebuilt module, When its structure is inspected, Then the capability's and its collaborators' contracts are placed separately from their concrete implementations, per the current architecture guidelines. | T1, T2, T3, T8 |
| AC6 | *Legacy and shared records intact.* Given the rebuild is complete, When the existing implementation, the other business areas, and the stored account records are inspected, Then they are unchanged, the sign-in capability still authenticates against the same account records, and their existing tests still pass. | T8 |
| AC7 | *Quality gates pass, no data change.* Given the rebuild is complete, When the project's lint, type-check, and full test suite are run, Then all pass and no change to stored data is required. | T8 |
