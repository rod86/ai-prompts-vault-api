---
name: domain-model
description: Bounded context and entity/field vocabulary for the prompt domain (PromptCategory, Prompt)
metadata:
  type: project
---

**Bounded context:** only **one** exists: `prompt` (`src/logic/prompt/`). It
owns **both** `PromptCategory` and `Prompt` — categories are NOT a separate
context (001 Decision #1). `Prompt` is the central entity. Default new
prompt-domain features into this context unless there's a strong reason to
add another.

**Entities:**
- `PromptCategory { id, name }`.
- `Prompt { id, category: { id, name }, title, prompt, description?, createdAt,
  updatedAt }` — the category is a **nested reference** (id + name together),
  not a flat foreign key (002 Decision #2).

**Why this matters:** every new prompt-domain feature should reuse these
shapes verbatim rather than reinventing field names or re-litigating context
ownership.
**How to apply:** when planning a new entity/field, check here first; only
add a new bounded context if the feature genuinely doesn't touch prompts or
categories.
