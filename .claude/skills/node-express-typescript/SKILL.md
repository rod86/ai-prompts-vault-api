---
name: node-express-typescript
description: Use when building, structuring, or reviewing a Node.js Express 5 API in TypeScript — deciding how to organize app bootstrapping, routes/routers, controllers/handlers, middleware ordering, request validation, centralized error handling, env/config loading, or how to type custom properties added to req (req.user, validated data). Applies to Express 5 (Node 18+) with strict TypeScript.
---

# Node + Express 5 + TypeScript — Application Structure

## Overview

How to organize the framework-coupled layer of an Express 5 + TypeScript API: app boot, routes, handlers, middleware, config, and typing. **Core principle: the HTTP layer only translates between the wire and your services — parse/validate in, shape response out. Business logic never lives in a handler or middleware.**

Express 5 (Node 18+) changes three things that drive this structure:
- **Async errors auto-forward.** A rejected promise from an `async` handler/middleware goes to the error handler automatically. No `try/catch → next(err)` boilerplate.
- **`req.query` is a read-only getter.** Validated/coerced query data must live on a *different* property.
- **Path matching rewritten.** Bare `*` and `:id?` are gone; use `/*splat` and `{/:id}`.

Assumes `"strict": true` and `@types/express@^5`. Examples use Zod as the schema validator, but every pattern here applies to any validation library and any way of organizing your business-logic layer — this skill only covers the HTTP-coupled part.

## When to Use

- Starting a new Express+TS service, or reviewing/refactoring an existing one's HTTP layer.
- Deciding where routes, controllers, middleware, config, and error handling should live.
- Adding a custom property to `req` (auth user, request id, validated payload) and TypeScript rejects it.
- Migrating an app from Express 4 to 5.

