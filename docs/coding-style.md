# Coding Style

Generic coding rules for the whole codebase. This is the authoritative style
guide referenced by the [constitution](../specs/memory/constitution.md §7).
Layer-specific rules live in [`architecture.md`](./architecture.md); test style
lives in [`tests.md`](./tests.md).

The short version: **strict, small, explicit.** Most of this is enforced by
ESLint and Prettier — `npm run lint` is the source of truth.

---

## General

- Do not comment in detail code
- In case of doubt, choose the simplest and most maintainable option

## TypeScript

**Not allowed** (ESLint will fail the build):

- `any` — use `unknown` and narrow it, or model the type properly.
- Non-null assertions (`value!`) — handle the `undefined`/`null` case.
- `@ts-ignore` / `@ts-expect-error` to silence real type errors.

**Required / preferred:**

- `strict` mode stays on. Never weaken `tsconfig.json` to make code compile.
- Prefer `type` aliases and **discriminated unions** over loose objects.
- Treat data as `readonly` by default; copy instead of mutating.
- Model "maybe missing" explicitly (`T | undefined`), don't fake it with `!`.

```ts
// ❌ not allowed
function getTitle(p: any) {
  return p.title!;
}

// ✅
function getTitle(p: { title: string }): string {
  return p.title;
}
```

---

## Naming

- `PascalCase` for types, classes, and entities (`Prompt`, `PromptId`).
- `camelCase` for variables and functions (`createPrompt`, `promptRepository`).
- **Use-case files are named as verbs:** `CreatePrompt.ts`, `ListPrompts.ts`.
- **Ports/interfaces have no `I` prefix:** `PromptRepository`, not
  `IPromptRepository`.
- Names reveal intent. A good name removes the need for a comment.

---

## Functions & Clean Code

- Small and single-responsibility. If you need "and" to describe it, split it.
- **Early returns** over nested `if`/`else`.
- **No flag/boolean arguments** — split into two functions or pass an options
  object with named fields.
- **No magic numbers/strings** — name them as constants.
- Domain functions are **pure**: no I/O, no clock, no randomness; pass those in.

```ts
// ❌ flag argument, nesting
function save(prompt: Prompt, validate: boolean) {
  if (validate) {
    if (prompt.title) {
      /* ... */
    }
  }
}

// ✅ early return, no flag
function saveValidated(prompt: Prompt): void {
  if (!prompt.title) return;
  // ...
}
```

---

## Error Handling

- Throw **domain-specific error classes** (e.g. `PromptNotFoundError`), never raw
  strings or bare `Error`.
- Map domain errors to HTTP status codes in **one** place (the error-handling
  middleware), not scattered across controllers.
- **No swallowed catches.** If you catch, you handle or re-throw — never an empty
  `catch {}`.

```ts
// ❌
throw 'prompt not found';

// ✅
export class PromptNotFoundError extends Error {
  constructor(id: string) {
    super(`Prompt ${id} not found`);
    this.name = 'PromptNotFoundError';
  }
}
```

---

## Validation

- All external input is validated with **Zod at the HTTP boundary** before it
  reaches application logic.
- The **parsed** (typed) value flows inward. Never pass unparsed `req.body`
  deeper than the controller.

---

## Imports

- Use the path aliases — `@src/*` and `@logic/*` — instead of long relative
  chains.
- Keep imports ordered: builtin → external → internal → parent/sibling
  (auto-fixable via `import/order`).
- No deep cross-context reach-ins: a context imports another context's public
  surface, not its inner files. (Enforced by `eslint-plugin-boundaries`.)

---

## Formatting & Commits

- **Prettier** owns formatting (2-space indent, single quotes, trailing commas,
  100-col width). Don't hand-format against it.
- `npm run lint` must be clean before a change is done.
- **Conventional Commits** for messages: `feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`.
