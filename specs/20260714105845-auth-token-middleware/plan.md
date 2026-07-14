# Plan: Authentication guard for protected actions
Spec: specs/20260714105845-auth-token-middleware/spec.md

## 1. Approach

Add the **verify** side to the existing `auth` bounded context and a reusable
HTTP guard middleware. Tokens are already issued by `JwtTokenIssuer`
(`src/modules/auth/infrastructure/security/JwtTokenIssuer.ts`) as HS256 with
payload `{ sub: userId, exp }`; this feature mirrors that with a verifier.

Layering follows the `domain-driven-design` skill: a domain port
(`TokenVerifierInterface`) is implemented in `infrastructure/security/` by a
`jsonwebtoken`-backed adapter that maps library errors to domain errors so the
library never leaks; a thin application use case (`ValidateTokenUseCase`,
mirroring `LoginUseCase` at `src/modules/auth/application/LoginUseCase.ts`)
returns the identity to attach; the HTTP middleware reaches the context only
through `src/modules/auth/services.ts`. Error→status mapping stays centralized
in the existing `src/middleware/errorMiddleware.ts`, and the request typing is
extended via declaration merging in `src/types/express.d.ts` (mirroring the
existing `parsedRequest?` augmentation). The middleware is built and verified in
isolation (a scratch guarded route in tests) — it is not attached to any
existing router.

## 2. Components & modules

| Component | New/existing | File path | Change |
| --------- | ------------ | --------- | ------ |
| `TokenVerifierInterface` | new | `src/modules/auth/domain/interfaces/TokenVerifierInterface.ts` | Port: `verifyToken(token: string): Promise<{ userId: string }>`; throws `TokenExpiredError` / `InvalidTokenError` |
| `MissingTokenError` | new | `src/modules/auth/domain/errors/MissingTokenError.ts` | Domain error, `extends Error`, sets `this.name` |
| `TokenExpiredError` | new | `src/modules/auth/domain/errors/TokenExpiredError.ts` | Domain error, `extends Error`, sets `this.name` |
| `InvalidTokenError` | new | `src/modules/auth/domain/errors/InvalidTokenError.ts` | Domain error, `extends Error`, sets `this.name` |
| `JwtTokenVerifier` | new | `src/modules/auth/infrastructure/security/JwtTokenVerifier.ts` | `implements TokenVerifierInterface` via `jwt.verify` (HS256); maps `jsonwebtoken` `TokenExpiredError`→domain `TokenExpiredError`, other `JsonWebTokenError` / missing `sub`→`InvalidTokenError` |
| `ValidateTokenUseCase` | new | `src/modules/auth/application/ValidateTokenUseCase.ts` | `invoke(token: string): Promise<ValidateTokenResponse>`; exports `ValidateTokenResponse { userId: string }` |
| auth composition root | existing | `src/modules/auth/services.ts` | Instantiate `new JwtTokenVerifier(config.jwtSecret)`; export `validateTokenUseCase = new ValidateTokenUseCase(tokenVerifier)` |
| `requireAuthMiddleware` | new | `src/middleware/requireAuthMiddleware.ts` | async `RequestHandler`; parses `Authorization: Bearer <token>`, delegates to `validateTokenUseCase`, sets `req.auth`; `throw new MissingTokenError()` when header absent/malformed |
| Express request typing | existing | `src/types/express.d.ts` | Add `auth?: ValidateTokenResponse` to `Express.Request` |
| central error mapping | existing | `src/middleware/errorMiddleware.ts` | Add `instanceof` branches: `MissingTokenError`, `TokenExpiredError`, `InvalidTokenError` → **401** |

## 3. Interfaces & contracts

- `TokenVerifierInterface.verifyToken(token: string): Promise<{ userId: string }>` — resolves the user id; rejects with `TokenExpiredError` or `InvalidTokenError`.
- `ValidateTokenUseCase.invoke(token: string): Promise<ValidateTokenResponse>`; `export interface ValidateTokenResponse { userId: string }`.
- `requireAuthMiddleware`: async `RequestHandler`. Reads `req.headers.authorization`; on absent/non-`Bearer` header throws `MissingTokenError`; else `req.auth = await validateTokenUseCase.invoke(token)` then `next()`. (Express 5 auto-forwards rejections from async middleware.)
- `Express.Request.auth?: ValidateTokenResponse` — the attached caller identity, `undefined` until set.
- Error body shape reuses the existing `errorMiddleware` envelope: `{ error: err.name, message: err.message }`.

| E# | Domain error | Response the user sees |
|--|--|--|
| E1 | `MissingTokenError` | 401 `{ error: 'MissingTokenError', message }` |
| E2 | `TokenExpiredError` | 401 `{ error: 'TokenExpiredError', message }` |
| E3 | `InvalidTokenError` | 401 `{ error: 'InvalidTokenError', message }` |