**Not for:** business/domain logic organization (that's a services/DDD concern), ORM/database design, or non-Express Node servers.

## Project structure

A layout that keeps the HTTP-coupled layer thin and the business logic decoupled. Names are conventions — adapt them, but keep the *boundaries*.

```
src/
  routes/               # per feature: express.Router() + its request-validation schema(s) (§4)
  handlers/             # Express route handlers, grouped by resource; import inferred types from routes/*.schema.ts (§4)
  middleware/           # Express middleware
  shared/               # cross-cutting HTTP helpers: error classes, logger (§6)
  config/
    index.ts            # env vars parsed + validated once into a typed, frozen object (§2)
    services.ts         # composition root: instantiate + wire shared services/clients (§2)
  types/                # ambient type augmentations, e.g. express.d.ts (§8)
  app.ts                # HTTP app: security → parsers → routes → 404 → error handler (no listen) (§1)
  server.ts             # bootstrap: async init (DB), listen, graceful shutdown (§1)
  libs/                 # Application business logic, decoupled from Express (name it libs/, modules/, services/, ...)
```

Two things are non-negotiable regardless of naming: the **HTTP layer** (`routes` — routers + their validation schemas, `handlers`, `middleware`, `app.ts`, `server.ts`) only translates HTTP ↔ services, and the **business logic** lives behind a composition root. Whether you keep these as flat top-level folders or co-locate them per feature folder (`users/users.routes.ts` + `.handlers.ts` + `.schema.ts`) is a portable choice — both work; pick one and stay consistent.

## Quick Reference — Do / Don't

| Do | Don't |
|----|-------|
| Split `createApp()` (build) from server bootstrap (listen) | Call `app.listen()` in the module you import in tests |
| Validate env once into a frozen, typed `config` object | Read `process.env.X` deep in the code, or default a secret to `''` |
| `throw` typed errors in async handlers (v5 auto-forwards) | Wrap every handler in `try/catch → next(err)` |
| Exactly one error handler + one 404 handler, registered **last** | Send error responses from scattered handlers/middleware |
| `express.Router()` per feature; aggregate into an api router | Inline every route on the root `app` |
| Declaration-merge `Express.Request` for custom props | `(req as any).user` casts everywhere |
| Store validated query on `req.validatedQuery` (or a context obj) | Reassign `req.query` (read-only in v5) |
| Infer TS types from Zod schemas (`z.infer`) | Hand-maintain parallel interfaces + schemas |
| Fail fast at boot; graceful shutdown on SIGTERM/SIGINT | Boot half-configured; drop in-flight requests on deploy |

## 1. App boot — separate app from server

`createApp()` builds a pure, side-effect-free app you can import into Supertest without opening a port. Listening + process lifecycle is a *separate* module.

```typescript
// app.ts — construction only
import express, { type Express } from 'express';
import helmet from 'helmet';
import { apiRouter } from './routes/index.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.js';

export function createApp(): Express {
    const app = express();
    app.disable('x-powered-by');
    app.use(helmet());                       // security headers first
    app.use(express.json({ limit: '1mb' })); // explicit body-size limit
    app.use('/api', apiRouter);              // routes
    app.use(notFoundMiddleware);                // 404 — after all routes
    app.use(errorMiddleware);                   // error handler — ALWAYS last
    return app;
}
```

```typescript
// server.ts — lifecycle only. Async init BEFORE listen; graceful shutdown.
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, closeDatabase } from './config/services.js';

async function bootstrap(): Promise<void> {
    await connectDatabase();                // §3: verify DB is reachable before serving — fail fast
    const app = createApp();
    const server = app.listen(config.port);

    const shutdown = (): void => {
        server.close(() => {
            void closeDatabase().then(() => process.exit(0)); // close pool AFTER in-flight requests drain
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}
void bootstrap();
```

**Rules:** validate config *before* `listen()` (fail fast); keep `createApp()` synchronous and dependency-injectable so tests pass fakes; always drain on `SIGTERM` (containers send it on every deploy).

## 2. Config — parse env once, at the edge

Read `process.env` in **exactly one module**, validate + coerce + freeze into a typed object. Everywhere else imports `config` and gets real `number`/`enum` types, not `string | undefined`.

```typescript
// config/index.ts
import { z } from 'zod';

const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000), // env is always string → coerce
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),                          // never default a secret to ''
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment:', z.treeifyError(parsed.error));
    process.exit(1); // fail fast — do NOT boot half-configured
}

export const config = Object.freeze({
    env: parsed.data.NODE_ENV,
    isProd: parsed.data.NODE_ENV === 'production',
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    jwtSecret: parsed.data.JWT_SECRET,
});
```

Commit a `.env.example` documenting required keys; load real secrets from the platform (Docker/K8s/SSM) in prod. Keep config pure env — don't fold persistence concerns (e.g. an aggregated ORM schema) into it.

### Composition root — one place that wires the services

When the HTTP layer needs shared service/adapter **instances** (a DB client, use cases, external clients), assemble them in a single composition-root file — `config/services.ts` — and have handlers/middleware import ready-made instances from there instead of `new`-ing dependencies inline. This keeps wiring in one spot and swappable (real vs. fake) for testing.

```typescript
// config/services.ts — instantiate + wire once; export the instances
import { config } from './index.js';

// `db` is the shared DB client created in this same file (§3 shows the pool + lifecycle)
export const usersService = new UsersService(db);
// ...other services
```

Keep it separate from `config/index.ts`: env parsing and instance wiring are different jobs that happen to share the `config/` directory. Prefer passing these instances into `createApp()` (§1) so tests can substitute fakes.

## 3. Database connection management

The database lives in your business-logic layer, but its **connection lifecycle** is an app-boot concern — so it belongs in this skill. This is ORM-agnostic: "pool/client" means whatever your driver or ORM exposes.

Create **one shared connection pool per process**, in the composition root (§2), and reuse it for every request. Verify it at boot and close it on shutdown, both wired into the lifecycle from §1:

```typescript
// config/services.ts — one pool for the whole process, created once
const pool = createPool({ url: config.databaseUrl, max: 10 });
export const db = createClient(pool, schema);              // the shared client the services above are wired on (§2)

export const connectDatabase = (): Promise<void> => pool.query('SELECT 1').then(() => undefined); // verify at boot
export const closeDatabase = (): Promise<void> => pool.end();                                      // drain on shutdown
```

- **Bootstrap:** `await connectDatabase()` *before* `listen()` — fail fast if the DB is unreachable rather than discovering it on the first request.
- **Shutdown:** call `closeDatabase()` *after* `server.close()` so in-flight queries finish first.
- **Injection:** services receive the client from the composition root; handlers and middleware never open connections or query the DB directly — they call the service layer.

**Best practices**
- One pool, created once, reused — sized with sane `max`/timeout limits for your deployment.
- Keep credentials in the typed `config` (§2); never hardcode or log a connection string.
- Run migrations as a **deliberate, separate step** (a command/CI job), not automatically on app startup.

**Typical flaws**
- **New connection/pool per request** → connection exhaustion under load; the most common failure.
- **Lazy connect on first request** → no fail-fast, cold-start latency, errors surface late in production.
- **Never closing the pool** → hung shutdowns, leaked connections, dropped queries on every deploy.
- **A global db singleton reached into from handlers** → hidden coupling, hard to substitute a fake in tests.
- **Blocking/synchronous DB work in the request path** → stalls the event loop for every request.

**Organizing schema at the express level.** If your ORM needs a single aggregated schema/model registry, assemble it in **one** module alongside the DB wiring (composition/infrastructure layer) and pass it to the client there — never scatter it across call sites, and never fold it into `config/index.ts` (keep env config pure). The HTTP layer imports the ready-made client, not the schema.

## 4. Routes & handlers

**One `Router()` per feature/resource**, composed into an api router. Routers are thin: URL → middleware → handler.

```typescript
// routes/users.routes.ts
import { Router } from 'express';
import validateMiddleware from '../middleware/validateMiddleware.js';
import requireAuthMiddleware from '../middleware/requireAuthMiddleware.js';
import { listUsersHandler, createUserHandler, getUserHandler } from '../handlers/users.js';
import { CreateUserSchema, UserParamsSchema } from './users.schema.js'; // schema co-located with the router

export const usersRouter = Router();
usersRouter.get('/', requireAuthMiddleware, listUsersHandler);
usersRouter.post('/', requireAuthMiddleware, validateMiddleware(CreateUserSchema), createUserHandler);
usersRouter.get('/:id', validateMiddleware(UserParamsSchema, 'params'), getUserHandler);
```

**Keep handlers thin — no business logic in them.** A handler reads already-validated input, delegates to a decoupled service/use-case layer, and shapes the response. *How* that layer is organized (services, use cases, hexagonal/DDD) is out of scope here — see your business-logic architecture skill. This skill only asks one thing of you: keep that logic **out of the route handler** so the HTTP layer stays a thin, testable translator.

Two Express 5 mechanics do belong in the handler:
- **Just `throw`** typed errors — v5 forwards rejected async promises to the error handler, so no `try/catch`.
- **Always end the handler** (send a response or `next()`), and return `void`/`Promise<void>`, not the `res` object.

```typescript
// NO try/catch needed — the thrown error reaches the central error handler
export async function getUserHandler(req: Request, res: Response): Promise<void> {
    const user = await usersService.findById(req.params.id); // delegate to your service layer
    if (!user) throw new NotFoundError(`User ${req.params.id} not found`);
    res.json(user);
}
```

**Naming — the `Handler` suffix.** A handler's identifier ends with `Handler` (`listUsersHandler`, `createUserHandler`, `getUserHandler`), and a single-handler file is named for its export (`handlers/users/getUserHandler.ts`). This makes the HTTP layer scannable at a glance and pairs with the `Middleware` suffix that middleware carry (§6). Routers are exempt — they keep a `Router`/resource name (`usersRouter`, `apiRouter`).

**Export form depends on file layout.** A folder-per-resource file holding exactly one handler (`handlers/users/getUserHandler.ts`) uses `export default` — declare the const first, then `export default getUserHandler`, so the router imports it as `import getUserHandler from '../handlers/users/getUserHandler.js'`. A file-per-resource file holding several handlers (`handlers/users.ts`) must use named exports instead, since a module can only have one default export.

**Group by resource, mirroring `routes/`.** The router and its validation schema(s) live together under `routes/` — `routes/posts.routes.ts` + `routes/posts.schema.ts` (the latter exporting `CreatePostSchema`, `UpdatePostSchema`, ...) — and handlers group the same way: `handlers/posts.ts` exporting `listPostsHandler`, `createPostHandler`, ..., or a folder per resource (`handlers/posts/listPostsHandler.ts`, `createPostHandler.ts`) once they grow. Never split a single resource across unrelated files, and never mix two resources in one file: everything lines up by name — `routes/posts.routes.ts` + `routes/posts.schema.ts` ↔ `handlers/posts*`. Because the schema is the single source of truth for a route's shape, both the router (runtime `validateMiddleware(...)`) and the handler (`z.infer` types, §8) import it from `routes/`. Pick file-per-resource *or* folder-per-resource and apply it consistently.

**Express 5 path changes:** `/files/*` → `/files/*splat` (value in `req.params.splat`); `/users/:id?` → `/users{/:id}`.

## 5. Middleware ordering — this is the whole game

Runs top-to-bottom. Correct order, and **why cheap-before-expensive matters**:

```
1. Security / observability   → helmet, request-id, logger
2. Body parsers               → express.json
3. Cross-cutting              → cors, rate-limit, compression
4. Auth                       → route/router-level, NOT global
5. Routes
6. 404 handler                → notFoundMiddleware (after all routes)
7. Error handler              → errorMiddleware (LAST, 4 args)
```

**Scope middleware as narrowly as possible** — apply auth per-route so public endpoints stay public; only genuinely cross-cutting concerns go global. Put cheap rejections (rate-limit, auth) before expensive work. Never block the event loop with heavy sync work. **A middleware either calls `next()` or sends a response — never both, never neither** (forgetting `next()` hangs the request).

**Exempting specific routes from a global middleware.** A cross-cutting middleware (rate-limiting, auth) doesn't have to special-case routes internally — mount the routes that should skip it *before* it in the chain instead (e.g. static assets, a generated API description). Order is the exemption mechanism; the middleware itself stays generic.

## 6. Custom middleware

**Naming — the `Middleware` suffix.** A middleware's identifier ends with `Middleware` (`requireAuthMiddleware`, `validateMiddleware`, `notFoundMiddleware`, `errorMiddleware`) — this includes factories that *return* a middleware. Name a single-middleware file for its export (`middleware/requireAuthMiddleware.ts`); a module grouping closely related middleware may take a domain name (e.g. `middleware/error.ts` exporting `notFoundMiddleware` + `errorMiddleware`). This mirrors the `Handler` suffix on handlers (§4), so the two HTTP layers stay distinguishable by name alone.

**Export form mirrors handlers (§4).** A single-middleware file (`middleware/requireAuthMiddleware.ts`, `middleware/validateMiddleware.ts`) uses `export default` — declare the const/function, then `export default requireAuthMiddleware`. A file grouping several middleware (`middleware/error.ts` exporting `notFoundMiddleware` + `errorMiddleware`) keeps named exports, since a module allows only one default export.

### Validation factory — writes validated data onto a custom prop

Because `req.query` is read-only in v5, don't overwrite it; put parsed query on `req.validatedQuery`. On failure, `next(err)` — let the one error handler own the wire format. Carry the schema issues on the thrown error (grouped however your project's `details` shape needs — see §9) so the error handler can render them (`ValidationError` below).

