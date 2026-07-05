---
name: hexagonal-architecture
description: Hexagonal (ports-and-adapters) architecture organized by bounded contexts — layers, the dependency rule, use cases, ports, entities, and composition wiring. Use when deciding where code belongs or mapping a spec onto the architecture. Library-agnostic; concrete framework/ORM patterns live in the project-stack skill.
---

# Hexagonal Architecture

Hexagonal architecture, organized by bounded contexts. Framework- and
library-agnostic: the concrete HTTP-framework, ORM, and validation patterns live
in the `project-stack` skill; testing lives in the `testing` skill.

## Structure

```
src/
  logic/                # business logic, hexagonal, per bounded context
    <context>/          # e.g. prompt/
      domain/           # business rules (framework-agnostic)
      application/      # use cases (orchestrate domain via ports)
      infrastructure/   # adapters (HTTP framework, DB ORM repositories, external I/O)
      services.ts       # context services configuration
    shared/             # code shared by 2+ contexts (e.g. DB client)
  config.ts             # loaded env vars + hardcoded params
  app.ts                # HTTP app: middleware + routes (no listen)
  index.ts              # composition root + server bootstrap
```

## Dependency Rule (enforced by boundary linting)

```
infrastructure  ->  application  ->  domain     (imports point inward only)
shared          <-  usable by any layer/context; imports from NO context
```

## Config Parameters (`src/config.ts`)

Holds config params and loaded `.env` vars.
Hardcode non-sensitive values (e.g. default AI model).
Load sensitive values from env (e.g. API key).
`process.env` access is allowed ONLY here.
Importable ONLY by `app.ts`, `index.ts`, and context `services.ts` files.

**Example config object**

```typescript
export default {
    port: process.env.PORT ?? 3000,
    environment: process.env.ENVIRONMENT ?? 'development',
};
```

## HTTP adapter (inbound)

- **Ordering:** leading global middleware (e.g. auth) → routes + per-route
  middleware (e.g. body validation) → trailing global middleware (404 handler,
  error handler).
- **Handlers/middleware:** one function per file, default export for handlers;
  never inline in `app.ts`.
- Handlers and middleware reach business logic ONLY via a context's
  `services.ts`, never importing a use case, adapter, or config directly:
  `Handler/Middleware -> service (services.ts) -> Application UseCase`.

Concrete framework skeletons: see the `project-stack` skill.

## Business Logic (`src/logic`)

Three layers per context: `domain`, `application`, `infrastructure`.

### Application (`<context>/application`)

One use case per meaningful operation. Each file is self-contained: `Query`,
`Response`, and the use case class.

```typescript
export interface CreatePromptQuery {
    id: string;
    title: string;
    prompt: string;
    createdAt: Date;
}

export interface CreatePromptResponse {
    id: string;
    title: string;
}

export class CreatePromptUseCase {
    constructor(private readonly service: PromptRepositoryInterface) {}
    public async invoke(request: CreatePromptQuery): Promise<CreatePromptResponse> {
        // ...
    }
}
```

Rules:

- Class suffixed `UseCase`; filename equals class name.
- Input interface suffixed `Query`, output interface suffixed `Response`. Omit
  either if unneeded.
- Query/Response use only native types (string, number, array, Date, ...). No
  custom logic types.
- Orchestrates domain objects, reaches the outside world ONLY through ports.
- Handles flow + transactions. Contains no framework or library code.
- Port implementations injected via the constructor.

### Domain (`<context>/domain`)

Entities, interfaces, errors. Framework-agnostic.

**Entities** (domain root folder, simple TypeScript interfaces):

```typescript
// src/logic/prompt/domain/Prompt.ts
export type PromptCategory = 'backend' | 'frontend' | 'devops';
export interface Prompt {
    id: string;
    category: PromptCategory;
    title: string;
    prompt: string;
    createdAt: Date;
    updatedAt: Date;
}
```

**Interfaces (`<context>/domain/interfaces`):** ports the inner layers depend
on. Name must NOT reference a source (no Database, AWS, etc.).

```typescript
// src/logic/prompt/domain/interfaces/PromptRepositoryInterface.ts
import { Prompt } from '@logic/prompt/domain/Prompt';
export default interface PromptRepositoryInterface {
    create(prompt: Prompt): Promise<void>;
    findAll(): Promise<Prompt[]>;
    findById(id: string): Promise<Prompt>;
}
```

**Errors (`<context>/domain/errors`):** custom errors thrown by use cases.

```typescript
export default class CreatePromptError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CreatePromptError';
        Object.setPrototypeOf(this, CreatePromptError.prototype);
    }
}
```

### Infrastructure (`<context>/infrastructure`)

Adapters. The ONLY place frameworks and libraries appear. Implements domain
ports with no inner-layer changes when swapped.
Never create InMemory adapters (e.g. `InMemoryPromptsRepository`). Defer that
class or ask the user.

## Shared (`src/logic/shared`)

Cross-context code only (Result type, base error, shared value objects).

- Used by a single context? It belongs to that context, not here.
- Keep small and dependency-light. Must not import from any context.
- When in doubt, leave it out (duplication is cheaper than a wrong abstraction).

### Services (`<context>/services.ts`)

Wires infrastructure adapters and exposes the context's use cases for use
outside `logic`. Same pattern for the shared context.

```typescript
const promptRepository = new /* concrete adapter */ Repository(databaseClient);
export const createPromptUseCase = new CreatePromptUseCase(promptRepository);
```

Concrete wiring (with the real ORM adapter and DB client) is in the
`project-stack` skill.
