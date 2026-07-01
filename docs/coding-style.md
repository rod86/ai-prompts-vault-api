# Coding Style

Stack: Node + TypeScript REST API (Express). This is the authoritative style guide.
Enforced by ESLint + Prettier. `npm run lint` is the source of truth and must pass before any change is done.

Principle: **strict, small, explicit.** When in doubt, pick the simplest, most maintainable option.

## TypeScript

- `strict` mode always on. Never weaken `tsconfig.json` to make code compile.
- Banned (build fails): `any`, non-null assertions (`x!`), `@ts-ignore`, `@ts-expect-error`.
- Use `unknown` + narrowing instead of `any`, or model the type properly.
- Prefer `type` aliases and **discriminated unions** over loose objects.
- Treat data as `readonly` by default. Copy, don't mutate.
- Model missing values explicitly as `T | undefined`. Handle the null/undefined case, never fake it with `!`.
- No need to type when type inference is available (e. g. `const app = express()`)

## Naming

- `PascalCase`: types, classes, entities (`Prompt`, `PromptId`).
- `camelCase`: variables, functions (`createPrompt`, `promptRepository`).
- Use-case files are verbs: `CreatePrompt.ts`, `ListPrompts.ts`.
- `Interface` suffix on ports/interfaces, prefixed by the entity they serve:
  `PromptRepositoryInterface`, `PromptCategoryRepositoryInterface`.
- Names reveal intent. A good name removes the need for a comment.

## Functions & Clean Code

- Small and single-responsibility. If you need "and" to describe it, split it.
- **Early returns** over nested `if`/`else`.
- No flag/boolean args. Split into two functions or pass a named-options object.
- No magic numbers/strings. Name them as constants.
- Domain functions are **pure**: no I/O, clock, or randomness. Inject those.
- Do not write detailed code comments.

## Error Handling

- Throw **domain-specific error classes** (e.g. `PromptNotFoundError`), never raw strings or bare `Error`.
- Map domain errors to HTTP status codes in **one** place (the error-handling middleware), not in controllers.
- No swallowed catches. Handle or re-throw, never empty `catch {}`.

## Validation

- Validate all external input with **Zod at the HTTP boundary** before it reaches application logic.
- Only the parsed (typed) value flows inward. Never pass raw `req.body` past the controller.

## Imports

- Use path aliases `@src/*` and `@logic/*`, not long relative chains.
- Order: builtin then external then internal then parent/sibling (auto-fixed by `import/order`).
- No deep cross-context reach-ins. Import a context's public surface, not its inner files (`eslint-plugin-boundaries`).

## Formatting & Commits

- **Prettier** owns formatting: 4-space indent, single quotes, trailing commas, 100-col width. Don't hand-format.
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.