```typescript
// middleware/validateMiddleware.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../shared/errors.js';

type Target = 'body' | 'params' | 'query';

function validateMiddleware(schema: ZodType, target: Target = 'body'): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[target]);
        if (!result.success) {
            const errors = result.error.issues.map((issue) => ({
                field: `${target}.${issue.path.join('.')}`, // e.g. body.email, params.id
                error: issue.message,                       // the schema's own message
            }));
            return next(new ValidationError(errors));
        }
        if (target === 'query') req.validatedQuery = result.data; // query is read-only
        else req[target] = result.data;                          // body/params writable
        next();
    };
}

export default validateMiddleware;
```

### Centralized error handler — the ONLY place that shapes error responses

Identified by having **exactly four params** `(err, req, res, next)` — TS needs all four even if `next` is unused. Type `err` as `unknown` and narrow with `instanceof`. Every error response shares **one envelope**: `{ status, code, message }`. `status` in the body always mirrors the response's transport status; `code` is a stable, client-facing identifier that must never change when an internal class is renamed. **One deliberate exception**: a request-validation failure additionally carries `details` (a nested, field-level breakdown) — the only error that ever gets a fourth property; every other error, including an unknown route (404) and an unexpected/technical failure (500), still fits the three-field envelope.

Business errors don't carry their own HTTP status — that would leak a transport concern into the domain. Instead each extends a shared `DomainError` base (owned by your business-logic/DDD layer; see that skill for the base class and subclassing rules) carrying a `code` and a `category` — a small closed outcome-family set (`NotFound` / `Forbidden` / `Unauthorized` / `Unprocessable`, extend as your domain needs). The HTTP layer alone knows about status codes, so it alone maps `category → status`, through a near-static lookup table:

```typescript
// middleware/domainErrorStatus.ts
import { type ErrorCategory } from '../shared/domain/DomainError.js';

export const CATEGORY_STATUS = {
    NotFound: 404,
    Forbidden: 403,
    Unauthorized: 401,
    Unprocessable: 422,
} satisfies Record<ErrorCategory, number>;
```

```typescript
// middleware/error.ts
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../shared/errors.js';
import { DomainError } from '../shared/domain/DomainError.js';
import { CATEGORY_STATUS } from './domainErrorStatus.js';

export function notFoundMiddleware(req: Request, res: Response): void {
    res.status(404).json({ status: 404, code: 'NOT_FOUND', message: `Cannot ${req.method} ${req.path}` });
}

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof ValidationError) {                          // the one branch that adds `details`
        res.status(400).json({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.details,                                 // shape is a project choice — see §9
        });
        return;
    }
    if (err instanceof DomainError) {
        const status = CATEGORY_STATUS[err.category];
        res.status(status).json({ status, code: err.code, message: err.message });
        return;
    }
    console.error(err);                                           // record the real cause server-side...
    res.status(500).json({ status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' }); // ...never send it
}
```

This is why handlers don't need `try/catch`: they `throw new OrderNotFoundError(...)` and the mapping to a status + envelope happens in exactly one place. Adding a business error that reuses an existing `category` needs **zero** middleware edits — only its own file under `domain/errors/`; adding a genuinely new outcome family means adding one row to `CATEGORY_STATUS`. The generic fallback branch is the security boundary: it must never forward `err.message`, `err.stack`, or a wrapped `cause` to the client, only the fixed `INTERNAL_ERROR` code and message — swap `console.error` for your logger, but always log the real error server-side so it stays diagnosable.

