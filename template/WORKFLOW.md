# WORKFLOW

The operational flow. The rules per phase are in [AI.md](AI.md); this file says *what artifacts to produce and when a formal change is required*.

```
REQUEST
   ↓
DISCOVERY         read L0: PROJECT, REPOSITORIES, ARCHITECTURE
   ↓
IMPACT ANALYSIS   domains → repositories → contracts → files
   ↓
CHANGE            direct edit  OR  openspec/changes/<change-id>/
   ↓
IMPLEMENTATION    minimal, per repo, in planned order
   ↓
VALIDATION        build / test / lint / typecheck / contracts / integration
   ↓
DOCUMENTATION     only what became wrong; ADR if the decision is durable
```

## When is a formal change required?

Decide after impact analysis, not before.

| Situation | Path |
|---|---|
| Bug fix or small tweak inside one repo, no contract touched | **Direct** — just do it, follow that repo's conventions |
| Refactor, dependency bump, or docs edit inside one repo | **Direct** |
| Single-repo feature, non-trivial, contracts unaffected | **Lightweight change** — `proposal.md` (short) + `tasks.md` if useful |
| Any change to a contract consumed by another repo | **Formal change** |
| A feature spanning two or more repos | **Formal change** |
| Data model / schema change affecting other repos | **Formal change** |
| Unclear scope or several valid approaches | **Formal change** (the design is the point) |

Rule of thumb: if someone reviewing repo A would need to know what happens in repo B, it is a formal change.

## Anatomy of a change

A change is one **logical** product change, even if it crosses repositories. Name it after the outcome, in kebab-case, never after a repo:

```
openspec/changes/add-payment-method/     ✔
api/add-payment-method                   ✘
```

Files, and when they are needed:

| File | Purpose | Required |
|---|---|---|
| `proposal.md` | Problem, goal, scope, out of scope, repositories potentially affected | Always (a few lines is fine) |
| `design.md` | Solution, contracts, decisions, risks | Cross-repo or non-obvious design |
| `tasks.md` | Checklist grouped by repository, in implementation order | Whenever there is more than one step |
| `specs/` | Behavior/contract deltas, one folder per capability | When behavior or contracts change |

Start from [openspec/changes/_template/](openspec/changes/_template/). Delete sections that do not apply — do not fill them with filler. See [openspec/README.md](openspec/README.md).

## Lifecycle

1. **Propose** — create `openspec/changes/<change-id>/` with `proposal.md`. Get agreement on scope if the user is available.
2. **Design** — add `design.md` and spec deltas when needed. Settle contracts *before* code.
3. **Implement** — follow `tasks.md`; tick items as they are done; note deviations in the file.
4. **Validate** — run the checks for every repo listed in the tasks.
5. **Close** — merge spec deltas into `openspec/specs/` (if the change altered behavior), move the change to `openspec/changes/archive/<date>-<change-id>/`, update L0/domain docs, write an ADR if a durable decision was made.

## Ordering across repositories

Default to the order that keeps every repository working at each step:

1. contracts / schemas (additive);
2. providers (API, data, events);
3. consumers (web, workers, other services);
4. infrastructure and configuration;
5. cleanup of deprecated paths (a later change if consumers are still migrating).

## Working with the workspace

- One task, one impact set. Do not open repositories outside it.
- Each repository keeps its own branch/PR flow; a change may therefore produce one PR per repository. Reference the change id in each.
- Never deploy or run destructive operations on shared environments unless the user explicitly asks.
