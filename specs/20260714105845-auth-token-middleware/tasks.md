# Tasks: Authentication guard for protected actions
Plan: specs/20260714105845-auth-token-middleware/plan.md

- [x] T1. Validation use case returns the caller identity
  - Type: application
  - Depends on: none
  - Red: `tests/unit/modules/auth/application/ValidateTokenUseCase.test.ts` — with a mocked `TokenVerifierInterface` (`vitest-mock-extended`) whose `verifyToken` resolves `{ userId: 'U' }`, assert `invoke('a-token')` resolves `{ userId: 'U' }` and calls the verifier with the token. Fails: use case does not exist.
  - Green: create `src/modules/auth/domain/interfaces/TokenVerifierInterface.ts` (port) and `src/modules/auth/application/ValidateTokenUseCase.ts` exporting `ValidateTokenResponse { userId: string }`.
  - Covers: contributes to AC1 (identity extraction step); field "caller identity"

- [x] T2. Verifier resolves the user id for a valid token
  - Type: infrastructure
  - Depends on: T1
  - Red: `tests/integration/modules/auth/infrastructure/security/JwtTokenVerifier.test.ts` — sign a valid, unexpired token for user `U` (via `JwtTokenIssuer` / `jwt.sign` with `config.jwtSecret`); assert `new JwtTokenVerifier(secret).verifyToken(token)` resolves `{ userId: 'U' }`. Fails: verifier does not exist.
  - Green: create `src/modules/auth/infrastructure/security/JwtTokenVerifier.ts` implementing `TokenVerifierInterface` via `jwt.verify(token, secret, { algorithms: ['HS256'] })`, mapping `sub` → `userId`.
  - Covers: AC1 "Given a protected action and a valid, unexpired token identifying user U, When the request is made with that token, Then the action proceeds and the caller identity carrying user id U is available to it."; V2, V4

- [x] T3. Verifier rejects an expired token distinctly
  - Type: infrastructure
  - Depends on: T2
  - Red: same test file — sign a token whose `exp` is in the past; assert `verifyToken` rejects with `TokenExpiredError`. Fails: expired path not handled / error type missing.
  - Green: create `src/modules/auth/domain/errors/TokenExpiredError.ts`; in `JwtTokenVerifier` catch `jsonwebtoken`'s `TokenExpiredError` and throw the domain `TokenExpiredError`.
  - Covers: AC3 "Given a protected action, When the request is made with an expired token, Then the request is rejected, the caller is told the token has expired, and the action does not run." (verification half); V3 → E2

- [x] T4. Verifier rejects a non-authentic/unreadable token
  - Type: infrastructure
  - Depends on: T2
  - Red: same test file — verify a token signed with a different secret (bad signature); assert `verifyToken` rejects with `InvalidTokenError`. Fails: invalid path not handled / error type missing.
  - Green: create `src/modules/auth/domain/errors/InvalidTokenError.ts`; in `JwtTokenVerifier` catch remaining `jsonwebtoken` `JsonWebTokenError` cases and throw the domain `InvalidTokenError`.
  - Covers: AC4 "Given a protected action, When the request is made with a token that is not authentic or is unreadable, Then the request is rejected as invalid and the action does not run." (verification half); V2 → E3

- [x] T5. Verifier rejects a valid token that identifies no user
  - Type: infrastructure
  - Depends on: T4
  - Red: same test file — sign a valid, unexpired token with no `sub` claim; assert `verifyToken` rejects with `InvalidTokenError`. Fails: missing-`sub` accepted.
  - Green: in `JwtTokenVerifier`, when the decoded `sub` is absent throw `InvalidTokenError`.
  - Covers: AC5 "Given a protected action, When the request is made with an otherwise-valid token that identifies no user, Then the request is rejected as invalid and the action does not run."; V4 → E3

- [x] T6. Wire the verifier and validation use case in the auth composition root
  - Type: application (composition root)
  - Depends on: T1, T2, T3, T4, T5
  - Red: none — `src/modules/auth/services.ts` is pure composition/DI wiring; see testing-practices. Verified by typecheck.
  - Green: in `src/modules/auth/services.ts` instantiate `new JwtTokenVerifier(config.jwtSecret)` and export `validateTokenUseCase = new ValidateTokenUseCase(tokenVerifier)`.
  - Covers: wiring for AC1–AC5 (no direct AC)