#### `ApiError` — controlled boundary failures (not business errors)

Business errors (`DomainError` subclasses) model outcomes from the business-logic layer; a **boundary** failure — invalid request data, an exhausted rate limit, an unknown route — is detected in Express middleware itself, before any business logic runs. Model these with one concrete `ApiError(status, code, message, details?)`, thrown or forwarded inline at the exact point of detection, and add a single `instanceof ApiError` branch to the centralized handler (before the `DomainError` branch) that renders `{ status, code, message }`, spreading in `details` only when it is not `null`/`undefined`:

```typescript
// errors/ApiError.ts
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details?: unknown,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}
```

```typescript
if (err instanceof ApiError) {
    res.status(err.status).json({
        status: err.status,
        code: err.code,
        message: err.message,
        ...(err.details != null && { details: err.details }),
    });
    return;
}
```

`details` is passed only for request-validation failures — every other `ApiError` throw site omits it. `status` stays a plain `number`, never `500`: `ApiError` is for *controlled* 4xx failures; an unexpected/technical failure is thrown raw (or left unwrapped) so it falls through to the generic branch instead. While a `code` has exactly one throw site, an inline tuple at that call site is fine; if a code ever needs a second throw site, extract a static factory (e.g. `ApiError.rateLimited()`) instead of duplicating the tuple.

