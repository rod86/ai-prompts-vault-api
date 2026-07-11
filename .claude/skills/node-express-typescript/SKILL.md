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
import { validateMiddleware } from '../middleware/validateMiddleware.js';
import { requireAuthMiddleware } from '../middleware/requireAuthMiddleware.js';
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

## 6. Custom middleware

**Naming — the `Middleware` suffix.** A middleware's exported identifier ends with `Middleware` (`requireAuthMiddleware`, `validateMiddleware`, `notFoundMiddleware`, `errorMiddleware`) — this includes factories that *return* a middleware. Name a single-middleware file for its export (`middleware/requireAuthMiddleware.ts`); a module grouping closely related middleware may take a domain name (e.g. `middleware/error.ts` exporting `notFoundMiddleware` + `errorMiddleware`). This mirrors the `Handler` suffix on handlers (§4), so the two HTTP layers stay distinguishable by name alone.

### Validation factory — writes validated data onto a custom prop

Because `req.query` is read-only in v5, don't overwrite it; put parsed query on `req.validatedQuery`. On failure, `next(err)` — let the one error handler own the wire format.

```typescript
// middleware/validateMiddleware.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { BadRequestError } from '../shared/errors.js';

type Target = 'body' | 'params' | 'query';

export function validateMiddleware(schema: ZodType, target: Target = 'body'): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[target]);
        if (!result.success) return next(new BadRequestError('Validation failed', result.error.issues));
        if (target === 'query') req.validatedQuery = result.data; // query is read-only
        else req[target] = result.data;                          // body/params writable
        next();
    };
}
```

### Centralized error handler — the ONLY place that shapes error responses

Identified by having **exactly four params** `(err, req, res, next)` — TS needs all four even if `next` is unused. Type `err` as `unknown` and narrow with `instanceof`. Known operational errors → clean client message; unknown → log full detail, return generic 500 (never leak a stack trace in prod).

```typescript
// middleware/error.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import { config } from '../config/index.js';

export function notFoundMiddleware(req: Request, res: Response): void {
    res.status(404).json({ error: 'NotFound', message: `Cannot ${req.method} ${req.path}` });
}

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        res.status(err.status).json({ error: err.name, message: err.message, details: err.details });
        return;
    }
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'InternalServerError', message: config.isProd ? 'Something went wrong' : String(err) });
}
```

```typescript
// shared/errors.ts — typed error hierarchy carrying its own HTTP status
export abstract class AppError extends Error {
    abstract readonly status: number;
    constructor(message: string, public readonly details?: unknown) {
        super(message);
        this.name = new.target.name;
    }
}
export class BadRequestError extends AppError { readonly status = 400; }
export class NotFoundError extends AppError { readonly status = 404; }
export class UnauthorizedError extends AppError { readonly status = 401; }
```

This is why handlers don't need `try/catch`: they `throw new NotFoundError(...)` and the mapping to a status code + response shape happens in one place. Adding a domain-error→status branch means editing the error handler, not every handler.

## 7. Adding custom values to `req`

Attaching data in middleware (auth user, request id, validated payload) is idiomatic. Set it early; namespace carefully. Prefer a single `req.context` object if you attach many things.

```typescript
// middleware/requireAuthMiddleware.ts
export const requireAuthMiddleware: RequestHandler = (req, _res, next) => {
    const header = req.get('authorization');
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Missing token');
    req.user = verifyToken(header.slice(7)); // typed via declaration merge (§8)
    next();
};
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

Type errors as `unknown` in the error handler and narrow with `instanceof` — never assume `err` is an `Error`.

## 9. Testing the HTTP layer

The `createApp()`-vs-listen split (§1) is what makes this cheap: import the app object into an HTTP-assertion library and drive real requests without binding a port. A few generic pointers:

- **Test through the app, not around it.** Send real requests to the app instance so routing, middleware order, validation, and the error handler all run — that's what you're actually shipping. Calling a handler function directly skips the middleware chain and gives false confidence.
- **Assert status *and* body shape.** Check the HTTP status code and the response envelope (including your error shape), not just the happy path.
- **Cover the error paths explicitly.** Add cases for validation failures (400), not-found (404), and auth failures (401) — these exercise the middleware and central error handler, the parts most likely to regress.
- **Keep the app pure and inject dependencies.** Because `createApp()` takes its collaborators (DB, clients) as arguments, tests supply fakes/in-memory versions instead of reaching for real infrastructure — fast, deterministic, no network.
- **Don't leak state between tests.** Reset or isolate any shared state (in-memory stores, mocks) between cases so order can't affect outcomes.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `app.listen()` in the same module you import in tests | Split `createApp()` from the server/bootstrap module |
| No error handler / no 404 → Express returns default HTML, leaks stack | Register `notFoundMiddleware` then `errorMiddleware` **last** |
| `try/catch → next(err)` in every async handler | Just `throw` (Express 5 auto-forwards); map errors once in the handler |
| Domain-error→status mapping copy-pasted per handler | Centralize in the error handler; throw typed `AppError`s |
| Reading `process.env` throughout; secret defaults to `''` | One validated frozen `config`; fail fast on missing/invalid env |
| Reassigning `req.query` (read-only in v5) | Store parsed query on `req.validatedQuery` |
| `(req as any).user` casts | Declaration-merge `Express.Request` once |
| Parallel Zod schema + hand-written interface drift apart | `z.infer` the type from the schema |
| Auth middleware applied globally, blocking public routes | Apply auth at route/router level |

## Express 5 gotchas

- Removed aliases: `app.del`, `res.sendfile`, `res.json(obj, status)`, `app.router`.
- `throw` works in **async** middleware; for **sync** middleware still use `next(err)`.
- Bare `*` and `:id?` route paths throw at startup — migrate to `/*splat` and `{/:id}`.