- [x] T7. Type the attached identity on the request
  - Type: route typing (HTTP layer)
  - Depends on: T1
  - Red: none — `src/types/express.d.ts` is a pure type declaration; verified by typecheck.
  - Green: add `auth?: ValidateTokenResponse;` to the `Express.Request` declaration-merge block, type-importing `ValidateTokenResponse` from `ValidateTokenUseCase`.
  - Covers: field "caller identity" typing for AC1

- [ ] T8. Guard attaches the identity for a valid token
  - Type: middleware
  - Depends on: T6, T7
  - Red: `tests/integration/middleware/requireAuthMiddleware.test.ts` — build a supertest app mounting `requireAuthMiddleware` before a scratch route that returns `req.auth`, with `errorMiddleware` last; send `Authorization: Bearer <valid token for U>`; assert 200 and body user id `U`. Fails: middleware does not exist.
  - Green: create `src/middleware/requireAuthMiddleware.ts` (async default export) that parses `Bearer <token>`, sets `req.auth = await validateTokenUseCase.invoke(token)` (from `@src/modules/auth/services.js`), then `next()`.
  - Covers: AC1 "Given a protected action and a valid, unexpired token identifying user U, When the request is made with that token, Then the action proceeds and the caller identity carrying user id U is available to it."; V1 (happy path)

- [ ] T9. Guard rejects a request with no token
  - Type: middleware
  - Depends on: T8
  - Red: same test file — send a request with no `Authorization` header; assert 401 with `{ error: 'MissingTokenError' }`. Fails: no missing-token handling / mapping → 500.
  - Green: create `src/modules/auth/domain/errors/MissingTokenError.ts`; in `requireAuthMiddleware` `throw new MissingTokenError()` when the header is absent or not `Bearer <token>`; add a `MissingTokenError → 401` `instanceof` branch to `src/middleware/errorMiddleware.ts`.
  - Covers: AC2 "Given a protected action, When the request is made with no authentication token, Then the request is rejected as not authenticated (missing token) and the action does not run."; V1 → E1

- [ ] T10. Expired token is surfaced as a 401 that says so
  - Type: middleware
  - Depends on: T3, T8
  - Red: same test file — send `Authorization: Bearer <expired token>`; assert 401 with `{ error: 'TokenExpiredError' }`. Fails: `TokenExpiredError` unmapped → 500.
  - Green: add a `TokenExpiredError → 401` `instanceof` branch to `src/middleware/errorMiddleware.ts`.
  - Covers: AC3 "Given a protected action, When the request is made with an expired token, Then the request is rejected, the caller is told the token has expired, and the action does not run." (HTTP half); E2

- [ ] T11. Invalid token is surfaced as a 401
  - Type: middleware
  - Depends on: T4, T8
  - Red: same test file — send `Authorization: Bearer <token signed with a different secret>`; assert 401 with `{ error: 'InvalidTokenError' }`. Fails: `InvalidTokenError` unmapped → 500.
  - Green: add an `InvalidTokenError → 401` `instanceof` branch to `src/middleware/errorMiddleware.ts`.
  - Covers: AC4 "Given a protected action, When the request is made with a token that is not authentic or is unreadable, Then the request is rejected as invalid and the action does not run." (HTTP half); E3

## Coverage check
| AC# | Criterion text (verbatim from spec §5) | Covered by task(s) |
| --- | -------------------------------------- | ------------------ |
| AC1 | Given a protected action and a valid, unexpired token identifying user U, When the request is made with that token, Then the action proceeds and the caller identity carrying user id U is available to it. | T2, T8 |
| AC2 | Given a protected action, When the request is made with no authentication token, Then the request is rejected as not authenticated (missing token) and the action does not run. | T9 |
| AC3 | Given a protected action, When the request is made with an expired token, Then the request is rejected, the caller is told the token has expired, and the action does not run. | T3, T10 |
| AC4 | Given a protected action, When the request is made with a token that is not authentic or is unreadable, Then the request is rejected as invalid and the action does not run. | T4, T11 |
| AC5 | Given a protected action, When the request is made with an otherwise-valid token that identifies no user, Then the request is rejected as invalid and the action does not run. | T5 |