## 7. Adding custom values to `req`

Attaching data in middleware (auth user, request id, validated payload) is idiomatic. Set it early; namespace carefully. Prefer a single `req.context` object if you attach many things.

```typescript
// middleware/requireAuthMiddleware.ts
const requireAuthMiddleware: RequestHandler = (req, _res, next) => {
    const header = req.get('authorization');
    // sync middleware: forward with next(err), don't throw (v5 only auto-forwards async throws — see gotchas)
    if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError('Missing token'));
    req.user = verifyToken(header.slice(7)); // typed via declaration merge (§8)
    next();
};

export default requireAuthMiddleware;
```

## 8. TypeScript — typing custom props & handlers

**Declaration-merge** the global `Express.Request` in a `.d.ts` that tsconfig includes; make the file a module (add `import`/`export`) so `declare global` works. This types `req.user` etc. everywhere with **no casting**.

```typescript
// types/express.d.ts
import 'express'; // makes this file a module

export interface AuthUser { id: string; email: string; roles: string[]; }

declare global {
    namespace Express {
        interface Request {
            id: string;
            user?: AuthUser;            // optional: only set after requireAuth
            validatedQuery?: unknown;   // set by validateMiddleware(schema, 'query')
        }
    }
}
```

**Single source of truth:** infer handler types from the Zod schema so validation and types can't drift. `RequestHandler` is generic `<Params, ResBody, ReqBody, Query>`:

```typescript
// routes/users.schema.ts — schema co-located with the router; also the source of the handler's types
export const CreateUserSchema = z.object({ email: z.string().email(), name: z.string().min(1) });
export type CreateUserBody = z.infer<typeof CreateUserSchema>;

// handlers/users.ts — validateMiddleware() guarantees the runtime shape; the generic makes the compiler agree
import type { CreateUserBody } from '../routes/users.schema.js'; // handlers import their types from routes/
export const createUserHandler: RequestHandler<unknown, UserResponse, CreateUserBody> = async (req, res) => {
    const { email, name } = req.body;      // typed as CreateUserBody
    res.status(201).json(await usersService.create({ email, name }));
};
```

**Wire casing is a project convention.** Pick one wire field casing (this project uses snake_case — `created_at`, `category_id`) and apply it to both request schemas and responses. When it differs from the domain object's shape, the handler maps domain→wire while shaping the response (the example above passes the object straight through only because the two happen to match). Response shaping is the handler's job (§4).

**The same inference works for responses, too.** A sibling response schema per route (e.g. `users.schema.ts` + `users.response.schema.ts`) lets you infer `ResBody` the same way you infer the request body — instead of hand-writing a `UserResponse` interface — and it composes with the pattern above: `RequestHandler<Params, ResBody, ReqBody>` typed from two schemas instead of one. Once responses are schema-derived, those same schemas can double as the source for a generated API description (e.g. an OpenAPI document) — the documentation and the runtime validation/typing can't drift apart because they're the same schema.

