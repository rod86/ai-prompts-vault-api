---
name: coding-style
description: TypeScript coding conventions — strictness, naming, clean-code, error handling, validation, and imports. Use when writing or reviewing any TypeScript code.
---

# TypeScript Coding Style

Conventions for TypeScript projects. Enforced by the linter/formatter;
the lint command must pass before any change is done.

Principle: **strict, explicit, maintainable.** When in doubt, pick the simplest,
most maintainable option that follows TypeScript best practices.

## TypeScript

- `strict` mode always on. Never weaken `tsconfig.json` to make code compile.
- Banned (build fails): `any`, non-null assertions (`x!`), `@ts-ignore`.
- **Allowed with explanation**: `@ts-expect-error` — requires a comment explaining why the error is expected and when it can be removed.
- Use `unknown` + narrowing instead of `any`, or model the type properly.
- Use **explicit return types** on all exported functions, classes, and public methods. This improves documentation, prevents accidental API changes, and catches errors early.
- Use type inference for internal variables where the type is obvious (e.g., `const app = express()`).
- Prefer `interface` for **public APIs, contracts, and object shapes** that may be extended or implemented.
- Prefer `type` for **unions, intersections, mapped types, and utility types** that don't need declaration merging.
- Use TypeScript utility types (`Pick`, `Omit`, `Partial`, `Required`, `Readonly`, `ReturnType`, etc.) to derive types from existing ones, avoiding duplication.
- Treat data as immutable where it matters: use `readonly` on **public interfaces** and **entity/model classes** where modification shouldn't occur. Allow mutation in **private/internal state** where it simplifies code.
- Model missing values explicitly as `T | undefined`. Handle the null/undefined case, never fake it with `!`.
- Prefer `undefined` over `null`. Use `null` only when interacting with external APIs/libraries that require it.
- Use **discriminated unions** for state machines and polymorphic types.

## Naming

- `PascalCase`: types, interfaces, classes, enums (`User`, `UserId`, `UserRepository`).
- `camelCase`: variables, functions, methods, properties (`createUser`, `userRepository`).
- `UPPER_SNAKE_CASE`: constants (`MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE`).
- Use-case files are named after their class (a verb + `UseCase`): `CreateUserUseCase.ts`, `ListUsersUseCase.ts`.
- **Suffix interfaces with `Interface`** — name ports `<Domain><Role>Interface` (e.g. `UserRepositoryInterface`, `PasswordHasherInterface`) and their implementations `<Technology><Contract>` (e.g. `DrizzleUserRepository`, `BcryptPasswordHasher`). The `domain-driven-design` skill owns the full naming convention.
- Names reveal intent. A good name removes the need for a comment.
- Unused variables/args must be prefixed with `_` (the linter's `no-unused-vars` ignore pattern). When destructuring to discard a property, rename it to `_` via colon syntax rather than binding it under its original name: `const { categoryId: _, ...rest } = value;`.

## Functions & Clean Code

- Small and single-responsibility. If you need "and" to describe it, split it.
- **Early returns** over nested `if`/`else`.
- No flag/boolean args. Split into two functions or pass a named-options object.
- No magic numbers/strings. Name them as constants.
- Keep constants scoped to the smallest reasonable context. Use `private static readonly` if the constant is an implementation detail of that class; otherwise, module-level `const` is acceptable.
- Business logic should be **isolated from I/O, clock, and randomness**. Dependencies are injected via interfaces, making logic testable and pure in the sense of having no side effects.
- Do not write comments that explain **what** the code does. Use comments to explain **why** — business rules, design trade-offs, performance considerations, and non-obvious behavior.

## Error Handling

- Throw **named error classes** that extend `Error` (e.g., `NotFoundError`), never raw strings or bare `Error`. In a business-logic backend, extend a shared classifying base (`code` + `category`) instead of raw `Error` — see `domain-driven-design`.
- Map error **categories** to HTTP status codes in **one** place (the error-handling middleware), not in controllers, and not hardcoded on the error class itself — see `node-express-typescript`.
- No swallowed catches. Handle or re-throw, never empty `catch {}`.

## Validation

- **Boundary validation**: Validate all external input at the system boundary (HTTP, CLI, message queue) before it reaches application logic. Only the parsed (typed) value flows inward.
- **Invariant validation**: Entities/models should also validate their own invariants upon construction/mutation, independent of boundary validation. These may use different validation schemas tailored to those rules.
- Use a validation library (e.g., Zod, Yup, Joi) for schema-based validation.

## Async Code

- Prefer `async/await` for readability and error handling.
- Use `.catch()` only in rare cases where error handling differs from the main flow or when dealing with promise-based callbacks.
- Handle promise rejections explicitly — never let unhandled rejections reach production.

## Imports

- Use path aliases if configured in the project (see `tsconfig.json` paths), not long relative chains.
- Order: builtin → external → internal → parent → sibling → index, with **one blank line between groups**, and alphabetized (case-insensitive) within each group. Auto-fixed by the linter (`import/order`).
- No deep cross-module reach-ins. Import a module's public surface, not its inner files (enforced by boundary linting).

## Formatting & Commits

- The **formatter owns formatting** — don't hand-format. Use Prettier or an equivalent tool.
- Indentation: 2 spaces (TypeScript community standard), but the project's Prettier config (`.prettierrc.json`) is authoritative and overrides it — never hand-format.
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.