---
name: clean-code
description: SOLID and Clean Code principles applied while writing, editing, or reviewing code in any language — Python, Go, Java, TypeScript, Rust, C#, etc. Use whenever writing new code, refactoring, naming a function or class, splitting up logic, designing an interface or abstraction, or reviewing a diff for code quality — even if the user never says "SOLID" or "clean code" explicitly. Also use when the user asks to make code more readable, reduce duplication, simplify a function, or explain why a piece of code smells wrong.
---

# Clean Code

Defaults for writing code that's easy to read, change, and test — independent of language or paradigm. These are judgment tools, not laws: apply the principle that most improves the code in front of you, and don't force one that fights the situation (see "Applying pragmatically" below).

## SOLID

Originally framed for OOP, but each one has a direct analogue in modules, functions, and packages in non-OOP languages too.

### S — Single Responsibility

A unit of code (class, module, function, package) should have one reason to change.

**Smell**: a class/module whose methods touch unrelated concerns (e.g., a `User` class that validates input, hits the database, and formats emails). Changing email formatting shouldn't risk breaking validation.

```
// Before: one class owns unrelated concerns
class Order {
    calculateTotal()
    saveToDatabase()
    sendConfirmationEmail()
}

// After: split by reason to change
class Order { calculateTotal() }
class OrderRepository { save(order) }
class OrderNotifier { sendConfirmation(order) }
```

This applies just as much to a Python module or a Go package as to a Java class — the question is always "how many unrelated reasons would force this unit to change?"

### O — Open/Closed

Code should be extensible without modifying its existing, tested source.

**Smell**: a growing `if/switch` on a type tag, where adding a new case means editing a function that already works for every other case.

```
// Before: adding a shape means editing this function again
function area(shape):
    if shape.type == "circle": ...
    if shape.type == "square": ...

// After: new shapes extend, they don't modify
interface Shape { area() }
class Circle implements Shape { area() {...} }
class Square implements Shape { area() {...} }
```

Don't over-apply this: if there are only two cases and no sign of a third, a simple `if` is more honest than a premature abstraction (see YAGNI note below).

### L — Liskov Substitution

A subtype (or any implementation of an interface/contract) must be usable anywhere the base type is expected, without surprising the caller.

**Smell**: an override that throws "not supported", silently no-ops, or narrows what the base type promised.

```
// Violates LSP: Penguin can't actually do what Bird promises
class Bird { fly() }
class Penguin extends Bird { fly() { throw NotSupportedError } }

// Fix: model the real capability, don't force a broken hierarchy
class Bird { }
class FlyingBird extends Bird { fly() }
class Penguin extends Bird { }
```

### I — Interface Segregation

Callers shouldn't be forced to depend on methods they don't use.

**Smell**: an implementation with several methods that just `throw`/`pass`/`return null` because the fat interface doesn't apply to it.

```
// Before: one bloated interface
interface Worker { work(); eat(); sleep() }
class RobotWorker implements Worker {
    work() {...}
    eat() { throw NotSupportedError }   // robots don't eat
    sleep() { throw NotSupportedError }
}

// After: split by what callers actually need
interface Workable { work() }
interface Feedable { eat() }
class RobotWorker implements Workable { work() {...} }
```

### D — Dependency Inversion

Depend on abstractions (interfaces/contracts), not on concrete, low-level implementations — especially across architectural boundaries (business logic → database, network, filesystem).

**Smell**: business logic that directly imports a specific database driver, HTTP client, or SDK, making it untestable without a live dependency.

```
// Before: business logic tied to a concrete implementation
class OrderService {
    private db = new PostgresConnection()
    place(order) { this.db.insert(...) }
}

// After: depend on an abstraction, inject the concrete implementation
interface OrderStore { save(order) }
class OrderService {
    constructor(private store: OrderStore) {}
    place(order) { this.store.save(order) }
}
```

Only invert the dependency where it earns its keep (a real boundary, a real need for substitutability/testability) — see the YAGNI tension below.

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

## Code smells

A catalog for the review lens: named anti-patterns and the refactoring that resolves each. These are heuristics, not verdicts — a smell flags "look here", not "this is wrong". Confirm the design actually suffers before refactoring; some smells are the honest choice in context.

Several of these are just the symptom of a SOLID violation already covered above (noted inline). The value of the smell name is spotting it fast in a diff.

### Bloaters — too much in one place

| Smell | Tell | Fix |
| --- | --- | --- |
| Long Method | ~50+ lines, or mixing levels of abstraction | Extract Method into named, single-purpose chunks |
| Large Class / God Object | Too many fields/methods; owns unrelated concerns | Extract Class/Subclass (this is an SRP violation) |
| Primitive Obsession | `String` for a phone number, `int` for money | Replace Type Code with Enum → Introduce Value Object (cheapest fix first) |
| Long Parameter List | ~5+ params | Introduce Parameter Object |
| Data Clumps | The *same* group of fields travels together everywhere (`startDate, endDate`) | Extract the grouping into an object — distinct from Long Parameter List, it's about the recurring group, not the count |

### OO abusers — broken polymorphism