Type errors as `unknown` in the error handler and narrow with `instanceof` — never assume `err` is an `Error`.

## 9. Testing

### HTTP layer

The `createApp()`-vs-listen split (§1) is what makes this cheap: import the app object into an HTTP-assertion library and drive real requests without binding a port. A few generic pointers:

- **Test through the app, not around it.** Send real requests to the app instance so routing, middleware order, validation, and the error handler all run — that's what you're actually shipping. Calling a handler function directly skips the middleware chain and gives false confidence.
- **Assert status *and* body shape.** Check the HTTP status code and the response envelope (including your error shape), not just the happy path.
- **Cover the error paths explicitly.** Add cases for validation failures (400), not-found (404), and auth failures (401) — these exercise the middleware and central error handler, the parts most likely to regress.
- **Keep the app pure and inject dependencies.** Because `createApp()` takes its collaborators (DB, clients) as arguments, tests supply fakes/in-memory versions instead of reaching for real infrastructure — fast, deterministic, no network.
- **Don't leak state between tests.** Reset or isolate any shared state (in-memory stores, mocks) between cases so order can't affect outcomes.

### Custom Middleware

Drive a middleware through a **real app instance + HTTP-assertion library**, not mocked
`req`/`res`/`next`. Build a throwaway app inline, mount the middleware on a route with a
terminal handler, and assert on the HTTP result — no hand-rolled request/response doubles,
no calling the middleware directly with a fake `next`.

- **Success — assert the effect, not that `next()` fired.** A middleware that enriches the
  request (validated data, auth user, request id) proves it worked by the terminal handler
  seeing that data: echo the prop back and assert the body; reaching the handler *is* the
  "next() was called" check.
- **Failure — assert the whole response through the error handler, and that the handler is
  never reached.** Mount the error handler after the route and assert the complete wire result
  (status **and** full error body) in one exact match. Flip a `handlerReached` flag in the
  terminal handler and assert it stayed `false`, proving the chain short-circuited (§6).
- **Unit-test the pure core separately.** When the middleware delegates to a pure function,
  test that function directly (no app, no HTTP) and assert its full result there; the
  integration tests then need only one representative success and one failure.
- Build the app and inputs **inline per test** — no shared fixtures, no `beforeEach`.
- `describe` names the middleware; `it` states the guarantee as a sentence.
- Split by concern, mirroring `src/`: HTTP behavior in integration tests, pure logic in unit tests.

### Handlers

Test a handler **through the full app** (§1), one test file per handler, so routing, the
middleware chain, and the central error handler all run — never by calling the handler
directly (§9 `### HTTP layer`). A handler is thin (delegates to a use case/service, then
shapes the response — §4), so assert the *observable HTTP contract*, not internals. Seed and
clean fixtures per the DB lifecycle.

- **One representative success test pins the whole resource envelope.** In that single case
  assert status and the full resource with relations **assembled as nested objects**, not raw
  foreign-key ids, plus timestamp semantics (created timestamp preserved, updated timestamp
  bumped). This is the one test that owns the complete shape; every other test leans on it.
- **Every domain error path — assert the mapped status, code, and message.** The handler
  throws typed `DomainError`s (§6) that the central error handler maps by `category` to a
  status + envelope (e.g. not-found → 404, invalid reference → 4xx). Test each — the error
  handler is the most regression-prone seam.
- **Error precedence when several things are wrong.** Pin the deterministic order: when
  multiple inputs are invalid, only the first/most-significant error surfaces (e.g. a missing
  target wins over an invalid reference) — existence is checked before references.
