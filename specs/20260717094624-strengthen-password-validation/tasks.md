# Tasks: Strengthen password validation on registration
Plan: specs/20260717094624-strengthen-password-validation/plan.md

- [x] T1. Install zxcvbn-ts packages
  - Type: dependency
  - Depends on: none
  - Red: none — dependency change, no test
  - Green: install `@zxcvbn-ts/core`, `@zxcvbn-ts/language-common`, `@zxcvbn-ts/language-en` at latest stable; confirm they land in `package.json`
  - Covers: enables V8 (no AC directly)

- [x] T2. Password strength checker port
  - Type: domain
  - Depends on: none
  - Red: none — `PasswordStrengthCheckerInterface` is a pure interface declaration; see testing-practices
  - Green: add `src/modules/shared/domain/interfaces/PasswordStrengthCheckerInterface.ts` with `isStrong(password: string): boolean`
  - Covers: contract for V8

- [x] T3. zxcvbn seam types
  - Type: infrastructure
  - Depends on: none
  - Red: none — `ZxcvbnChecker` and `ZxcvbnCheckerFactoryInterface` are pure type declarations; see testing-practices
  - Green: add `src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnCheckerTypes.ts` exporting `ZxcvbnChecker { check(password: string): { score: number } }` and `ZxcvbnCheckerFactoryInterface { create(): ZxcvbnChecker }`
  - Covers: seam for V8 adapter

- [x] T4. Production zxcvbn factory
  - Type: infrastructure
  - Depends on: T1, T3
  - Red: none — `ZxcvbnCheckerFactory` is logic-less composition wrapping the library (real behavior proven end-to-end in T10); see testing-practices
  - Green: add `src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnCheckerFactory.ts`; `create()` returns `new ZxcvbnFactory({ translations: en.translations, graphs: common.adjacencyGraphs, dictionary: { ...common.dictionary, ...en.dictionary } })`
  - Covers: real scoring wiring for V8

- [x] T5. Strength-checker adapter (threshold mapping)
  - Type: infrastructure
  - Depends on: T2, T3
  - Red: `tests/unit/modules/shared/infrastructure/security/zxcvbn/ZxcvbnPasswordStrengthChecker.test.ts` — a mocked `ZxcvbnCheckerFactoryInterface` whose `create()` returns a mocked `ZxcvbnChecker`; `it.each([[0,false],[1,false],[2,false],[3,true],[4,true]])` asserts `isStrong` returns the expected boolean per score. Fails: adapter does not exist
  - Green: add `src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnPasswordStrengthChecker.ts` implementing `PasswordStrengthCheckerInterface`; ctor takes `ZxcvbnCheckerFactoryInterface`; `isStrong` returns `factory.create().check(password).score >= MIN_STRENGTH_SCORE` with `const MIN_STRENGTH_SCORE = 3`
  - Covers: AC10 "Given the strength judgement, When a password is measured, Then a password at or above the minimum strength standard is judged strong and one below it is judged weak, across the full range of strength levels."; V8

- [x] T6. Weak-password domain error
  - Type: domain
  - Depends on: none
  - Red: none — declaration mirroring `EmailAlreadyInUseError` (behavior proven via T7/T10); see testing-practices
  - Green: add `src/modules/user/domain/errors/WeakPasswordError.ts` extending `DomainError`, `code = 'WEAK_PASSWORD'`, `category = 'Unprocessable'`, generic message (e.g. `'Password is too weak'`)
  - Covers: E2

- [ ] T7. Strength gate in RegisterUserUseCase
  - Type: application
  - Depends on: T2, T6
  - Red: add a case to `tests/unit/modules/user/application/RegisterUserUseCase.test.ts` — inject a mocked `PasswordStrengthCheckerInterface`; when `isStrong` returns `false`, `invoke` rejects with `WeakPasswordError` and `userRepository.findByEmail`, `passwordHasher.hash`, `userRepository.create`, `dateTime.now`, `idGenerator.generate` are **not** called. Fails: use case has no strength gate / ctor arg
  - Green: add `passwordStrengthChecker: PasswordStrengthCheckerInterface` as the 5th ctor dependency; as the first line of `invoke`, `if (!this.passwordStrengthChecker.isStrong(query.password)) throw new WeakPasswordError();`. Update the three existing use-case tests to construct with a mocked checker returning `true`
  - Covers: AC11 "Given a weak password and an email that is already in use, When the person registers, Then registration is refused as too weak (E2), the too-weak refusal takes precedence over the already-in-use refusal, and no email lookup or account creation occurs."; V8, E2

- [ ] T8. Wire the strength checker into composition roots
  - Type: composition root
  - Depends on: T4, T5, T7
  - Red: none — composition roots are logic-less wiring; see testing-practices
  - Green: in `src/modules/shared/services.ts` export `passwordStrengthChecker = new ZxcvbnPasswordStrengthChecker(new ZxcvbnCheckerFactory())`; in `src/modules/user/services.ts` pass `passwordStrengthChecker` as the 5th argument to `RegisterUserUseCase`
  - Covers: makes V8 live end-to-end (supports AC1, AC9)

