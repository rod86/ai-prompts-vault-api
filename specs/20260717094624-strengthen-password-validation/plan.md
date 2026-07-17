# Plan: Strengthen password validation on registration
Spec: specs/20260717094624-strengthen-password-validation/spec.md

## 1. Approach

Two independent gates, each in the layer that owns it:

- **Composition (V1–V7)** is enforced at the HTTP boundary by tightening the existing
  request-validation schema `CreateUserSchema` (`src/routes/users.schema.ts`). We add
  `.max`, four presence `.regex` checks, and one whitelist-anchor `.regex`, as **separate
  chained checks** so each failing rule yields its own message. Because
  `groupIssues` in `src/middleware/validateRequest/validator.ts` keeps the **first**
  issue per field (`group[field] ??= issue.message`) and Zod reports issues in
  declaration order, the checks are declared in the order V1→V7 so the "first unmet rule"
  reporting from spec §4/E1 falls out naturally. Failures continue to surface as the
  existing `ApiError(400, 'VALIDATION_ERROR', …, details)` — no middleware change.

- **Strength (V8)** is enforced in the application layer. `RegisterUserUseCase`
  (`src/modules/user/application/RegisterUserUseCase.ts`) gains an injected
  `PasswordStrengthCheckerInterface` and, as its **first** step, rejects a weak password
  with a new `WeakPasswordError` before the `findByEmail` lookup or hashing — mirroring
  how the existing `EmailAlreadyInUseError` short-circuits. `WeakPasswordError` extends
  the shared `DomainError` with category `Unprocessable`, so `errorMiddleware` maps it to
  **422** via the existing `CATEGORY_STATUS` with **no middleware edit** (same path as
  `EmailAlreadyInUseError`).

The strength measurement is a new infrastructure adapter wrapping `zxcvbn-ts`, following
the existing `PasswordHasherInterface` → `BcryptPasswordHasher` port/adapter pattern. The
threshold comparison (`score >= 3`) lives in the adapter as a module constant. The adapter
receives an injected **factory** (a class behind an interface) whose `create()` is called
**inside** `isStrong`, so the adapter's threshold logic is unit-testable against a mocked
score with no real library. All wiring lands in the existing composition roots
(`src/modules/shared/services.ts`, `src/modules/user/services.ts`).

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `CreateUserSchema` | existing | `src/routes/users.schema.ts` | Replace the lone `.min(8)` on `password` with the V1–V7 chain (min, max, 4 presence regexes, whitelist-anchor regex), in declaration order V1→V7 |
| `PasswordStrengthCheckerInterface` | new | `src/modules/shared/domain/interfaces/PasswordStrengthCheckerInterface.ts` | Port: `isStrong(password: string): boolean` |
| `ZxcvbnChecker`, `ZxcvbnCheckerFactoryInterface` | new | `src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnCheckerTypes.ts` | Minimal structural types: `ZxcvbnChecker.check(password) → { score: number }`; `ZxcvbnCheckerFactoryInterface.create() → ZxcvbnChecker` |
| `ZxcvbnCheckerFactory` | new | `src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnCheckerFactory.ts` | Production factory class implementing `ZxcvbnCheckerFactoryInterface`; `create()` builds `new ZxcvbnFactory({ translations, graphs, dictionary })` from the core + language-common + language-en packages |
| `ZxcvbnPasswordStrengthChecker` | new | `src/modules/shared/infrastructure/security/zxcvbn/ZxcvbnPasswordStrengthChecker.ts` | Adapter implementing `PasswordStrengthCheckerInterface`; ctor takes `ZxcvbnCheckerFactoryInterface`; `isStrong` calls `factory.create().check(password).score >= MIN_STRENGTH_SCORE` (`MIN_STRENGTH_SCORE = 3`) |
| `WeakPasswordError` | new | `src/modules/user/domain/errors/WeakPasswordError.ts` | Extends `DomainError`; `code = 'WEAK_PASSWORD'`, `category = 'Unprocessable'`, generic message |
| `RegisterUserUseCase` | existing | `src/modules/user/application/RegisterUserUseCase.ts` | Add `passwordStrengthChecker` ctor dependency; first step: `if (!checker.isStrong(query.password)) throw new WeakPasswordError()` |
| shared composition root | existing | `src/modules/shared/services.ts` | Export `passwordStrengthChecker = new ZxcvbnPasswordStrengthChecker(new ZxcvbnCheckerFactory())` |
| user composition root | existing | `src/modules/user/services.ts` | Pass `passwordStrengthChecker` into `RegisterUserUseCase` |

## 3. Interfaces & contracts

```ts
// port
interface PasswordStrengthCheckerInterface { isStrong(password: string): boolean; }

// infra seam
interface ZxcvbnChecker { check(password: string): { score: number }; }
interface ZxcvbnCheckerFactoryInterface { create(): ZxcvbnChecker; }

// adapter
class ZxcvbnPasswordStrengthChecker implements PasswordStrengthCheckerInterface {
    constructor(factory: ZxcvbnCheckerFactoryInterface);
    isStrong(password: string): boolean; // factory.create().check(password).score >= 3
}

// use case (signature grows by one dependency)
new RegisterUserUseCase(userRepository, passwordHasher, dateTime, idGenerator, passwordStrengthChecker)
```

