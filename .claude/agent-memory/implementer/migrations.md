---
name: migrations
description: How drizzle-kit migrations are run and authored in ai-prompts-vault-api
metadata:
  type: project
---

- `npx drizzle-kit generate` then `npx drizzle-kit migrate` — run manually; the
  app never migrates on startup, and there are no npm scripts.
- Seed rows and any down/reversal steps are hand-authored with literal UUIDs.
