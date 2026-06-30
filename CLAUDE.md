# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
nvm use            # match the Node version in .nvmrc (24.16.0)
npm install
npm run dev        # run the API with hot reload (tsx) on PORT (default 3000)
npm run build      # tsc -> dist/
npm start          # run compiled dist/index.js
npm test           # vitest run (single pass)
npm run lint       # eslint (includes hexagonal boundary enforcement)
npm run typecheck  # tsc --noEmit
```

Run a single test file or test by name:

```bash
npx vitest run tests/integration/health.test.ts
npx vitest run -t 'returns 200'        # filter by test name
npx vitest                              # watch mode
```

There are only the six npm scripts above by design — do not add more without reason.

## Before you start, read the docs

The authoritative details live in `docs/` and `specs/memory/`. Read the relevant file before working in that area:

- [docs/spec-driven.md](docs/spec-driven.md) — the spec-driven development workflow (the required process for all feature work, with a hard gate between planning and coding).
- [docs/architecture.md](docs/architecture.md) — hexagonal architecture, bounded contexts, layer/dependency rules, and the composition edges.
- [docs/coding-style.md](docs/coding-style.md) — coding conventions and rules.
- [docs/tests.md](docs/tests.md) — testing strategy.
- [specs/memory/constitution.md](specs/memory/constitution.md) — governing principles; read before changing conventions.