- [ ] T9. Composition rules on CreateUserSchema
  - Type: route schema
  - Depends on: T8
  - Red: add a `Request Validation` case (parametrized) to `tests/integration/handlers/users/createUserHandler.test.ts` — `it.each` over `[password, expectedMessage]`: too-short→"Must be at least 8 characters", 65-char→max message, no-lowercase→lowercase message, no-uppercase→uppercase message, no-digit→digit message, no-special→special message, `Pàssword1!`/`Password 1!`→disallowed-character message; each asserts `response.status` 400 and `response.body.details.body.password` equals the message. Fails: schema only enforces min length
  - Green: in `src/routes/users.schema.ts` replace `password.min(8, …)` with the chain, declared in order V1→V7: `.min(8, 'Must be at least 8 characters').max(64, …).regex(/[a-z]/, …).regex(/[A-Z]/, …).regex(/[0-9]/, …).regex(/[<special-class>]/, …).regex(/^[A-Za-z0-9<special-class>]+$/, …)`
  - Covers: AC2 "Given a password shorter than 8 characters … refused with the 'at least 8 characters' reason on password (E1, V1)."; AC3 "…longer than 64 characters … 'at most 64 characters' reason (E1, V2)."; AC4 "…no lowercase letter … 'lowercase letter' reason (E1, V3)."; AC5 "…no uppercase letter … 'uppercase letter' reason (E1, V4)."; AC6 "…no digit … 'digit' reason (E1, V5)."; AC7 "…no allowed special character … 'special character' reason (E1, V6)."; AC8 "…containing a disallowed character … 'disallowed character' reason (E1, V7)."; V1–V7, E1

- [ ] T10. End-to-end strong-required registration
  - Type: route handler
  - Depends on: T8, T9
  - Red: add a case to `tests/integration/handlers/users/createUserHandler.test.ts` — POST `/users` with a well-formed but guessable password (`Qwerty123!`) and a fresh email asserts `response.status` 422, `response.body` equals `{ status: 422, code: 'WEAK_PASSWORD', message: '<generic>' }`, and no user is persisted for that email. Fails: weak password currently registers (201)
  - Green: no production change beyond T8/T9; in the same file, update the existing happy-path, documented-shape, and email-already-in-use cases to use a valid **strong** password (satisfies V1–V7 and scores ≥ 3, e.g. a high-entropy mixed string) so they exercise AC1 instead of tripping the new rules
  - Covers: AC1 "Given a password that satisfies V1–V8 and a not-yet-used email … the account is created and returned as it is today."; AC9 "Given a well-formed but easily guessed password … refused as too weak (E2, V8) and no account is created."; E2

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a password that satisfies V1–V8 and a not-yet-used email, When the person registers, Then the account is created and returned as it is today. | T10 |
| AC2 | Given a password shorter than 8 characters, When the person registers, Then registration is refused with the "at least 8 characters" reason on `password` (E1, V1). | T9 |
| AC3 | Given a password longer than 64 characters that otherwise satisfies V3–V7, When the person registers, Then registration is refused with the "at most 64 characters" reason on `password` (E1, V2). | T9 |
| AC4 | Given a password with no lowercase letter that otherwise satisfies V1–V2 and V4–V7, When the person registers, Then registration is refused with the "lowercase letter" reason on `password` (E1, V3). | T9 |
| AC5 | Given a password with no uppercase letter that otherwise satisfies V1–V3 and V5–V7, When the person registers, Then registration is refused with the "uppercase letter" reason on `password` (E1, V4). | T9 |
| AC6 | Given a password with no digit that otherwise satisfies V1–V4 and V6–V7, When the person registers, Then registration is refused with the "digit" reason on `password` (E1, V5). | T9 |
| AC7 | Given a password with no allowed special character that otherwise satisfies V1–V5 and V7, When the person registers, Then registration is refused with the "special character" reason on `password` (E1, V6). | T9 |
| AC8 | Given a password containing a disallowed character (a space or an accented letter) that otherwise satisfies V1–V6, When the person registers, Then registration is refused with the "disallowed character" reason on `password` (E1, V7). | T9 |
| AC9 | Given a well-formed but easily guessed password (satisfies V1–V7) and a not-yet-used email, When the person registers, Then registration is refused as too weak (E2, V8) and no account is created. | T10 |
| AC10 | Given the strength judgement, When a password is measured, Then a password at or above the minimum strength standard is judged strong and one below it is judged weak, across the full range of strength levels. | T5 |
| AC11 | Given a weak password and an email that is already in use, When the person registers, Then registration is refused as too weak (E2), the too-weak refusal takes precedence over the already-in-use refusal, and no email lookup or account creation occurs. | T7 |
