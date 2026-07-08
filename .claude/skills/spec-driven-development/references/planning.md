# PLANNING stage (steps 1–4)

The PLANNING stage converts a feature story into three approved documents —
`spec.md`, `plan.md`, `tasks.md` — under `specs/<YMDHMS>-<slug>/`. You run it **inline**:
explore the code, interview the user live, then author the artifacts. You write **no
production code, tests, or migrations** in this stage.

Read the [SKILL.md](../SKILL.md) first for the core rule, the two-stage gate, the folder
convention, and the ID scheme — this file assumes them.

## The four steps

### 1. Story
Restate the user's intent in 1–2 sentences ("As a `<user>`, I want `<X>` so that
`<Y>`"). No solutions. This becomes the `Story:` line at the top of `spec.md`.

### 2. Explore
Read the relevant code before planning anything: Read/Grep/Glob the modules, existing
data shapes, interfaces, error handling, and tests the feature touches. **Never plan
against code you have not read.** Prefer reusing existing functions, patterns, and
utilities over inventing new ones — note their file paths for `plan.md`.

### 3. Interview (live)
Collect every **design-changing question** — anything whose answer changes behavior,
fields, validation, errors, structure, or task order. Then:

- Ask the user **one question at a time** via AskUserQuestion. Never batch, never answer
  on the user's behalf. Offer concrete options with a recommended default and the impact
  if it's wrong.
- Log every question and answer in `spec.md` §6 (Decisions log).
- Decide **trivial** choices silently (internal naming, private helpers) and log them as
  assumptions in `plan.md`, don't ask.
- If a new design-changing question surfaces while authoring, stop and ask it — never
  bake a guess into an artifact.

Artifacts must **never contain open questions**.

### 4. Author
Write the three artifacts in order, each derived from the previous, using the templates
in [templates/](templates/):

1. `spec.md` — **WHAT, no tech.** Leave its `Status` blank while drafting.
2. `plan.md` — **HOW.** Map every spec item onto a design; every plan item traces back
   to a spec item.
3. `tasks.md` — ordered, test-first checklist ending in a coverage table.

As the **last action**, once all three are complete (coverage table full, no open
questions), set `spec.md`'s `Status` to **`READY TO IMPLEMENT`** (see SKILL.md for the
folder convention and the `Status` lifecycle).

### Gate
Stop after authoring. Report the three file paths, the number of decisions logged, and
any dependency changes, and state that the artifacts await **human approval** before
IMPLEMENTATION begins. Do not start coding.

## Step boundaries

| Step        | Input       | Output     | Touches       | Do NOT                            |
| ----------- | ----------- | ---------- | ------------- | --------------------------------- |
| 1 Story     | a need      | story note | spec.md (top) | propose a solution                |
| — Interview | ambiguity   | Q&A list   | nothing       | guess on design; batch questions  |
| 2 Specify   | story + Q&A | spec.md    | spec doc      | mention tech, files, frameworks   |
| 3 Plan      | spec.md     | plan.md    | plan doc      | write production code             |
| 4 Tasks     | plan.md     | tasks.md   | tasks doc     | bundle many behaviors per task    |
| — Gate      | 3 artifacts | approval   | nothing       | approve incomplete coverage       |

## Hard rules

The step-boundary table above covers the per-step "do NOT"s. These are the additional
rules it doesn't:

- Your only writes are the three files under `specs/<YMDHMS>-<slug>/` — no production
  code, tests, or migrations.
- Never answer your own clarifying question; only a user answer or a logged trivial
  default resolves a decision.
- Full traceability: story → spec → plan → tasks. Anything untraceable is a defect.
- Ground every claim in the code you read or the user's answers. Cite file paths.