| Smell | Tell | Fix |
| --- | --- | --- |
| Type-code Switch | `if/switch` on an object's type tag | Replace Conditional with Polymorphism — **only** when switching on a *type*. A switch on a plain value (HTTP status, etc.) is better as a lookup/strategy map, not a class hierarchy. (OCP) |
| Repeated Switches | The *same* switch duplicated in several places | Consolidate; the duplication is what makes it dangerous — adding a case means finding every copy |
| Temporary Field | A field null/unused except in rare cases | Extract Class for the field + its methods |
| Refused Bequest | Subclass inherits methods it neither needs nor uses | Replace Inheritance with Delegation (LSP) |
| Alternative Classes, Different Interfaces | Two classes do the same job with different method names | Rename/unify the interface so they're interchangeable |

### Change preventers — one edit ripples

These two are mirror images; keep them defined as opposites or they get conflated.

- **Divergent Change** — you touch *one* class for *many unrelated reasons* (change the DB, the tax rules, the report format → all edit the same class). Fix: Split Class by reason-to-change. This is an SRP violation.
- **Shotgun Surgery** — *one* logical change forces edits across *many* classes. Fix: Move Method/Field to consolidate the behavior into one place.
- **Parallel Inheritance Hierarchies** — every new subclass of X forces a matching subclass of Y. Fix: let one hierarchy reference the other via delegation instead of mirroring it.

### Dispensables — should not exist

| Smell | Tell | Fix |
| --- | --- | --- |
| Dead / Commented-out Code | Unused vars, params, methods; commented blocks | Delete it — version control is the history |
| Lazy Class | A class not pulling its weight | Inline Class |
| Data Class | Only getters/setters, zero behavior | Move the logic that manipulates the data into the class (systemic version: **Anemic Domain Model**) |
| Duplicate Code | Same *concept* in 2+ places | Extract Method / Pull Up — but don't unify two similar-looking but *unrelated* cases (see DRY note in essentials) |
| Speculative Generality | Abstractions/hooks/params added "just in case" | Remove the abstraction: Inline Class, Remove Parameter, Collapse Hierarchy. YAGNI. |
| Comments as deodorant | A comment explaining *what* a confusing block does | Extract Method / Rename until the code needs no comment — keep comments that explain *why* |

### Couplers — too much dependency

| Smell | Tell | Fix |
| --- | --- | --- |
| Feature Envy | A method uses another class's data more than its own | Move Method to the data it envies |
| Inappropriate Intimacy | Two classes know each other's internals | Move Method + Hide Delegate; narrow the public surface |
| Message Chains | `a.getB().getC().getD()` | Hide Delegate — expose one method on the top object |
| Middle Man | A class that only forwards calls, adding nothing | Remove Middle Man; call the target directly |
| Insider Trading / hidden coupling | Modules talk through globals, statics, or required call-ordering | Make the dependency explicit; encapsulate the shared state |

### Data, state & control flow

| Smell | Tell | Fix |
| --- | --- | --- |
| Mutable / Global Data | Shared mutable state written from many places | Encapsulate Variable, narrow scope, prefer immutability |
| Magic Number / String | `if (status == 3)`, `* 86400` | Named constant or enum |
| Boolean / Flag Parameter | `render(true)` — unreadable at the call site, usually two behaviors | Split into two methods |
| Special Case / pervasive null checks | The same `if (x == null)` guard scattered everywhere | Introduce Null Object or Optional |
| Command/Query mixing | A method both returns a value *and* mutates state | Separate the query from the command |
| Invalid/partial construction | Object can exist in a not-yet-usable state (the real smell behind "lazy-init overuse") | Build fully in the constructor; never allow an invalid state |

### Naming

| Smell | Tell | Fix |
| --- | --- | --- |
| Mysterious / Uncommunicative Name | `d`, `tmp`, `data2`, `handle()` | Rename — highest-ROI refactor there is |
| Inconsistent Names | `fetch`/`get`/`load`/`retrieve` all meaning the same thing | Standardize the vocabulary across the codebase |

### Architecture & boundaries

| Smell | Tell | Fix |
| --- | --- | --- |
| Shotgun Dependencies | Core logic tightly bound to a DB/HTTP/parser library | Dependency Inversion — wrap it behind an interface/adapter (DIP) |
| Leaky Abstraction | An interface forces callers to know the implementation underneath | Redesign the seam so it hides its internals |
| Swallowed Exceptions | `catch (e) {}` or log-and-continue in a broken state | Handle or propagate; fail fast |
| Exceptions as control flow | try/catch for an expected, normal branch | Use ordinary conditionals for expected cases |
| High Cyclomatic Complexity | Conditionals nested 4–5 deep | Guard clauses to return early; Extract Method for nested blocks |

## Applying pragmatically

These principles can pull against each other and against simplicity. Use judgment:

- Don't introduce an interface or abstraction for a single implementation "just in case" — that's YAGNI fighting DIP/OCP. Add the seam when a second implementation or a real testing need actually shows up.
- Don't split a cohesive, easy-to-read function purely to hit an arbitrary line count — SRP is about reasons to change, not line count.
- When principles conflict, prioritize whichever one most improves *this* piece of code for the people who'll read it next, rather than mechanically applying all five.
