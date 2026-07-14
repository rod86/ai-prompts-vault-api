# Plan: Authentication guard rejects tokens for nonexistent users
Spec: specs/20260714112323-auth-verify-user-exists/spec.md

## 1. Approach

Add a database existence check to the **verify** side of the existing `auth`
bounded context, without introducing a new port. `DrizzleUserCredentialsRepository`
(`src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts`)
already keeps the auth module's own local copy of the `users` table (see its
`schema.ts`, distinct from `src/modules/user/infrastructure/database/schema.ts`
per `eslint-plugin-boundaries`, which forbids the `auth` context reaching into
`user`'s domain/infrastructure) and already exposes `findByEmail` for
`LoginUseCase`. This plan mirrors that method with a `findById`, and injects the
same repository instance into `ValidateTokenUseCase`
(`src/modules/auth/application/ValidateTokenUseCase.ts`, mirroring how
`LoginUseCase` takes `UserCredentialsRepositoryInterface` at
`src/modules/auth/application/LoginUseCase.ts`).

`ValidateTokenUseCase.invoke` currently just delegates to
`TokenVerifierInterface.verifyToken`. It gains a second step: after the
verifier resolves `{ userId }`, look that id up via
`userCredentialsRepository.findById(userId)`; if it resolves `undefined`,
throw the existing `InvalidTokenError`
(`src/modules/auth/domain/errors/InvalidTokenError.ts`) — already mapped to
401 by `src/middleware/errorMiddleware.ts`, so no middleware or error-mapping
change is needed. `requireAuthMiddleware.ts` is untouched; it already just
calls `validateTokenUseCase.invoke(token)`.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `UserCredentialsRepositoryInterface` | existing | `src/modules/auth/domain/interfaces/UserCredentialsRepositoryInterface.ts` | Add `findById(id: string): Promise<UserCredentials \| undefined>` |
| `DrizzleUserCredentialsRepository` | existing | `src/modules/auth/infrastructure/database/DrizzleUserCredentialsRepository.ts` | Implement `findById`, mirroring `findByEmail` but filtering on `users.id` |
| `ValidateTokenUseCase` | existing | `src/modules/auth/application/ValidateTokenUseCase.ts` | Constructor takes a second dependency, `userCredentialsRepository: UserCredentialsRepositoryInterface`; `invoke` calls `findById(userId)` after `verifyToken` and throws `InvalidTokenError` when it resolves `undefined` |
| auth composition root | existing | `src/modules/auth/services.ts` | Pass the already-instantiated `userCredentialsRepository` (currently only used by `loginUseCase`) as `ValidateTokenUseCase`'s second constructor arg |
| `InvalidTokenError` | existing | `src/modules/auth/domain/errors/InvalidTokenError.ts` | Reused unchanged |
| central error mapping | existing | `src/middleware/errorMiddleware.ts` | Unchanged — `InvalidTokenError` already maps to 401 |
| `requireAuthMiddleware` | existing | `src/middleware/requireAuthMiddleware.ts` | Unchanged |

## 3. Interfaces & contracts

- `UserCredentialsRepositoryInterface.findById(id: string): Promise<UserCredentials | undefined>` — resolves the matching credentials record, or `undefined` when no user has that id (never throws, per `domain-driven-design` skill's "never throw from the contract").
- `ValidateTokenUseCase.invoke(token: string): Promise<ValidateTokenResponse>` — unchanged signature/return shape. Internally: `verifyToken(token)` → `{ userId }`; `findById(userId)` → `undefined` throws `InvalidTokenError`; otherwise resolves `{ userId }` as before.
- No new error body shape: `InvalidTokenError` already serializes via `errorMiddleware`'s existing `{ error: 'InvalidTokenError', message }` branch.

| E# (this spec) | Domain error | Response the user sees |
|--|--|--|
| E1 | `InvalidTokenError` (reused) | 401 `{ error: 'InvalidTokenError', message }` |

## 4. Data & persistence

`findById` reads the auth module's local `users` table copy
(`src/modules/auth/infrastructure/database/schema.ts`) by primary key — the
same table `findByEmail` already reads, no schema/migration change. No new
table, column, or index.

## 5. Validation

| V# (this spec) | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | The token's user id must correspond to an existing user account | `ValidateTokenUseCase` (`findById` after `verifyToken`) | → E1 |

## 6. Dependency changes

None.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, decided silently):
1. The existence check runs on every protected request (no caching), matching the request's explicit instruction to "verify the user id against database" in the use case — consequence if wrong: one extra indexed primary-key lookup per authenticated request.
2. `findById` returns the same `UserCredentials` shape as `findByEmail` (id, email, passwordHash) even though `ValidateTokenUseCase` only needs existence — consequence if wrong: a narrower "exists-only" return type would be marginally cheaper to construct, no behavioral difference.
3. The verification order stays "verify token, then check existence" (not reversed) — consequence if wrong: none observable, since both failures map to the same `InvalidTokenError`.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | `findById` query doesn't lowercase/normalize anything (unlike `findByEmail`), so a mismatched-case or malformed `sub` claim could silently miss | low | such a token is rejected as invalid (safe default) rather than authenticated | Token `sub` is always the exact uuid this system issued (`JwtTokenIssuer` writes `credentials.id` verbatim); no external input feeds `sub` |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| Deleted user | `Bearer <valid, unexpired token whose sub was deleted from `users`>` | 401 `InvalidTokenError` | AC1 |
| Never-existed user id | `Bearer <valid, unexpired token with a syntactically valid but never-inserted uuid sub>` | 401 `InvalidTokenError` | AC1 |
| Existing user (regression) | `Bearer <valid, unexpired token whose sub matches an existing user>` | 200; `req.auth.userId` = `sub` (unchanged from prior spec's AC1) | prior spec's AC1 (regression guard) |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| V1 | `ValidateTokenUseCase` `findById` check → E1 |
| E1 | `InvalidTokenError` → 401 (errorMiddleware, unchanged) |
| AC1 | `UserCredentialsRepositoryInterface.findById` + `DrizzleUserCredentialsRepository` + `ValidateTokenUseCase` + `requireAuthMiddleware` (end-to-end 401) |
