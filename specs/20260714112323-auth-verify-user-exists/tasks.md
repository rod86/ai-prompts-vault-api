# Tasks: Authentication guard rejects tokens for nonexistent users
Plan: specs/20260714112323-auth-verify-user-exists/plan.md

- [x] T1. Repository can look up a user's credentials by id
  - Type: infrastructure
  - Depends on: none
  - Red: `tests/integration/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.test.ts` — add a `describe('findById')` block: insert a user fixture (`userModelFactory`/`insertUsers`, as the existing `findByEmail` tests do), assert `repository.findById(fixture.id)` resolves `{ id: fixture.id, email: fixture.email, passwordHash: fixture.passwordHash }`; and assert `repository.findById(<a fresh random uuid>)` resolves `undefined`. Fails: `findById` does not exist on the interface/repository.
  - Green: add `findById(id: string): Promise<UserCredentials | undefined>` to `src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.ts`; implement it in `DrizzleUserCredentialsRepository` mirroring `findByEmail` but filtering `users.id` (no `lower()`/case-insensitivity needed — ids are uuids).
  - Covers: V1 (persistence half)

- [x] T2. ValidateTokenUseCase resolves the identity only when the user still exists
  - Type: application
  - Depends on: T1
  - Red: `tests/unit/modules/auth/application/ValidateTokenUseCase.test.ts` — update the constructor call to also pass a mocked `UserCredentialsRepositoryInterface` (`vitest-mock-extended`); update the existing "resolves the caller identity" test so `userCredentialsRepository.findById` mocks resolve a `UserCredentials` record for `'U'`, and additionally assert `findById` was called with `'U'`. Fails: constructor only takes one dependency / `invoke` never calls `findById`.
  - Green: add `userCredentialsRepository: UserCredentialsRepositoryInterface` as a second constructor parameter to `ValidateTokenUseCase`; in `invoke`, after `tokenVerifier.verifyToken(token)` resolves `{ userId }`, call `userCredentialsRepository.findById(userId)` before returning `{ userId }`.
  - Covers: V1 (happy-path continuation of the prior spec's AC1)

- [x] T3. ValidateTokenUseCase rejects a token whose user id has no matching account
  - Type: application
  - Depends on: T2
  - Red: same test file — new test: `tokenVerifier.verifyToken` resolves `{ userId: 'U' }`, `userCredentialsRepository.findById` resolves `undefined`; assert `useCase.invoke('a-token')` rejects with `InvalidTokenError`. Fails: `findById`'s result is never checked, so the use case still resolves the identity.
  - Green: in `ValidateTokenUseCase.invoke`, when `findById` resolves `undefined`, `throw new InvalidTokenError()` (`@src/modules/auth/domain/errors/InvalidTokenError.js`).
  - Covers: AC1; V1 → E1

- [x] T4. Wire the shared credentials repository into the token-validation use case
  - Type: application (composition root)
  - Depends on: T1, T2, T3
  - Red: none — `src/modules/auth/services.ts` is pure composition/DI wiring; see `testing-practices`. Verified by typecheck.
  - Green: in `src/modules/auth/services.ts`, pass the existing `userCredentialsRepository` instance (already built for `loginUseCase`) as `ValidateTokenUseCase`'s second constructor argument: `new ValidateTokenUseCase(tokenVerifier, userCredentialsRepository)`.
  - Covers: wiring for V1/E1/AC1 (no direct AC)

- [x] T5. Guard rejects a request whose token identifies a deleted/nonexistent user
  - Type: middleware
  - Depends on: T4
  - Red: `tests/integration/middleware/requireAuthMiddleware.test.ts` — new test: sign a valid, unexpired token (`jwt.sign({ sub: <a fresh random uuid never inserted into `users`>, exp: ... }, config.jwtSecret, { algorithm: 'HS256' })`); send it as `Authorization: Bearer <token>`; assert 401 with `{ error: 'InvalidTokenError' }`. Fails (before T1–T4): the use case resolves the identity for any well-formed token regardless of the database, so this currently returns 200.
  - Green: none beyond T1–T4 — this task proves the HTTP contract end-to-end through the already-wired pieces.
  - Covers: AC1 (HTTP half, end-to-end)

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a protected action, When the request is made with a token that is authentic, unexpired, and identifies a user id, but that user id matches no existing user account, Then the request is rejected as invalid and the action does not run. | T1, T2, T3, T4, T5 |