Special-character set enforced by V6/V7 (regex character class, escaped):
`` !"#$%&'()*+,-./:;<=>?@[\]^_`{|}~ `` → class body ``!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~`` ;
whitelist anchor `^[A-Za-z0-9<class>]+$`.

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `ApiError(400, 'VALIDATION_ERROR', …, details)` (unchanged, emitted by `validateRequestMiddleware`) | `400` `{ status, code: 'VALIDATION_ERROR', message, details: { body: { password: '<first unmet rule message>' } } }` |
| E2 | `WeakPasswordError extends DomainError` (`Unprocessable`) | `422` `{ status: 422, code: 'WEAK_PASSWORD', message: '<generic too-weak message>' }` (no `details`) |

## 4. Data & persistence

None. No table, column, or migration changes — password strength is validated in transit,
and the stored value remains the existing bcrypt hash.

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | length ≥ 8 | `CreateUserSchema.password.min(8, …)` | → E1 |
| V2 | length ≤ 64 | `CreateUserSchema.password.max(64, …)` | → E1 |
| V3 | ≥1 lowercase | `.regex(/[a-z]/, …)` | → E1 |
| V4 | ≥1 uppercase | `.regex(/[A-Z]/, …)` | → E1 |
| V5 | ≥1 digit | `.regex(/[0-9]/, …)` | → E1 |
| V6 | ≥1 allowed special | `.regex(/[<class>]/, …)` | → E1 |
| V7 | only allowed characters | `.regex(/^[A-Za-z0-9<class>]+$/, …)` | → E1 |
| V8 | not easily guessable | `RegisterUserUseCase` via `PasswordStrengthCheckerInterface.isStrong` (adapter threshold `score >= 3`) | → E2 |

Declaration order V1→V7 guarantees the first-issue-wins reporting matches spec E1.

## 6. Dependency changes

| Dependency | Version | Action | Reason |
|--|--|--|--|
| `@zxcvbn-ts/core` | latest stable at install | install | Strength-scoring engine for V8 |
| `@zxcvbn-ts/language-common` | latest stable at install | install | Common-password list + keyboard adjacency graphs for scoring |
| `@zxcvbn-ts/language-en` | latest stable at install | install | English dictionary + translations for scoring |

## 7. Assumptions & risks

Assumptions:
1. `WeakPasswordError` lives in `src/modules/user/domain/errors/` beside
   `EmailAlreadyInUseError`, since it is raised by the user module's use case — consequence
   if wrong: a file-move, no behavior change.
2. The seam/type file is named `ZxcvbnCheckerTypes.ts` and holds both `ZxcvbnChecker` and
   `ZxcvbnCheckerFactoryInterface` — consequence if wrong: rename only.
3. V1's message text is kept as `'Must be at least 8 characters'` so the existing
   too-short validation test stays green — consequence if wrong: update that one assertion.
4. The generic V8 message is a fixed string (e.g. `'Password is too weak'`) — consequence
   if wrong: reword one constant and its test assertion.
5. `ZxcvbnFactory` is structurally assignable to `ZxcvbnChecker` (its `check` returns a
   richer result whose `score` widens to `number`) — consequence if wrong: add an explicit
   adapter/return-narrowing in `create()`.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | zxcvbn scores a chosen test password differently across library versions, making an integration example flaky at the boundary | low | med | Use clearly-weak (`Qwerty123!`) and clearly-strong examples, never a score-exactly-3 probe; the boundary itself is pinned by the adapter unit test against a mocked score |
| R2 | Existing tests using now-invalid passwords (`'a-secure-password'`, `'abc'`) fail | high (expected) | low | Updating them is explicit in-scope tasks (T5, T8) |
| R3 | Regex character-class mis-escaping lets a disallowed char through or rejects an allowed one | med | med | V6/V7 covered by per-rule tests (AC7, AC8) including a disallowed-character case |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Exactly 8 chars, all classes | `Aa1!Aa1!` (strong enough) | Accepted by composition | AC1 |
| Exactly 64 chars | 64-char valid string | Accepted (max is inclusive) | AC1/AC3 boundary |
| 65 chars | 65-char otherwise-valid string | Refused with V2 message | AC3 |
| Accented letter | `Pàssword1!` | Refused with V7 message (à not in allowed set) | AC8 |
| Embedded space | `Password 1!` | Refused with V7 message | AC8 |
| Well-formed keyboard run | `Qwerty123!` | Passes V1–V7, refused as weak (E2) | AC9, AC11 |
| Weak password + duplicate email | `Qwerty123!` + existing email | Refused as weak before email lookup; no `findByEmail`/`create`/`hash` calls | AC11 |
| Strength score sweep | mocked scores 0–4 | 0,1,2 → not strong; 3,4 → strong | AC10 |

## 9. Traceability

| Spec item | Plan element(s) |
| --------- | --------------- |
| V1 | §5 `.min(8)`; T6 |
| V2 | §5 `.max(64)`; T6 |
| V3 | §5 `.regex(/[a-z]/)`; T6 |
| V4 | §5 `.regex(/[A-Z]/)`; T6 |
| V5 | §5 `.regex(/[0-9]/)`; T6 |
| V6 | §5 `.regex(/[<class>]/)`; T6 |
| V7 | §5 whitelist-anchor regex; T6 |
| V8 | §2 adapter + use-case gate; §5; T3, T5 |
| E1 | §3 (unchanged `VALIDATION_ERROR` path); T6 |
| E2 | §3 `WeakPasswordError` → 422; T4, T5, T8 |
| AC1 | T8 (updated happy path) |
| AC2–AC8 | T6 (per-rule schema tests) |
| AC9 | T8 (real-library weak rejection) |
| AC10 | T3 (adapter unit, score sweep) |
| AC11 | T5 (use-case fail-fast unit) |
| Fields (password) | §2 `CreateUserSchema` |
