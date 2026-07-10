---
name: clean-code
description: SOLID and Clean Code principles applied while writing, editing, or reviewing code in any language — Python, Go, Java, TypeScript, Rust, C#, etc. Use whenever writing new code, refactoring, naming a function or class, splitting up logic, designing an interface or abstraction, or reviewing a diff for code quality — even if the user never says "SOLID" or "clean code" explicitly. Also use when the user asks to make code more readable, reduce duplication, simplify a function, or explain why a piece of code smells wrong.
---

# Clean Code

Defaults for writing code that's easy to read, change, and test — independent of language or paradigm. These are judgment tools, not laws: apply the principle that most improves the code in front of you, and don't force one that fights the situation (see "Applying pragmatically" below).

## Clean Code essentials

| Concern | Rule of thumb | Why |
| --- | --- | --- |
| Naming | Intention-revealing names; no abbreviations, no magic numbers/strings | A name should answer "what is this for" without needing a comment |
| Function size | Small, one level of abstraction per function | A function mixing high-level orchestration and low-level detail is hard to scan |
| Parameters | Prefer ≤3-4; bundle related ones into an object | Long positional parameter lists are easy to call wrong and hard to extend |
| Side effects | Minimize; make them obvious from the name/signature | A function called `getTotal()` that also writes to a database will surprise every caller |
| Error handling | Fail fast; don't swallow exceptions; don't use error codes as control flow | Silent failures and status-code checking scatter error logic through the codebase |
| Duplication (DRY) | Remove real duplication; don't abstract two similar-looking but unrelated cases | Premature abstraction to "avoid duplication" often couples things that should evolve independently |
| Comments | Only for the "why" that isn't obvious from the code itself | Comments explaining "what" rot as code changes; well-named code doesn't need them |
| Formatting | Consistent with the codebase's existing style/linter | Inconsistent formatting is a tax on every future reader, including you |

## Review checklist

Run this when auditing existing code, reviewing a diff, or before calling a change done:

- Does each function/class/module have one reason to change?
- Would adding a new case require editing an existing, working branch of logic (vs. extending it)?
- Does any override/implementation throw, no-op, or narrow what its interface promises?
- Does any interface force an implementer to stub out methods it doesn't need?
- Does business logic import a concrete low-level dependency (DB driver, HTTP client) directly, where an abstraction would let it be tested in isolation?
- Any parameter list longer than ~3-4 that should be an object?
- Any duplicated logic across files that represents the *same* concept (not just similar-looking code)?
- Do any names require a comment to explain what they mean?
- Any swallowed exception, or error code checked instead of handled?

## Applying pragmatically

These principles can pull against each other and against simplicity. Use judgment:

- Don't introduce an interface or abstraction for a single implementation "just in case" — that's YAGNI fighting DIP/OCP. Add the seam when a second implementation or a real testing need actually shows up.
- Don't split a cohesive, easy-to-read function purely to hit an arbitrary line count — SRP is about reasons to change, not line count.
- When principles conflict, prioritize whichever one most improves *this* piece of code for the people who'll read it next, rather than mechanically applying all five.