- **No partial writes on failure.** After a rejected write, verify the row is untouched with a
  direct table read (not the resource's own read endpoint), proving the operation was atomic.
- **Optional/nullable fields — cover each distinct state.** Distinguish `null` (clears → absent
  from the response) from `''` (sets empty → present); test them separately — different states.
- **Every other test asserts only its own delta — never re-assert what's already covered.** A
  focused case (a single field's behavior, a category swap, an error path) checks only the
  value(s) that distinguish it and relies on the representative success test for the rest; don't
  restate the status, the whole envelope, or unrelated fields another test already pins. E.g. the
  `''`-vs-`null` description case asserts just the description — in the response body and via a
  direct row read — not the full envelope, timestamps, or category again.
- **On the representative success test, assert the exact response, not a partial one.** Use
  `toEqual` on the full body, not `toMatchObject`; an exact match proves both the fields present
  *and* the absence of others (a cleared field, a leaked internal field) in one assertion — never
  pair a partial match with a follow-up "does not have prop X" check. For nondeterministic values
  (a generated timestamp), keep the match exact with an asymmetric matcher (`expect.any(...)`).
- One integration file per handler, mirroring `src/`; always assert response body, never a bare
  status code. Request-validation cases belong in the request-validation section below, not here.

### Handler request validation

Add a nested `Request Validation` describe block to the **handler's own** test file — the
validation boundary is part of that route's contract.

The single aim of these cases: **assert only the field(s) the test exercises and their error
message(s) — nothing else.** Use a partial matcher so any field not under test (in both the
request and the response) is ignored, and don't re-assert the status code or the full error
envelope — those are pinned once by the middleware's own test (`### Custom Middleware`),
whatever wire shape your project uses for validation errors.

- **Cover every request part the route validates** — `body`, `params`, `query` — and make
  each case identify which part the failing field belongs to.
- **One test for all required-field messages.** Send an empty/incomplete payload and assert
  every required field's missing-value message together, in a single case.
- **One test per specific rule, in isolation.** Give each format/constraint rule (UUID, email,
  min length, …) its own case that triggers only that rule — send just the field that violates
  it and assert only that field's message, ignoring every other field. Keep the request minimal:
  include only what's needed to trigger the rule and omit every irrelevant field — when the rule
  is on a `params`/`query` field, the body carries nothing, so send an empty one (`.send({})`)
  rather than padding it with an otherwise-valid payload the case doesn't need.
- These cases short-circuit before the handler runs — no fixtures or side-effect checks needed.

The matcher and key path depend on your validation-error wire shape — match against just the
field(s) under test within it and never assert the whole envelope here. The shape is a project
choice, not prescribed by this skill: e.g. one entry of a `{ errors: [{ field, error }] }` list,
or one key of a grouped `{ details: { body: { <field>: <message> } } }` object — the guidance
above holds identically either way.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `app.listen()` in the same module you import in tests | Split `createApp()` from the server/bootstrap module |
| No error handler / no 404 → Express returns default HTML, leaks stack | Register `notFoundMiddleware` then `errorMiddleware` **last** |
| `try/catch → next(err)` in every async handler | Just `throw` (Express 5 auto-forwards); map errors once in the handler |
| Domain-error→status mapping copy-pasted per handler | Throw typed `DomainError`s classified by `category`; map `category → status` once, centrally |
| A domain error hardcodes its own HTTP status | Classify with `category` instead; only the HTTP layer knows about status codes |
| Reading `process.env` throughout; secret defaults to `''` | One validated frozen `config`; fail fast on missing/invalid env |
| Reassigning `req.query` (read-only in v5) | Store parsed query on `req.validatedQuery` |
| `(req as any).user` casts | Declaration-merge `Express.Request` once |
| Parallel Zod schema + hand-written interface drift apart | `z.infer` the type from the schema |
| Auth middleware applied globally, blocking public routes | Apply auth at route/router level |

## Express 5 gotchas

- Removed aliases: `app.del`, `res.sendfile`, `res.json(obj, status)`, `app.router`.
- `throw` works in **async** middleware; for **sync** middleware still use `next(err)`.
- Bare `*` and `:id?` route paths throw at startup — migrate to `/*splat` and `{/:id}`.