## 4. Data & persistence

None. The feature verifies self-contained tokens and touches no storage (no user
lookup by id — see Assumption 2).

## 5. Validation

| V# | Rule | Where enforced | On failure |
|--|--|--|--|
| V1 | Request carries a token in `Authorization: Bearer <token>` form | `requireAuthMiddleware` (header parse) | → E1 |
| V2 | Token is authentic (valid HS256 signature) | `JwtTokenVerifier` (`jwt.verify`) | → E3 |
| V3 | Token is not expired | `JwtTokenVerifier` (`jwt.verify` `exp`) | → E2 |
| V4 | Token carries a user id (`sub` claim present) | `JwtTokenVerifier` (reads `sub`) | → E3 |

## 6. Dependency changes

None. `jsonwebtoken` (`^9.0.3`) and `@types/jsonwebtoken` are already installed
and used by `JwtTokenIssuer`.

| Dependency | Version | Action | Reason |
|--|--|--|--|
| — | — | — | none |

## 7. Assumptions & risks

Assumptions (trivial, decided silently):
1. Token transport is the standard `Authorization: Bearer <token>` request header — consequence if wrong: clients using another scheme are rejected as missing (E1).
2. No database lookup of the user id is performed (the token is trusted once authentic and unexpired) — consequence if wrong: a token for a since-deleted user would still authenticate.
3. An `Authorization` header that is present but not in `Bearer <token>` form is treated as missing (E1), not invalid (E3) — consequence if wrong: a garbled header yields "missing" wording instead of "invalid".
4. All rejections use HTTP 401 with the existing JSON error envelope and no `WWW-Authenticate` header, for consistency with the current `errorMiddleware` — consequence if wrong: slightly less HTTP-idiomatic 401 responses.
5. Verifier internal test uses `JwtTokenIssuer` / `jwt.sign` to mint fixtures; adapter test placed under `tests/integration/...security/` beside `JwtTokenIssuer.test.ts` — consequence if wrong: only test-location, no runtime effect.

Risks:
| # | Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|--|
| R1 | `jsonwebtoken` error types not discriminated correctly, so expired is not distinguished from invalid | low | E2 collapses into E3 | Adapter tests assert expired→`TokenExpiredError` and tampered/wrong-secret→`InvalidTokenError` separately (T3, T4) |
| R2 | `config.jwtSecret` empty in an environment | low | all tokens rejected as invalid | Same secret already required by `JwtTokenIssuer`/login; no new config surface |

## 8. Edge cases

| Case | Input / state | Expected behavior | Covers |
|--|--|--|--|
| No header | request without `Authorization` | 401 `MissingTokenError` | AC2 |
| Malformed header | `Authorization: Basic xyz`, or `Bearer` with no token | 401 `MissingTokenError` | AC2 |
| Valid token | `Bearer <valid, unexpired, has sub>` | 200; `req.auth.userId` = `sub` | AC1 |
| Expired token | `Bearer <valid signature, exp in past>` | 401 `TokenExpiredError` | AC3 |
| Tampered / wrong secret | `Bearer <bad signature>` | 401 `InvalidTokenError` | AC4 |
| Unreadable token | `Bearer not-a-jwt` | 401 `InvalidTokenError` | AC4 |
| No identity | `Bearer <valid signature, no sub>` | rejected as `InvalidTokenError` | AC5 |

## 9. Traceability

| Spec item (V#/E#/AC#/field) | Plan element(s) |
| --------------------------- | --------------- |
| field: authentication token | `Authorization: Bearer <token>` parsed by `requireAuthMiddleware` |
| field: caller identity | `ValidateTokenResponse { userId }` set on `req.auth` |
| V1 | `requireAuthMiddleware` header parse → E1 |
| V2 | `JwtTokenVerifier` signature check → E3 |
| V3 | `JwtTokenVerifier` `exp` check → E2 |
| V4 | `JwtTokenVerifier` `sub` presence → E3 |
| E1 | `MissingTokenError` → 401 (errorMiddleware) |
| E2 | `TokenExpiredError` → 401 (errorMiddleware) |
| E3 | `InvalidTokenError` → 401 (errorMiddleware) |
| AC1 | `JwtTokenVerifier` + `ValidateTokenUseCase` + `requireAuthMiddleware` (`req.auth`) |
| AC2 | `requireAuthMiddleware` + `MissingTokenError` branch |
| AC3 | `JwtTokenVerifier` expired mapping + `TokenExpiredError` branch |
| AC4 | `JwtTokenVerifier` invalid mapping + `InvalidTokenError` branch |
| AC5 | `JwtTokenVerifier` `sub`-absent → `InvalidTokenError` |
