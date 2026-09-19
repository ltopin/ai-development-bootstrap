# AI.md — Universal Agent Protocol

Canonical instructions for any AI agent working in this multi-repository workspace.
Agent-specific files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`) only point here.

```
DISCOVER → ANALYZE → SCOPE → PLAN → IMPLEMENT → VALIDATE → DOCUMENT
```

## Prime directive: minimum necessary context

The workspace may hold many repositories. **Having access is not a reason to read.**
Every file you open must be justified by the task at hand.

Read in escalating levels. Stop at the first level that answers your question.

| Level | Source | Cost | Read when |
|---|---|---|---|
| L0 | [PROJECT.md](PROJECT.md), [REPOSITORIES.md](REPOSITORIES.md), [ARCHITECTURE.md](ARCHITECTURE.md) | tiny | Always, at the start of every task |
| L1 | [docs/domains/](docs/domains/), [docs/adr/](docs/adr/), [openspec/specs/](openspec/specs/), open [openspec/changes/](openspec/changes/) | small | A domain or contract from L0 is involved |
| L2 | Selected repo's own `README` / agent file / docs | medium | You have decided that repo is affected |
| L3 | Source files in affected repos | large | You know what you are looking for |

Rules:

1. **Never** list, grep or read all repositories "to get oriented". L0 is the orientation.
2. Do not open a repository that is not in your impact set (see Phase 2).
3. Inside a repo, locate code by targeted search (symbol, route, event name, table) before reading files. Read the smallest relevant range, not whole trees.
4. Expand only on evidence: when a file you read references something unexpected (a new contract, an unlisted dependency), add exactly that repo/file to scope and say why.
5. If L0 docs are missing, empty or still template placeholders, say so and ask the user — or do a *bounded* discovery (top-level manifests and READMEs only) and propose updates to L0.
6. When unsure whether a repo is affected, prefer a cheap check (search one symbol, read one contract) over opening the repo broadly.

## Phase 1 — Discovery

Before touching code:

- Read PROJECT.md, REPOSITORIES.md, ARCHITECTURE.md (L0).
- Restate the request in one or two sentences, including what "done" means.
- Identify the domains involved; open matching `docs/domains/*.md` if they exist.
- Check `openspec/changes/` for an open change that already covers the request.

Do **not** explore repositories yet.

## Phase 2 — Impact analysis

Work top-down and keep it brief (internal notes, or in the proposal for large changes):

```
Change → Domains → Repositories → Contracts → Files
```

Determine:

- which repositories may be affected, and which are explicitly **not**;
- which contracts may change (API shapes, events, schemas, shared types, config, infra);
- which integrations and consumers depend on those contracts (use the *Depends on* column and the contracts table in REPOSITORIES.md);
- what must be verified in dependent repositories.

Only then open code (L2/L3), starting from the contract boundaries.

## Phase 3 — Scope

Classify the change:

- **Single-repository** — one repo, no contract consumed by another repo changes. Proceed in that repo, following its local conventions.
- **Cross-repository** — more than one repo changes, or a contract crossing repos changes. Use a central change in `openspec/changes/<change-id>/` (see [WORKFLOW.md](WORKFLOW.md)).

When in doubt about a contract's consumers, treat it as cross-repository.

## Phase 4 — Plan

Before any non-trivial implementation, state:

- objective and expected behavior;
- impact: repositories, contracts, data;
- implementation sequence (usually: contract/schema → provider → consumers → infra);
- validation strategy;
- risks and rollback/compatibility concerns.

For cross-repository changes this lives in the change's `proposal.md`, `design.md` and `tasks.md`. Trivial changes need only a sentence.

## Phase 5 — Implementation

- Follow each repository's own architecture, style and conventions; read its local agent file/README before editing there.
- Make the smallest change that satisfies the request. No unrelated refactors or reformatting.
- Preserve backward compatibility across repository boundaries unless the plan says otherwise (additive changes first, remove later).
- Keep contracts synchronized: when one side changes, update the other side and the contract documentation in the same change.
- Implement in the order defined by the plan and tick tasks in `tasks.md` as you go.

## Phase 6 — Validation

Run what applies, per affected repository, using that repository's own commands:

- build, tests, lint, typecheck;
- contract checks (schemas, generated clients, API compatibility);
- cross-repository integration: does each consumer still work against the changed provider?

Report honestly what was run, what passed, what failed and what could not be run.

## Phase 7 — Documentation

Update only documentation that the change actually made wrong or incomplete:

- L0 files if the map changed (new repo, new dependency, new contract);
- the relevant domain doc, or the change's specs;
- an ADR for a significant, lasting architectural decision (see [docs/adr/README.md](docs/adr/README.md));
- repository-internal docs stay in that repository — never copy them here.

When a change is finished, mark it done per [WORKFLOW.md](WORKFLOW.md).

## Source-of-truth rule

This layer documents the **system map**: repositories, relationships, cross-repo contracts, cross-repo decisions and changes. Internal details of a repository belong in that repository. Link to them; do not duplicate them.

## Communication

- State the impact set (repos in / repos out) before implementing a cross-repository change.
- Say when you expand scope and why.
- Surface ambiguity early; do not guess across repository boundaries.
